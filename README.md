# Mini Agent Platform

Staj projesi: JWT auth, tenant izolasyonu, agent CRUD, LangGraph sohbet ve tool'lar.

## Yapi

- `backend/` — FastAPI API
- `frontend/` — React arayuz
- `docker-compose.yml` — backend, frontend, postgres, redis

`.env` icinde `OPENROUTER_API_KEY` dolu olmali. Chat, agent kaydindaki system_prompt / model / temperature / system_tools kullanir.
Agent olusturulurken sistem tool'lari secilir (`get_current_time`, `calculator`); HTTP tool sonradan eklenir.
Redis opsiyoneldir: agent promptu ve HTTP tool listesi cache'lenir. Kaynak yine Postgres'tir; agent/tool degisince cache silinir. `REDIS_URL` bos veya Redis kapaliysa uygulama DB ile devam eder.

Kisa sureli hafiza son 20 user/assistant mesajini LLM'e tasir. Daha eski turlar sessizce dusurulur; tool izleri ve token sayilari veritabaninda kalir. HTTP tool URL'leri localhost / ozel ag adreslerine acilmaz.

## Docker ile calistirma

1. `.env.example` dosyasini kopyalayip `.env` yapin. `OPENROUTER_API_KEY` ve `SECRET_KEY` degerlerini doldurun. `.env` GitHub'a commitlenmez; imaja da kopyalanmaz.

```bash
copy .env.example .env
```

2. Dort servisi birlikte derleyip acin (repo kokunden):

```bash
docker compose up --build
```

Tarayici: http://127.0.0.1:5173
Swagger: http://127.0.0.1:8000/docs

Backend acilirken `alembic upgrade head` calisir, sonra uvicorn baslar.

Durdurmak icin `Ctrl+C`, arkada birakmak icin `docker compose up --build -d`.

## Ortam degiskenleri

Degerler `.env` dosyasindan okunur.

| Degisken | Ne ise yarar |
|---|---|
| `DATABASE_URL` | Postgres baglantisi (lokal uvicorn: `localhost`) |
| `SECRET_KEY` | JWT imzasi |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token suresi, varsayilan 30 |
| `OPENROUTER_API_KEY` | Dil modeli anahtari |
| `OPENROUTER_BASE_URL` | OpenRouter adresi |
| `DEFAULT_MODEL` | Varsayilan model adi |
| `REDIS_URL` | Redis; bos birakilirsa cache atlanir |
| `ALLOWED_ORIGINS` | CORS; virgulle origin listesi |

Compose icindeki backend, `DATABASE_URL` ve `REDIS_URL` icin servis adlarini (`postgres`, `redis`) kullanir. Boylece konteyner `localhost`e bakmaz.

## Lokal gelistirme

Sadece veritabanini Docker'da acip API ve arayuzu kendi makinede calistirmak:

```bash
docker compose up -d postgres redis
```

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
cd backend
alembic upgrade head
uvicorn app.main:app --reload
```

Ayrı terminal:

```bash
cd frontend
npm install
npm run dev
```

Tarayici yine http://127.0.0.1:5173

## API

Auth:

- `POST /api/v1/auth/register` — email, password, tenant_name
- `POST /api/v1/auth/login` — email, password; JWT doner
- `GET /api/v1/auth/me` — Authorization: Bearer <token>

Agent (JWT gerekir):

- `POST /api/v1/agents` — name, system_prompt, model, temperature, system_tools
- `GET /api/v1/agents`
- `GET /api/v1/agents/{id}`
- `PATCH /api/v1/agents/{id}`
- `DELETE /api/v1/agents/{id}`
- `POST /api/v1/agents/{id}/chat`
- `GET /api/v1/agents/{id}/conversations`
- `GET /api/v1/agents/{id}/conversations/{conversation_id}/messages`
- `GET /api/v1/system-tools`
- `GET /api/v1/agents/{id}/tools`
- `POST /api/v1/agents/{id}/tools`
- `DELETE /api/v1/agents/{id}/tools/{tool_id}`

Login ve kayit ayni kartta. Agent olusturma / duzenleme / liste / silme giris sonrasi acilir.
Agent satirindaki Chat ile sohbet baslar; mesajlar veritabanina kaydolur.
Onceki konusmalar listeden acilir; New conversation yeni sohbet baslatir.
Tool paneli: secilen sistem tool'lari acilip kapatilir. HTTP tool eklemek icin name, description, GET/POST ve URL yeter. URL icinde `{city}` gibi yer tutucu, argument_schema ile eslesir.
