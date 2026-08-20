import logging

from langchain.agents import create_agent
from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain_core.messages import AIMessage, ToolMessage
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.llm import build_chat_model
from app.db.session import SessionLocal
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.chat import ChatRequest, ChatResponse, ConversationResponse, MessageResponse, ToolEvent
from app.services.agent_service import get_agent, get_agent_config
from app.services.errors import BadGatewayError, NotFoundError, ServiceUnavailableError
from app.services.tool_service import build_agent_tools

logger = logging.getLogger(__name__)

SHORT_TERM_LIMIT = 20
RECURSION_LIMIT = 15


def _llm_error_detail(exc: Exception) -> str:
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        err = body.get("error")
        if isinstance(err, dict) and isinstance(err.get("code"), (int, str)):
            if str(err.get("code")) == "402":
                return "OpenRouter credit limit. Reply size was reduced; try again."
    text = str(exc).lower()
    if "402" in text or "credits" in text:
        return "OpenRouter credit limit. Reply size was reduced; try again."
    return "LLM request failed"


def _message_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
        return "".join(parts)
    return str(content) if content is not None else ""


def _tool_events_from_messages(messages: list[Message]) -> list[ToolEvent]:
    return [
        ToolEvent(name=item.tool_name or "tool", content=item.content)
        for item in messages
        if item.role == "tool"
    ]


def _usage_from_result(result: dict) -> tuple[int | None, int | None]:
    prompt_tokens = 0
    completion_tokens = 0
    found = False
    for item in result.get("messages", []):
        if not isinstance(item, AIMessage):
            continue
        meta = getattr(item, "usage_metadata", None) or {}
        if not meta:
            response_meta = getattr(item, "response_metadata", None) or {}
            meta = response_meta.get("token_usage") or response_meta.get("usage") or {}
        input_tokens = meta.get("input_tokens", meta.get("prompt_tokens"))
        output_tokens = meta.get("output_tokens", meta.get("completion_tokens"))
        if input_tokens is None and output_tokens is None:
            continue
        found = True
        prompt_tokens += int(input_tokens or 0)
        completion_tokens += int(output_tokens or 0)
    if not found:
        return None, None
    return prompt_tokens, completion_tokens


def _history_payload(messages: list[Message]) -> list[dict[str, str]]:
    history: list[dict[str, str]] = []
    for item in messages[-SHORT_TERM_LIMIT:]:
        if item.role in {"user", "assistant"}:
            history.append({"role": item.role, "content": item.content})
    return history


def _get_conversation(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
    agent_id: int,
    conversation_id: int,
) -> Conversation:
    conversation = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.tenant_id == tenant_id,
            Conversation.agent_id == agent_id,
            Conversation.user_id == user_id,
        )
    )
    if conversation is None:
        raise NotFoundError("Conversation not found")
    return conversation


def list_conversations(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
    agent_id: int,
) -> list[ConversationResponse]:
    get_agent(db, tenant_id=tenant_id, agent_id=agent_id)
    first_message = (
        select(Message.content)
        .where(Message.conversation_id == Conversation.id)
        .order_by(Message.id)
        .limit(1)
        .scalar_subquery()
    )
    rows = db.execute(
        select(Conversation, first_message)
        .where(
            Conversation.tenant_id == tenant_id,
            Conversation.agent_id == agent_id,
            Conversation.user_id == user_id,
        )
        .order_by(Conversation.id.desc())
    ).all()
    items: list[ConversationResponse] = []
    for conversation, first in rows:
        preview = (first or "Empty").strip().replace("\n", " ")
        items.append(
            ConversationResponse(
                id=conversation.id,
                created_at=conversation.created_at,
                preview=preview[:80],
            )
        )
    return items


def list_messages(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
    agent_id: int,
    conversation_id: int,
) -> list[Message]:
    get_agent(db, tenant_id=tenant_id, agent_id=agent_id)
    conversation = _get_conversation(
        db,
        tenant_id=tenant_id,
        user_id=user_id,
        agent_id=agent_id,
        conversation_id=conversation_id,
    )
    return list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.id)
        ).all()
    )


def chat(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
    agent_id: int,
    payload: ChatRequest,
) -> ChatResponse:
    config = get_agent_config(db, tenant_id=tenant_id, agent_id=agent_id)
    tools = build_agent_tools(db, tenant_id=tenant_id, agent_id=config["id"])

    if payload.conversation_id is None:
        conversation = Conversation(
            tenant_id=tenant_id,
            agent_id=config["id"],
            user_id=user_id,
        )
        db.add(conversation)
        db.flush()
    else:
        conversation = _get_conversation(
            db,
            tenant_id=tenant_id,
            user_id=user_id,
            agent_id=config["id"],
            conversation_id=payload.conversation_id,
        )

    previous = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.id)
        ).all()
    )
    history = _history_payload(previous)

    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=payload.message,
    )
    db.add(user_message)
    db.commit()
    conversation_id = conversation.id
    db.close()

    try:
        model = build_chat_model(model=config["model"], temperature=config["temperature"])
        graph = create_agent(
            model,
            tools=tools,
            system_prompt=config["system_prompt"],
            middleware=[ToolCallLimitMiddleware(run_limit=8, exit_behavior="end")],
        )
        result = graph.invoke(
            {"messages": history + [{"role": "user", "content": payload.message}]},
            {"recursion_limit": RECURSION_LIMIT},
        )
    except RuntimeError as exc:
        raise ServiceUnavailableError(str(exc)) from exc
    except Exception as exc:
        logger.exception("LLM request failed")
        raise BadGatewayError(_llm_error_detail(exc)) from exc

    reply = ""
    for item in reversed(result.get("messages", [])):
        if isinstance(item, AIMessage):
            reply = _message_text(item.content).strip()
            if reply:
                break
    if not reply:
        reply = "No response from the model."

    prompt_tokens, completion_tokens = _usage_from_result(result)

    with SessionLocal() as save_db:
        for item in result.get("messages", []):
            if isinstance(item, ToolMessage):
                save_db.add(
                    Message(
                        conversation_id=conversation_id,
                        role="tool",
                        content=_message_text(item.content)[:8000],
                        tool_name=item.name or "tool",
                    )
                )
        save_db.add(
            Message(
                conversation_id=conversation_id,
                role="assistant",
                content=reply,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
            )
        )
        save_db.commit()
        stored = list(
            save_db.scalars(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.id)
            ).all()
        )
        return ChatResponse(
            conversation_id=conversation_id,
            reply=reply,
            messages=[MessageResponse.model_validate(item) for item in stored],
            tool_events=_tool_events_from_messages(stored),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
