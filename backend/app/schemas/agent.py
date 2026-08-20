from pydantic import BaseModel, Field, field_validator

from app.core.system_tools import DEFAULT_SYSTEM_TOOLS, parse_system_tools


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    system_prompt: str = Field(min_length=1)
    model: str = Field(default="anthropic/claude-haiku-4.5", min_length=1, max_length=80)
    temperature: float = Field(default=0.7, ge=0, le=2)
    system_tools: list[str] = Field(default_factory=lambda: list(DEFAULT_SYSTEM_TOOLS))

    @field_validator("system_tools")
    @classmethod
    def system_tools_must_be_known(cls, value: list[str]) -> list[str]:
        return parse_system_tools(value)


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    system_prompt: str | None = Field(default=None, min_length=1)
    model: str | None = Field(default=None, min_length=1, max_length=80)
    temperature: float | None = Field(default=None, ge=0, le=2)
    system_tools: list[str] | None = None

    @field_validator("system_tools")
    @classmethod
    def system_tools_must_be_known(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return value
        return parse_system_tools(value)


class AgentResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    system_prompt: str
    model: str
    temperature: float
    system_tools: list[str]

    model_config = {"from_attributes": True}
