from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentUpdate


def _tenant_query(tenant_id: int):
    return select(Agent).where(Agent.tenant_id == tenant_id)


def list_agents(db: Session, *, tenant_id: int) -> list[Agent]:
    return list(db.scalars(_tenant_query(tenant_id).order_by(Agent.id)).all())


def get_agent(db: Session, *, tenant_id: int, agent_id: int) -> Agent:
    agent = db.scalar(_tenant_query(tenant_id).where(Agent.id == agent_id))
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    return agent


def create_agent(db: Session, *, tenant_id: int, payload: AgentCreate) -> Agent:
    agent = Agent(
        tenant_id=tenant_id,
        name=payload.name.strip(),
        system_prompt=payload.system_prompt,
        model=payload.model.strip(),
        temperature=payload.temperature,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


def update_agent(
    db: Session,
    *,
    tenant_id: int,
    agent_id: int,
    payload: AgentUpdate,
) -> Agent:
    agent = get_agent(db, tenant_id=tenant_id, agent_id=agent_id)
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
    if "model" in data and data["model"] is not None:
        data["model"] = data["model"].strip()
    for field, value in data.items():
        setattr(agent, field, value)
    db.commit()
    db.refresh(agent)
    return agent


def delete_agent(db: Session, *, tenant_id: int, agent_id: int) -> None:
    agent = get_agent(db, tenant_id=tenant_id, agent_id=agent_id)
    db.delete(agent)
    db.commit()
