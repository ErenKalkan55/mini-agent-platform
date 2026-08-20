# Mini Agent Platform

Staj projesi: JWT auth, tenant izolasyonu, agent CRUD, LangGraph agent + tool'lar.

## Yapi

- `backend/` — FastAPI API
- `frontend/` — basit arayuz

## Fazlar

1. Iskelet: auth, tenant, agent CRUD
2. Agent: LangGraph chat + tool'lar (bu dal)
3. DevOps: Docker Compose

`.env` icinde `OPENROUTER_API_KEY` dolu olmali. Chat, agent kaydindaki system_prompt / model / temperature kullanir.
Her agent `get_current_time` ve `calculator` sistem tool'larina sahiptir. Kullanici HTTP tool ekleyebilir.
Redis opsiyoneldir: agent promptu ve HTTP tool listesi cache'lenir. Kaynak yine Postgres'tir; agent/tool degisince cache silinir. `REDIS_URL` bos veya Redis kapaliysa uygulama DB ile devam eder.

## Lokal kurulum (Faz 1)

1. `.env.example` dosyasini kopyalayip `.env` yapin.
2. Virtualenv aktifken paketleri yukleyin:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
```

3. Postgres ve Redis'i baslatin:

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

Agent endpoint'leri (JWT gerekir):

- `POST /api/v1/agents` — name, system_prompt, model, temperature
- `GET /api/v1/agents` — tenant'a ait liste
- `GET /api/v1/agents/{id}`
- `PATCH /api/v1/agents/{id}`
- `DELETE /api/v1/agents/{id}`
- `POST /api/v1/agents/{id}/chat` — message, istege bagli conversation_id; JWT gerekir
- `GET /api/v1/agents/{id}/conversations/{conversation_id}/messages`
- `GET /api/v1/system-tools`
- `GET /api/v1/agents/{id}/tools`
- `POST /api/v1/agents/{id}/tools` — name, description, method, url, argument_schema
- `DELETE /api/v1/agents/{id}/tools/{tool_id}`
- Swagger: http://127.0.0.1:8000/docs

5. Arayuz (ayri terminal):

```bash
cd frontend
npm install
npm run dev
```

Tarayici: http://127.0.0.1:5173
Login ve kayit ayni kartta. Agent olusturma / liste / silme giris sonrasi acilir.
Agent satirindaki Chat ile sohbet baslar; mesajlar veritabanina kaydolur.
Tool paneli: sistem tool'lari her zaman aciktir. HTTP tool eklemek icin name, description, GET/POST ve URL yeter. URL icinde `{city}` gibi yer tutucu, argument_schema ile eslesir.
