# SQL Generation & Optimization Project

An end-to-end system that:

- **Generates database schemas** from natural-language requirements (RAG + FAISS)
- **Generates optimized SQL queries** in multiple dialects (RAG + FAISS + reranking)
- **Executes SQL** across multiple engines (MySQL / PostgreSQL / Trino / Spark) with **project isolation** and **query analytics**
- Ships with a **Next.js + shadcn/ui** frontend for a guided workflow (projects → schema → queries → execution → analytics)

---

## What’s inside

### Backend (AI services)

- **Schema Generation API** (`backend/sql_schema_generation`)
  - Flask API on `:5001` (see `main_api.py`)
  - Uses FAISS vector store built from `data.pdf` (see `db_setup.py`)
  - Uses Groq LLM + Cohere reranking (`GROQ_API_KEY`, `COHERE_API_KEY`)
  - Supports dialects: `mysql`, `postgresql`, `trino`, `spark` (frontend may use `analytics` → mapped to `trino`)

- **SQL Query Generator API** (`backend/sql_query_generator`)
  - Flask API on `:5000` (see `faiss_main.py`)
  - Uses FAISS index built from `trino_data.md` + `trino_documentation.md` (see `faiss_ingest.py`)
  - Uses Groq LLM + optional Cohere reranking
  - Supports dialects: `trino`, `mysql`, `postgresql`, `spark` (frontend may use `analytics` → mapped to `trino`)

### Execution stack (data + execution API)

- **SQL Execution Service** (`SQL_Execution_New`)
  - Flask API on `:8000` (see `server.py`)
  - Executes queries against:
    - MySQL (`docker-compose.yml` → exposed on `localhost:3307`)
    - PostgreSQL (`localhost:5432`)
    - Trino (`localhost:8080`)
    - Spark (master UI on `localhost:8081`)
  - Redis for project context + caching (`localhost:6379`)
  - Supports **project table isolation** by prefixing table names (e.g. `proj_<id>_<table>`)

### Frontend (UI)

- **Next.js app** (`try/`)
  - Next.js (App Router) + Tailwind + **shadcn/ui** components
  - Default dev server: `http://localhost:3000`
  - Has API routes that proxy to the Python services:
    - `/api/schema/generate` → `http://localhost:5001/generate-schema`
    - `/api/query/generate` → `QUERY_SERVICE_URL` (default `http://localhost:5000`)
    - `/api/sql/execute` → `SQL_EXECUTION_URL` (default `http://localhost:8000`)
    - `/api/health` → checks all services

---

## Architecture (high level)

1. **User creates a Project** in the UI (dialect + database)
2. **Schema generation**: UI → Schema service (RAG) → returns DDL + rationale
3. **Query generation**: UI → Query service (RAG) → returns SQL + explanation + best practices
4. **Execution**: UI → SQL execution service → runs SQL on chosen engine
5. **Context & analytics**: Redis stores project metadata, schema cache, query intents, AI chat sessions

---

## Prerequisites

- **Docker + Docker Compose**
- **Python 3.10+** (3.11 recommended)
- **Node.js 18+** (for Next.js)
- API keys:
  - **Groq** (`GROQ_API_KEY`)
  - **Cohere** (`COHERE_API_KEY`)

---

## Quickstart (recommended dev workflow)

### 1) Start databases + engines (Docker)

From `SQL_Execution_New/`:

```bash
cd SQL_Execution_New
cp .env.example .env
docker compose up -d
```

This brings up: MySQL, PostgreSQL, Trino, Spark master/worker, Redis.

### 2) Run the SQL Execution API (Flask)

```bash
cd SQL_Execution_New
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

Service health: `http://localhost:8000/health`

### 3) Build the Schema FAISS index + run Schema API

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cd sql_schema_generation
# IMPORTANT: ensure `data.pdf` exists in this folder
python db_setup.py
python main_api.py
```

Service health: `http://localhost:5001/health`

### 4) Build the Query FAISS index + run Query API

```bash
cd backend
source .venv/bin/activate

cd sql_query_generator
python faiss_ingest.py
python faiss_main.py
```

Service health: `http://localhost:5000/api/health`

### 5) Run the Frontend (Next.js + shadcn/ui)

```bash
cd try
npm install
npm run dev
```

Open: `http://localhost:3000`

---

## Configuration

### Backend env vars (AI services)

Both `backend/sql_schema_generation` and `backend/sql_query_generator` expect:

- `GROQ_API_KEY`
- `COHERE_API_KEY`
- `REDIS_HOST` (default: `localhost`)
- `REDIS_PORT` (default: `6379`)

Tip: Put these in a `.env` file in the directory where you start the service (or export them).

### Frontend env vars (optional)

In `try/`, you can override where the UI proxies requests:

- `QUERY_SERVICE_URL` (default `http://localhost:5000`)
- `SQL_EXECUTION_URL` (default `http://localhost:8000`)

---

## Key API endpoints

### Schema service (`:5001`)

- `GET /health`
- `POST /generate-schema`

Example request body:

```json
{
  "requirements": "Design a schema for an e-commerce app with users, products, orders",
  "dialect": "postgresql",
  "project_id": "optional-project-id",
  "project_name": "optional",
  "existing_schema": { "tables": [] }
}
```

### Query service (`:5000`)

- `GET /api/health`
- `POST /api/sql/query` (multi-dialect, recommended)
- `POST /api/trino/query` (legacy/back-compat)

### SQL execution service (`:8000`)

- `GET /health`
- `POST /execute/mysql`
- `POST /execute/postgresql`
- `POST /execute/trino`
- `POST /execute/spark`
- CSV upload: `POST /upload-csv`
- Project context (Redis): `/api/context/...` endpoints in `server.py`

---

## Repo structure

```text
Sql-Generation-and-Optimization-Project/
  backend/
    requirements.txt
    sql_schema_generation/
      main_api.py
      db_setup.py
      schema_generator.py
    sql_query_generator/
      faiss_ingest.py
      faiss_main.py
      trino_documentation.md
      trino_data.md
  SQL_Execution_New/
    docker-compose.yml
    server.py
    .env.example
    trino/
      catalog/
        mysql.properties
        postgresql.properties
  try/
    package.json
    components.json   # shadcn/ui config
    src/
      app/
        sql-editor/
        ai-assistant/
      components/
        ui/            # shadcn/ui components
```

---

## Troubleshooting

### “Schema service says vector store unavailable”

- Ensure `backend/sql_schema_generation/data.pdf` exists
- Rebuild index:
  - `cd backend/sql_schema_generation && python db_setup.py`

### “Query service can’t load FAISS index”

- Rebuild index:
  - `cd backend/sql_query_generator && python faiss_ingest.py`

### “Frontend can’t reach services”

- Confirm ports are up:
  - Schema: `:5001`
  - Query: `:5000`
  - SQL execution: `:8000`
- Use UI health endpoint:
  - `GET http://localhost:3000/api/health`

### “Docker ports conflict”

`SQL_Execution_New/docker-compose.yml` exposes:
- MySQL `3307:3306`
- PostgreSQL `5432:5432`
- Trino `8080:8080`
- Spark UI `8081:8080`
- Redis `6379:6379`

Stop conflicting services or change the host ports.

---

## Disclaimer

This project can generate and execute SQL. **Do not point it at production databases** without proper authentication, authorization, and safety controls (read-only roles, allowlists, query limits, audit logs).

