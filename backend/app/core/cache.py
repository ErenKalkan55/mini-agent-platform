import json
import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    import redis
except ImportError:
    redis = None

TTL_SECONDS = 300
_client: Any = None
_warned = False


def agent_cache_key(tenant_id: int, agent_id: int) -> str:
    return f"tenant:{tenant_id}:agent:{agent_id}"


def tools_cache_key(tenant_id: int, agent_id: int) -> str:
    return f"tenant:{tenant_id}:agent:{agent_id}:tools"


def _redis() -> Any:
    global _client
    if redis is None or not settings.REDIS_URL:
        return None
    if _client is None:
        _client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
        )
    return _client


def _warn(exc: Exception) -> None:
    global _warned
    if not _warned:
        logger.warning("Redis cache skipped: %s", exc)
        _warned = True


def cache_get(key: str) -> Any | None:
    client = _redis()
    if client is None:
        return None
    try:
        raw = client.get(key)
    except Exception as exc:
        _warn(exc)
        return None
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def cache_set(key: str, value: Any) -> None:
    client = _redis()
    if client is None:
        return
    try:
        client.set(key, json.dumps(value), ex=TTL_SECONDS)
    except Exception as exc:
        _warn(exc)


def cache_delete(*keys: str) -> None:
    client = _redis()
    if client is None or not keys:
        return
    try:
        client.delete(*keys)
    except Exception as exc:
        _warn(exc)


def invalidate_agent(tenant_id: int, agent_id: int) -> None:
    cache_delete(
        agent_cache_key(tenant_id, agent_id),
        tools_cache_key(tenant_id, agent_id),
    )
