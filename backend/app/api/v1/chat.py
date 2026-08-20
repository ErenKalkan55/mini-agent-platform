from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse, ConversationResponse, MessageResponse
from app.services import chat_service

router = APIRouter(prefix="/agents", tags=["chat"])


@router.post("/{agent_id}/chat", response_model=ChatResponse)
def chat(
    agent_id: int,
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chat_service.chat(
        db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        agent_id=agent_id,
        payload=payload,
    )


@router.get("/{agent_id}/conversations", response_model=list[ConversationResponse])
def list_conversations(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chat_service.list_conversations(
        db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        agent_id=agent_id,
    )


@router.get(
    "/{agent_id}/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
def list_messages(
    agent_id: int,
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    messages = chat_service.list_messages(
        db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        agent_id=agent_id,
        conversation_id=conversation_id,
    )
    return [MessageResponse.model_validate(item) for item in messages]
