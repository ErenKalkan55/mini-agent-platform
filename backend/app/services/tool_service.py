from langchain_core.tools import BaseTool
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.cache import cache_get, cache_set, invalidate_agent, tools_cache_key
from app.core.system_tools import SYSTEM_TOOL_NAMES, list_system_tools, tools_from_names
from app.models.tool import AgentTool
from app.schemas.tool import SystemToolResponse, ToolCreate
from app.services.agent_service import get_agent, get_agent_config
from app.services.errors import ConflictError, NotFoundError
from app.services.http_tool import http_record_to_tool


def list_system_tool_summaries() -> list[SystemToolResponse]:
    return [
        SystemToolResponse(name=item.name, description=item.description)
        for item in list_system_tools()
    ]


def _tool_payload(tool: AgentTool) -> dict:
    return {
        "id": tool.id,
        "tenant_id": tool.tenant_id,
        "agent_id": tool.agent_id,
        "name": tool.name,
        "description": tool.description,
        "method": tool.method,
        "url": tool.url,
        "argument_schema": tool.argument_schema,
    }


def list_tools(
    db: Session,
    *,
    tenant_id: int,
    agent_id: int,
) -> list[AgentTool]:
    get_agent(db, tenant_id=tenant_id, agent_id=agent_id)
    return list(
        db.scalars(
            select(AgentTool)
            .where(AgentTool.tenant_id == tenant_id, AgentTool.agent_id == agent_id)
            .order_by(AgentTool.id)
        ).all()
    )


def _tool_specs(db: Session, *, tenant_id: int, agent_id: int) -> list[dict]:
    cached = cache_get(tools_cache_key(tenant_id, agent_id))
    if isinstance(cached, list):
        return cached
    specs = [_tool_payload(item) for item in list_tools(db, tenant_id=tenant_id, agent_id=agent_id)]
    cache_set(tools_cache_key(tenant_id, agent_id), specs)
    return specs


def create_tool(
    db: Session,
    *,
    tenant_id: int,
    agent_id: int,
    payload: ToolCreate,
) -> AgentTool:
    get_agent(db, tenant_id=tenant_id, agent_id=agent_id)
    if payload.name in SYSTEM_TOOL_NAMES:
        raise ConflictError("Tool name is reserved by a system tool")
    exists = db.scalar(
        select(AgentTool.id).where(
            AgentTool.agent_id == agent_id,
            AgentTool.name == payload.name,
        )
    )
    if exists is not None:
        raise ConflictError("Tool name already exists for this agent")
    tool = AgentTool(
        tenant_id=tenant_id,
        agent_id=agent_id,
        name=payload.name,
        description=payload.description,
        method=payload.method,
        url=payload.url,
        argument_schema=payload.argument_schema,
    )
    db.add(tool)
    db.commit()
    db.refresh(tool)
    invalidate_agent(tenant_id, agent_id)
    return tool


def delete_tool(
    db: Session,
    *,
    tenant_id: int,
    agent_id: int,
    tool_id: int,
) -> None:
    get_agent(db, tenant_id=tenant_id, agent_id=agent_id)
    tool = db.scalar(
        select(AgentTool).where(
            AgentTool.id == tool_id,
            AgentTool.agent_id == agent_id,
            AgentTool.tenant_id == tenant_id,
        )
    )
    if tool is None:
        raise NotFoundError("Tool not found")
    db.delete(tool)
    db.commit()
    invalidate_agent(tenant_id, agent_id)


def build_agent_tools(db: Session, *, tenant_id: int, agent_id: int) -> list[BaseTool]:
    config = get_agent_config(db, tenant_id=tenant_id, agent_id=agent_id)
    tools: list[BaseTool] = tools_from_names(config.get("system_tools"))
    for spec in _tool_specs(db, tenant_id=tenant_id, agent_id=agent_id):
        tools.append(http_record_to_tool(spec))
    return tools
