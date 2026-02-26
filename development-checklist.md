# HQBMS Development Checklist

This document tracks the implementation progress of the HQBMS platform across the 3 planned 3-day sprints.

## Sprint 1: Supabase Foundation + Bed Management (Days 1–3)

### Infrastructure & Database
- [x] Initialize Next.js 14 App Router project (`apps/web`).
- [x] Initialize Python FastAPI project (`ml_service`).
- [x] Finalize `docker-compose.yml` (Supabase, Postgres, Next.js, FastAPI, Redis, Ollama, Novu).
- [x] Apply SQL Migrations (`health_units`, `beds`, `patients`, `admissions`, `users`).
- [x] Apply Row Level Security (RLS) policies for all tables.
- [x] Configure `check_occupancy_threshold` PostgreSQL trigger function.
- [x] Configure `log_bed_changes` Audit PostgreSQL trigger function.

### Authentication & Authorization
- [x] Configure Supabase GoTrue Auth.
- [x] Implement JWT custom claims hook (`hospital_id`, `role`).
- [x] Build Login / Authentication UI flow in Next.js.
- [x] Set up protected route middleware in Next.js.

### Bed Management Features
- [x] Build visual Bed Grid component (Green/Red/Yellow indicators).
- [x] Implement Supabase Realtime channel subscription for `beds` table.
- [x] Build Patient Admission / Discharge modal linked to beds.
- [x] Build Dashboard Occupancy pie charts (Apache ECharts).
- [x] Connect Novu webhook to fire on 85% occupancy threshold.

## Sprint 2: Queue Management + Moving Average (Days 4–6)

### OPD Queue Engine
- [ ] Apply SQL Migrations (`departments`, `queue_entries`).
- [ ] Apply RLS for queue tables.
- [ ] Build Public OPD Check-in form (`/checkin`).
- [ ] Implement `/api/v1/queue/checkin` to generate physical tokens (e.g., A47).
- [ ] Build Patient Queue Tracking view (`/queue/[token]`) with live Supabase Realtime updates.

### Queue Advancing & Cache (Redis)
- [ ] Build Doctor Dashboard (Queue List).
- [ ] Implement Doctor Action: "Call Next" (`started_at`).
- [ ] Implement Doctor Action: "Complete" (`ended_at`).
- [ ] Implement Doctor Action: "Missed" (Penalty re-queue).
- [ ] Build Node.js Redis moving average service (`RPUSH` / `LTRIM`).
- [ ] Wire completion webhook to update Redis `queue:{deptId}:avg` and broadcast via Realtime.

## Sprint 3: ML Prediction + RAG Assistant + DevOps (Days 7–9)

### Machine Learning Satellite (FastAPI)
- [ ] Write `train.py` (pandas feature extraction: 8 features).
- [ ] Train `scikit-learn` GBDT/RF model & pickle via `joblib`.
- [ ] Expose `POST /predict/waittime` FastAPI endpoint.
- [ ] Implement Hybrid formula (0.6 ML + 0.4 Moving Average).
- [ ] Integrate FastAPI prediction endpoint into the Patient Queue Tracker UI.

### RAG Assistant (LangChain + Ollama)
- [ ] Set up `pgvector` extension and `documents` table + HNSW index.
- [ ] Write `match_documents` RPC function.
- [ ] Build `POST /rag/ingest` FastAPI endpoint for PDF chunking (`nomic-embed-text`).
- [ ] Build `POST /rag/query` RetrievalQA chain (`llama3:8b`).
- [ ] Build Staff Chat widget UI floating button in Next.js.

### Notifications & DevOps
- [ ] Set up Novu SMS gateway (Termii/MSG91) for "Position 3" alerts.
- [ ] Configure GitHub Actions CI pipeline (Lint, Test, Docker Build).
- [ ] Configure Trivy security scans in CI.
- [ ] Setup Grafana, Prometheus, Loki in Docker Compose.
- [ ] Setup GlitchTip for exception tracking.
