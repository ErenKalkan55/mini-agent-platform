from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    system_prompt: str = Field(min_length=1)
    model: str = Field(default="anthropic/claude-haiku-4.5", min_length=1, max_length=80)
    temperature: float = Field(default=0.7, ge=0, le=2)


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    system_prompt: str | None = Field(default=None, min_length=1)
    model: str | None = Field(default=None, min_length=1, max_length=80)
    temperature: float | None = Field(default=None, ge=0, le=2)


class AgentResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    system_prompt: str
    model: str
    temperature: float

    model_config = {"from_attributes": True}
