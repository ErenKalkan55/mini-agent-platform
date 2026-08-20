from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.tool import SystemToolResponse, ToolCreate, ToolResponse
from app.services import tool_service

router = APIRouter(tags=["tools"])


@router.get("/system-tools", response_model=list[SystemToolResponse])
def list_system_tools(_current_user: User = Depends(get_current_user)):
    return tool_service.list_system_tool_summaries()


@router.get("/agents/{agent_id}/tools", response_model=list[ToolResponse])
def list_tools(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return tool_service.list_tools(
        db,
        tenant_id=current_user.tenant_id,
        agent_id=agent_id,
    )


@router.post(
    "/agents/{agent_id}/tools",
    response_model=ToolResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_tool(
    agent_id: int,
    payload: ToolCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return tool_service.create_tool(
        db,
        tenant_id=current_user.tenant_id,
        agent_id=agent_id,
        payload=payload,
    )


@router.delete("/agents/{agent_id}/tools/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tool(
    agent_id: int,
    tool_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tool_service.delete_tool(
        db,
        tenant_id=current_user.tenant_id,
        agent_id=agent_id,
        tool_id=tool_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
