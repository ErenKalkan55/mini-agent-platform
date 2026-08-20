from fastapi import HTTPException, status
from langchain_core.tools import BaseTool
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.system_tools import SYSTEM_TOOL_NAMES, list_system_tools
from app.models.tool import AgentTool
from app.schemas.tool import SystemToolResponse, ToolCreate
from app.services.agent_service import get_agent
from app.services.http_tool import http_record_to_tool


def list_system_tool_summaries() -> list[SystemToolResponse]:
    return [
        SystemToolResponse(name=item.name, description=item.description)
        for item in list_system_tools()
    ]


def list_tools(db: Session, *, tenant_id: int, agent_id: int) -> list[AgentTool]:
    get_agent(db, tenant_id=tenant_id, agent_id=agent_id)
    return list(
        db.scalars(
            select(AgentTool)
            .where(AgentTool.tenant_id == tenant_id, AgentTool.agent_id == agent_id)
            .order_by(AgentTool.id)
        ).all()
    )


def create_tool(
    db: Session,
    *,
    tenant_id: int,
    agent_id: int,
    payload: ToolCreate,
) -> AgentTool:
    get_agent(db, tenant_id=tenant_id, agent_id=agent_id)
    if payload.name in SYSTEM_TOOL_NAMES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tool name is reserved by a system tool",
        )
    exists = db.scalar(
        select(AgentTool.id).where(
            AgentTool.agent_id == agent_id,
            AgentTool.name == payload.name,
        )
    )
    if exists is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tool name already exists for this agent",
        )
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool not found",
        )
    db.delete(tool)
    db.commit()


def build_agent_tools(db: Session, *, tenant_id: int, agent_id: int) -> list[BaseTool]:
    tools: list[BaseTool] = list(list_system_tools())
    for record in list_tools(db, tenant_id=tenant_id, agent_id=agent_id):
        tools.append(http_record_to_tool(record))
    return tools
