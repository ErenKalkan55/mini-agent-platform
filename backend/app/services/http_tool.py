from __future__ import annotations

from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import httpx
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field, create_model

from app.models.tool import AgentTool

_TYPE_MAP = {
    "string": str,
    "integer": int,
    "number": float,
    "boolean": bool,
}

_TIMEOUT = httpx.Timeout(8.0)
_MAX_BODY = 8000


def schema_to_model(model_name: str, schema: dict[str, Any]) -> type[BaseModel]:
    properties = schema.get("properties") or {}
    required = set(schema.get("required") or [])
    fields: dict[str, Any] = {}
    for key, spec in properties.items():
        spec = spec or {}
        py_type = _TYPE_MAP.get(spec.get("type", "string"), str)
        description = spec.get("description") or key
        if key in required:
            fields[key] = (py_type, Field(..., description=description))
        else:
            fields[key] = (py_type | None, Field(default=None, description=description))
    if not fields:
        return create_model(model_name, __base__=BaseModel)
    return create_model(model_name, __base__=BaseModel, **fields)


def execute_http_tool(*, method: str, url: str, arguments: dict[str, Any]) -> str:
    remaining = dict(arguments)
    filled = url
    for key, value in list(remaining.items()):
        token = "{" + key + "}"
        if token in filled:
            filled = filled.replace(token, str(value))
            remaining.pop(key)

    parsed = urlparse(filled)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return "Tool error: only http and https URLs are allowed."

    try:
        with httpx.Client(timeout=_TIMEOUT, follow_redirects=True) as client:
            if method == "GET":
                extra = [(key, str(value)) for key, value in remaining.items() if value is not None]
                query = list(parse_qsl(parsed.query, keep_blank_values=True)) + extra
                target = urlunparse(parsed._replace(query=urlencode(query)))
                response = client.get(target, headers={"User-Agent": "mini-agent-platform"})
            else:
                response = client.post(
                    filled,
                    json=remaining,
                    headers={"User-Agent": "mini-agent-platform"},
                )
    except httpx.HTTPError as exc:
        return f"Tool error: request failed ({exc.__class__.__name__})"

    body = response.text[:_MAX_BODY]
    if response.status_code >= 400:
        return f"Tool error: HTTP {response.status_code}: {body}"
    return body or f"HTTP {response.status_code} empty body"


def http_record_to_tool(record: AgentTool) -> StructuredTool:
    args_model = schema_to_model(f"HttpTool{record.id}Args", record.argument_schema or {})
    method = record.method
    url = record.url
    name = record.name
    description = record.description

    def _run(**kwargs: Any) -> str:
        cleaned = {key: value for key, value in kwargs.items() if value is not None}
        return execute_http_tool(method=method, url=url, arguments=cleaned)

    _run.__name__ = name
    _run.__doc__ = description
    return StructuredTool.from_function(
        func=_run,
        name=name,
        description=description,
        args_schema=args_model,
        handle_validation_error=True,
    )
