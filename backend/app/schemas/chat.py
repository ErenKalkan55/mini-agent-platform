from datetime import datetime

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: int | None = None


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    tool_name: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ToolEvent(BaseModel):
    name: str
    content: str


class ConversationResponse(BaseModel):
    id: int
    created_at: datetime
    preview: str

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    conversation_id: int
    reply: str
    messages: list[MessageResponse]
    tool_events: list[ToolEvent] = []
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
