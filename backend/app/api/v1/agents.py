from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.agent import AgentCreate, AgentResponse, AgentUpdate
from app.services import agent_service

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent(
    payload: AgentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return agent_service.create_agent(
        db,
        tenant_id=current_user.tenant_id,
        payload=payload,
    )


@router.get("", response_model=list[AgentResponse])
def list_agents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return agent_service.list_agents(db, tenant_id=current_user.tenant_id)


@router.get("/{agent_id}", response_model=AgentResponse)
def get_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return agent_service.get_agent(
        db,
        tenant_id=current_user.tenant_id,
        agent_id=agent_id,
    )


@router.patch("/{agent_id}", response_model=AgentResponse)
def update_agent(
    agent_id: int,
    payload: AgentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return agent_service.update_agent(
        db,
        tenant_id=current_user.tenant_id,
        agent_id=agent_id,
        payload=payload,
    )


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    agent_service.delete_agent(
        db,
        tenant_id=current_user.tenant_id,
        agent_id=agent_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
