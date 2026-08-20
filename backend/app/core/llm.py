from langchain_openai import ChatOpenAI

from app.core.config import settings


def build_chat_model(*, model: str, temperature: float) -> ChatOpenAI:
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not set")
    return ChatOpenAI(
        model=model,
        temperature=temperature,
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
        max_tokens=2048,
        default_headers={
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "Mini Agent Platform",
        },
    )
