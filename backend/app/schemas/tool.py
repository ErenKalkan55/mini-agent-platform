import re
from datetime import datetime
from typing import Any, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

NAME_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")
ARG_TYPES = {"string", "integer", "number", "boolean"}


def _validate_argument_schema(value: dict[str, Any]) -> dict[str, Any]:
    if value.get("type", "object") != "object":
        raise ValueError("argument_schema type must be object")
    properties = value.get("properties")
    if properties is None:
        properties = {}
    if not isinstance(properties, dict):
        raise ValueError("argument_schema.properties must be an object")
    required = value.get("required") or []
    if not isinstance(required, list):
        raise ValueError("argument_schema.required must be a list")
    for key, spec in properties.items():
        if not NAME_PATTERN.match(str(key)):
            raise ValueError(f"invalid argument name: {key}")
        if not isinstance(spec, dict):
            raise ValueError(f"argument {key} must be an object")
        arg_type = spec.get("type", "string")
        if arg_type not in ARG_TYPES:
            raise ValueError(f"unsupported argument type for {key}")
    for item in required:
        if item not in properties:
            raise ValueError(f"required argument missing from properties: {item}")
    return {
        "type": "object",
        "properties": properties,
        "required": [str(item) for item in required],
    }


class ToolCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64, pattern=r"^[a-zA-Z_][a-zA-Z0-9_]*$")
    description: str = Field(min_length=1, max_length=500)
    method: Literal["GET", "POST"] = "GET"
    url: str = Field(min_length=8, max_length=2000)
    argument_schema: dict[str, Any] = Field(
        default_factory=lambda: {"type": "object", "properties": {}, "required": []}
    )

    @field_validator("url")
    @classmethod
    def url_must_be_http(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("URL must start with http:// or https://")
        return value

    @field_validator("argument_schema")
    @classmethod
    def argument_schema_must_be_object(cls, value: dict[str, Any]) -> dict[str, Any]:
        return _validate_argument_schema(value)


class ToolResponse(BaseModel):
    id: int
    agent_id: int
    name: str
    description: str
    method: str
    url: str
    argument_schema: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class SystemToolResponse(BaseModel):
    name: str
    description: str
    kind: Literal["system"] = "system"
