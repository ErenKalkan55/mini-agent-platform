from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.cache import (
    agent_cache_key,
    cache_get,
    cache_set,
    invalidate_agent,
)
from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentUpdate
from app.services.errors import NotFoundError


def _tenant_query(tenant_id: int):
    return select(Agent).where(Agent.tenant_id == tenant_id)


def _agent_payload(agent: Agent) -> dict:
    return {
        "id": agent.id,
        "tenant_id": agent.tenant_id,
        "name": agent.name,
        "system_prompt": agent.system_prompt,
        "model": agent.model,
        "temperature": agent.temperature,
    }


def list_agents(db: Session, *, tenant_id: int) -> list[Agent]:
    return list(db.scalars(_tenant_query(tenant_id).order_by(Agent.id)).all())


def get_agent(
    db: Session,
    *,
    tenant_id: int,
    agent_id: int,
) -> Agent:
    agent = db.scalar(_tenant_query(tenant_id).where(Agent.id == agent_id))
    if agent is None:
        raise NotFoundError("Agent not found")
    cache_set(agent_cache_key(tenant_id, agent_id), _agent_payload(agent))
    return agent


def get_agent_config(db: Session, *, tenant_id: int, agent_id: int) -> dict:
    cached = cache_get(agent_cache_key(tenant_id, agent_id))
    if isinstance(cached, dict) and cached.get("id") == agent_id:
        return cached
    return _agent_payload(get_agent(db, tenant_id=tenant_id, agent_id=agent_id))


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
    invalidate_agent(tenant_id, agent_id)
    return agent


def delete_agent(db: Session, *, tenant_id: int, agent_id: int) -> None:
    agent = get_agent(db, tenant_id=tenant_id, agent_id=agent_id)
    db.delete(agent)
    db.commit()
    invalidate_agent(tenant_id, agent_id)
