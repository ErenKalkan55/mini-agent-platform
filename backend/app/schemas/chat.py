from datetime import datetime

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: int | None = None


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ToolEvent(BaseModel):
    name: str
    content: str


class ChatResponse(BaseModel):
    conversation_id: int
    reply: str
    messages: list[MessageResponse]
    tool_events: list[ToolEvent] = []
