# HQBMS — Architecture Document
**Hospital Queue & Bed Management System**
> Version 2.0 | Supabase + Open-Source Stack | Senior Software Development Team

---

## 1. Executive Overview

This document defines the complete system architecture for **HQBMS** (Hospital Queue & Bed Management System), rebuilt entirely on **Supabase** as the unified backend platform. Supabase provides PostgreSQL, real-time subscriptions, Row Level Security, storage, and authentication — all open-source and self-hostable. Every tool in the stack is open-source or free-tier compatible, enabling **zero-licence-cost deployments** for public hospitals.

---

## 2. Open-Source Stack Overview

| Layer | Open-Source Tool | Version | Replaces / Purpose |
|---|---|---|---|
| Frontend Framework | Next.js 14 (App Router) | 14.x | React SSR + API routes |
| UI Components | shadcn/ui + Tailwind CSS | latest | Design system, zero cost |
| State / Data Fetching | TanStack Query + Zustand | 5.x / 4.x | Server state + UI state |
| Real-Time Client | Supabase JS Client (Realtime) | 2.x | WebSocket subscriptions |
| Charts / Analytics | Apache ECharts | 5.x | Dashboards, occupancy graphs |
| Backend Database | Supabase (PostgreSQL 15) | latest | Primary RDBMS + RLS |
| Auth / Identity | Supabase Auth (GoTrue) | built-in | JWT + RBAC, replaces Keycloak |
| Real-Time Engine | Supabase Realtime (Phoenix) | built-in | Replaces Kafka for live updates |
| File Storage | Supabase Storage (S3-compatible) | built-in | PDF reports, SOP documents |
| Cache / Queue | Redis (Upstash free tier) | 7.x | Rolling queue state, MA algorithm |
| ML Service | Python FastAPI + scikit-learn | 0.111 / 1.4 | Wait time prediction microservice |
| RAG Engine | Ollama + LangChain + pgvector | latest | Self-hosted LLM + vector search |
| Vector Store | pgvector (Supabase extension) | 0.7 | RAG embeddings inside Postgres |
| API Gateway | Traefik (open-source) | 3.x | Routing, SSL, rate limiting |
| Containerization | Docker + Docker Compose | 25.x | Local + production deployment |
| Orchestration | Kubernetes (K3s lightweight) | 1.29 | Production scaling |
| CI/CD | GitHub Actions + ArgoCD | free tier | Build, test, deploy pipeline |
| Monitoring | Grafana + Prometheus + Loki | 10.x | Metrics, logs, alerts |
| Error Tracking | GlitchTip (open-source Sentry) | latest | Error aggregation |
| Notifications | Novu (open-source) | 1.x | SMS, email, push orchestration |
| SMS Gateway | Self-hosted MSG91 / Termii | — | Patient alerts |

---

## 3. Architecture Style

The system uses a **Supabase-centric monolith** for core hospital data combined with lightweight separate microservices only for AI workloads (ML prediction, RAG). This **"Majestic Monolith + AI Satellites"** pattern reduces operational complexity while allowing independent scaling of compute-heavy AI components.

---

## 4. Layer-by-Layer Architecture

### 4.1 Presentation Layer — Next.js 14

- App Router with Server Components for fast SSR dashboard loading
- Client Components only for interactive elements (bed grid, queue tracker)
- Supabase JS client initialized once per session; real-time subscriptions managed via `useEffect` hooks
- Tailwind CSS + shadcn/ui for accessible, consistent UI across Admin and Patient views
- Apache ECharts for bed occupancy donut charts, wait-time trend lines, department heatmaps

### 4.2 Supabase Backend Platform

Supabase serves as the unified backend, replacing separate services for auth, database, real-time, and storage:

