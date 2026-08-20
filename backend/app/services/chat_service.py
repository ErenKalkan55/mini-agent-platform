import logging

from fastapi import HTTPException, status
from langchain.agents import create_agent
from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain_core.messages import AIMessage, ToolMessage
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.llm import build_chat_model
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.chat import ChatRequest, ChatResponse, ConversationResponse, MessageResponse, ToolEvent
from app.services.agent_service import get_agent
from app.services.tool_service import build_agent_tools

logger = logging.getLogger(__name__)

SHORT_TERM_LIMIT = 20
RECURSION_LIMIT = 15
TOOL_HINT = (
    "\n\nYou have tools. Call get_current_time for the date or time, "
    "calculator for arithmetic, and HTTP tools when they match the request."
)


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


def _tool_events(result: dict) -> list[ToolEvent]:
    events: list[ToolEvent] = []
    for item in result.get("messages", []):
        if isinstance(item, ToolMessage):
            events.append(
                ToolEvent(
                    name=item.name or "tool",
                    content=_message_text(item.content)[:2000],
                )
            )
    return events


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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    return conversation


def list_conversations(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
    agent_id: int,
) -> list[ConversationResponse]:
    get_agent(db, tenant_id=tenant_id, agent_id=agent_id)
    conversations = list(
        db.scalars(
            select(Conversation)
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.agent_id == agent_id,
                Conversation.user_id == user_id,
            )
            .order_by(Conversation.id.desc())
        ).all()
    )
    items: list[ConversationResponse] = []
    for conversation in conversations:
        first = db.scalar(
            select(Message.content)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.id)
            .limit(1)
        )
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
    agent = get_agent(db, tenant_id=tenant_id, agent_id=agent_id)

    if payload.conversation_id is None:
        conversation = Conversation(
            tenant_id=tenant_id,
            agent_id=agent.id,
            user_id=user_id,
        )
        db.add(conversation)
        db.flush()
    else:
        conversation = _get_conversation(
            db,
            tenant_id=tenant_id,
            user_id=user_id,
            agent_id=agent.id,
            conversation_id=payload.conversation_id,
        )

    previous = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.id)
        ).all()
    )

    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=payload.message,
    )
    db.add(user_message)
    db.flush()

    try:
        model = build_chat_model(model=agent.model, temperature=agent.temperature)
        graph = create_agent(
            model,
            tools=build_agent_tools(db, tenant_id=tenant_id, agent_id=agent.id),
            system_prompt=agent.system_prompt + TOOL_HINT,
            middleware=[ToolCallLimitMiddleware(run_limit=8, exit_behavior="end")],
        )
        result = graph.invoke(
            {
                "messages": _history_payload(previous)
                + [{"role": "user", "content": payload.message}]
            },
            {"recursion_limit": RECURSION_LIMIT},
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("LLM request failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=_llm_error_detail(exc),
        ) from exc

    reply = ""
    for item in reversed(result.get("messages", [])):
        if isinstance(item, AIMessage):
            reply = _message_text(item.content).strip()
            if reply:
                break
    if not reply:
        reply = "No response from the model."

    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=reply,
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(user_message)
    db.refresh(assistant_message)

    stored = list_messages(
        db,
        tenant_id=tenant_id,
        user_id=user_id,
        agent_id=agent.id,
        conversation_id=conversation.id,
    )
    return ChatResponse(
        conversation_id=conversation.id,
        reply=reply,
        messages=[MessageResponse.model_validate(item) for item in stored],
        tool_events=_tool_events(result),
    )
