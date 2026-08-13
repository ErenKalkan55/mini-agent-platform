# Mini Agent Platform

Staj projesi: JWT auth, tenant izolasyonu, agent CRUD, LangGraph agent + tool'lar.

## Yapi

- `backend/` — FastAPI API
- `frontend/` — basit arayuz

## Fazlar

1. Iskelet: auth, tenant, agent CRUD
2. Agent: LangGraph chat, tool'lar
3. DevOps: Docker Compose

## Lokal kurulum (Faz 1)

1. `.env.example` dosyasini kopyalayip `.env` yapin.
2. Virtualenv aktifken paketleri yukleyin:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
```

3. Postgres'i baslatin:

```bash
docker compose up -d
```

4. Migration ve API (`backend` klasorunden):

```bash
cd backend
alembic upgrade head
uvicorn app.main:app --reload
```

Auth endpoint'leri:

- `POST /api/v1/auth/register` — email, password, tenant_name
- `POST /api/v1/auth/login` — email, password; JWT doner
- `GET /api/v1/auth/me` — Authorization: Bearer <token>
- Swagger: http://127.0.0.1:8000/docs