| Supabase Feature | HQBMS Usage | Config Detail |
|---|---|---|
| PostgreSQL 15 | All transactional data: beds, patients, admissions, queues | Primary persistent store |
| Row Level Security (RLS) | Policy-enforced data access per role | `hospital_id` isolation per row |
| Supabase Auth (GoTrue) | User signup, login, JWT tokens, role claims | Roles in JWT: admin/staff/patient |
| Realtime (Phoenix Channels) | Live bed status updates, queue position broadcasts | Subscribe: `supabase.channel('beds')` |
| Supabase Storage | SOP PDFs for RAG ingestion, exported reports | Bucket: `hospital-docs` (private) |
| Edge Functions (Deno) | Lightweight business logic, webhook handlers | Notification triggers on DB events |
| pgvector extension | RAG document embeddings stored in Postgres | Vector similarity search (HNSW index) |
| Database Webhooks | Trigger Novu notifications on bed/queue events | `POST` to `/api/webhooks/notify` |

### 4.3 AI / ML Layer — Python FastAPI

- Separate containerized Python service; stateless; horizontally scalable
- scikit-learn GBDT and Random Forest models for wait-time prediction
- Joblib model serialization stored in Supabase Storage bucket: `ml-models`
- **Ollama** (self-hosted LLaMA 3 8B or Mistral 7B) for RAG LLM inference — fully offline, no API costs
- LangChain RetrievalQA chain with pgvector (via psycopg2) as retriever
- Embeddings: `nomic-embed-text` via Ollama (no OpenAI dependency)

### 4.4 Real-Time Event Flow

All real-time updates flow through **Supabase Realtime**, eliminating Kafka from the stack. Supabase broadcasts PostgreSQL change events (CDC) directly to subscribed frontend clients:

| Event | DB Table Change | Supabase Channel | Frontend Action |
|---|---|---|---|
| Bed status updated | `UPDATE beds SET status=...` | `beds:unit_id=eq.{id}` | Grid cell color changes live |
| Patient admitted | `INSERT INTO admissions` | `admissions:unit_id=eq.{id}` | Occupancy counter increments |
| Queue entry added | `INSERT INTO queue_entries` | `queue:{dept_id}` | Queue list appends new row |
| Consultation complete | `UPDATE queue_entries SET ended_at=...` | `queue:{dept_id}` | Estimates recalculate for all |
| Bed threshold crossed | Triggered by DB Function | `alerts:{unit_id}` | Admin toast notification fires |

---

## 5. Deployment Architecture

### 5.1 Self-Hosted Supabase (Production)

For data-sovereign hospital deployments, Supabase is self-hosted using the official Docker Compose stack:

```bash
git clone https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env   # configure POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY
docker compose up -d   # starts Kong, GoTrue, PostgREST, Realtime, Storage, Meta
```

- Expose via **Traefik** reverse proxy with Let's Encrypt TLS
- Backup: `pg_dump` scheduled daily via GitHub Actions → upload to S3-compatible storage

### 5.2 Infrastructure Diagram

```
  [Patient Browser / Mobile PWA]
         |  HTTPS
  [Traefik Reverse Proxy + SSL]
    |              |              |
  [Next.js]   [FastAPI ML]  [Novu Notifications]
    |              |
  [Supabase Self-Hosted]
    ├── PostgreSQL 15 + pgvector
    ├── GoTrue Auth
    ├── Realtime Phoenix
    ├── Storage
    └── Edge Functions
         |
  [Redis (Upstash)]   [Ollama LLM]   [Prometheus + Grafana]
```

---

## 6. Security Architecture

| Concern | Solution | Open-Source Tool |
|---|---|---|
| Authentication | JWT via Supabase GoTrue; refresh token rotation | Supabase Auth (GoTrue) |
| Authorization | PostgreSQL Row Level Security policies per role | Supabase RLS |
| Patient PII Encryption | pgcrypto extension; `encrypt()` at column level | pgcrypto (built into PG) |
| Transport Security | TLS 1.3 via Traefik + Let's Encrypt | Traefik + cert-manager |
| API Rate Limiting | Traefik middleware: 100 req/min per IP | Traefik rate limit plugin |
| Audit Logging | PostgreSQL trigger on all write operations | Custom PG trigger function |
| Secrets Management | Docker secrets + `.env`; HashiCorp Vault for prod | Vault (open-source) |
| Vulnerability Scanning | Trivy on Docker images in CI pipeline | Trivy (Aqua Security OSS) |
