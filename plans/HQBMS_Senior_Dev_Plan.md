# 🏥 HQBMS — Senior Developer Development Plan
### Hospital Queue & Bed Management System
**Version 1.0 | Open-Source Stack | Supabase-Powered**

> **Stack:** Next.js 14 · Supabase · PostgreSQL · Redis · FastAPI · Ollama · pgvector  
> **Sprint Duration:** 9 Days (3 Sprints × 3 Days) · Open-Source Only · Self-Hostable

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement & Business Justification](#2-problem-statement--business-justification)
3. [System Architecture](#3-system-architecture)
4. [Database Schema & Security Design](#4-database-schema--security-design)
5. [Sprint Plan (9 Days)](#5-sprint-plan-9-days)
6. [Algorithm & AI Design](#6-algorithm--ai-design)
7. [API Contracts](#7-api-contracts)
8. [Caching Strategy & Resilience Design](#8-caching-strategy--resilience-design)
9. [Testing Strategy](#9-testing-strategy)
10. [DevOps & Deployment Strategy](#10-devops--deployment-strategy)
11. [Security Architecture](#11-security-architecture)
12. [Feature Priority Matrix](#12-feature-priority-matrix)
13. [Risk Register & Mitigation](#13-risk-register--mitigation)
14. [Success Metrics](#14-success-metrics)

---

## 1. Executive Summary

HQBMS is a fully open-source, Supabase-powered hospital operations platform. The system provides real-time bed occupancy management, AI-predicted OPD queue wait times, and an RAG-based SOP assistant. The entire stack runs on-premise with zero proprietary licence costs, making it viable for resource-constrained public hospitals.

This document serves as the authoritative engineering reference for the senior development team, covering architecture decisions, sprint-level task breakdowns, database schemas, algorithm implementations, testing strategy, DevOps pipelines, and risk mitigation.

| Dimension | Detail |
|---|---|
| Project Name | HQBMS — Hospital Queue & Bed Management System |
| Architecture Pattern | Majestic Monolith + AI Satellites (Next.js core + FastAPI microservices) |
| MVP Timeline | 9 days across 3 sprints |
| Primary Backend | Supabase (PostgreSQL 15 + GoTrue Auth + Realtime + Storage) |
| AI/ML Layer | FastAPI + scikit-learn (GBDT/RF) + Ollama (LLaMA3) + pgvector |
| Deployment | Docker Compose (dev) → K3s/Kubernetes (production) |
| Licence Model | 100% open-source — Apache 2.0, MIT, BSD, AGPL |
| Target Scale | 500+ concurrent users per hospital deployment |

---

## 2. Problem Statement & Business Justification

Current hospital operations rely on phone calls and paper records for bed management, creating 15+ minute delays per status inquiry. OPD patients have no visibility into wait times, leading to crowded waiting areas and missed appointments. The absence of an AI-assisted SOP reference system results in 5–10 minute delays per protocol lookup during critical incidents.

| Problem | Affected Users | Current Impact | Target Improvement |
|---|---|---|---|
| No real-time bed visibility | Admin, Charge Nurse | 15+ min delay per inquiry | < 30 seconds |
| Unpredictable OPD waiting | Patient | 30–45 min wasted per visit | −20% actual wait time |
| Manual paper admissions | Clinical Staff | ~15 min entry per patient | Automated via web form |
| No AI wait prediction | Patient, Doctor | 47% higher MAE vs ML | MAE < 15 minutes |
| No SOP quick reference | All Staff | 5–10 min lookup delay | < 30 seconds via RAG |
| Data siloed per hospital | State Admin | No aggregate view | Multi-unit dashboard |

---

## 3. System Architecture

### 3.1 Architecture Pattern: Majestic Monolith + AI Satellites

The core hospital data operations (bed management, queue tracking, admissions, auth) live inside a Next.js 14 + Supabase monolith. This eliminates microservice overhead for the business-critical path. Only computationally intensive AI workloads (ML predictions, RAG LLM inference) are extracted into separate Python FastAPI containers. This balances operational simplicity with the ability to independently scale GPU-heavy AI components.

### 3.2 Full Stack Overview

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend Framework | Next.js 14 (App Router) | 14.x | SSR + API Routes + Client Components |
| UI Components | shadcn/ui + Tailwind CSS | latest | Accessible design system, zero cost |
| Charts | Apache ECharts | 5.x | Bed occupancy & queue dashboards |
| State Management | TanStack Query + Zustand | 5.x / 4.x | Server state + UI state |
| Database | Supabase (PostgreSQL 15) | latest | Primary RDBMS + RLS + pgvector |
| Auth | Supabase GoTrue | built-in | JWT + RBAC, replaces Keycloak |
| Real-Time | Supabase Realtime (Phoenix) | built-in | CDC-based live updates |
| Storage | Supabase Storage (S3-compatible) | built-in | PDFs, SOP docs, ML artifacts |
| Cache | Redis (Upstash) | 7.x | Moving average queue state |
| ML Service | Python FastAPI + scikit-learn | 0.111 / 1.4 | Wait-time prediction microservice |
| RAG LLM | Ollama + LangChain + pgvector | latest | Self-hosted LLaMA3, no API costs |
| Notifications | Novu (self-hosted) | 1.x | SMS, email, push orchestration |
| SMS Gateway | Termii / MSG91 | — | Patient queue alerts |
| API Gateway | Traefik | 3.x | Routing, SSL, rate limiting |
| Monitoring | Grafana + Prometheus + Loki | 10.x | Metrics, logs, alerting |
| Error Tracking | GlitchTip (OSS Sentry) | latest | Exception aggregation |
| CI/CD | GitHub Actions + ArgoCD | free | Build, test, deploy pipeline |
| Container Orchestration | Docker Compose → K3s | 25.x / 1.29 | Dev + production deployment |

### 3.3 Infrastructure Diagram

```
  [Patient Browser / Mobile PWA]
           │  HTTPS
  [Traefik Reverse Proxy + SSL]
      │              │              │
  [Next.js]   [FastAPI ML]   [Novu Notifications]
      │              │
  [Supabase Self-Hosted]
      ├── PostgreSQL 15 + pgvector
      ├── GoTrue Auth
      ├── Realtime Phoenix
      ├── Storage
      └── Edge Functions
           │
  [Redis]   [Ollama LLM]   [Prometheus + Grafana]
```

### 3.4 Real-Time Event Architecture

All real-time updates flow through Supabase Realtime (PostgreSQL WAL → Phoenix Channels → WebSockets), eliminating the need for Kafka or custom pub/sub infrastructure. The frontend subscribes to table-scoped channels and patches TanStack Query cache on incoming CDC payloads.

| DB Event | Table | Supabase Channel | Frontend Effect |
|---|---|---|---|
| Bed status changed | `UPDATE beds` | `beds:unit_id=eq.{id}` | Grid cell color updates live |
| Patient admitted | `INSERT admissions` | `admissions:unit_id=eq.{id}` | Occupancy counter increments |
| Queue entry added | `INSERT queue_entries` | `queue:{dept_id}` | New row appended to list |
| Consultation complete | `UPDATE queue_entries (ended_at)` | `queue:{dept_id}` | Wait estimates recalculate |
| Occupancy ≥ 85% | PG Function trigger | `alerts:{unit_id}` | Admin toast + Novu alert fires |

#### Supabase Realtime Subscription Pattern

```typescript
const channel = supabase
  .channel('beds-unit-' + unitId)
  .on('postgres_changes', {
    event: 'UPDATE', schema: 'public', table: 'beds',
    filter: `unit_id=eq.${unitId}`
  }, (payload) => {
    queryClient.setQueryData(['beds', unitId], (old) =>
      old.map(b => b.id === payload.new.id ? payload.new : b)
    );
  }).subscribe();
```

---

## 4. Database Schema & Security Design

### 4.1 Table Inventory

| Table | Primary Key | Key Columns | RLS Policy |
|---|---|---|---|
| `health_units` | UUID | name, type, municipality, state | Admin: all; Staff: own unit |
| `beds` | UUID | unit_id(FK), bed_code, type, status, blocked_reason | Staff: unit_id match |
| `patients` | UUID | name_enc, dob_enc, gender, municipality (PII encrypted) | Staff: unit scope |
| `admissions` | UUID | patient_id, bed_id, admitted_at, discharged_at, status | Staff: unit scope |
| `departments` | UUID | unit_id(FK), name, category, open_from, open_to | Staff: unit scope |
| `queue_entries` | UUID | patient_id, dept_id, registered_at, started_at, ended_at, missed | Staff: dept; Own: patient |
| `appointments` | UUID | patient_id, dept_id, slot_start, slot_end, status | Self; Staff: dept |
| `users` | UUID | email_enc, role, hospital_id, last_login | Self only; Admin: all |
| `audit_logs` | UUID | user_id, action, entity, entity_id, old_json, new_json, ts | Admin read-only |
| `documents` | UUID | content, embedding(vector 768), metadata_json | Staff: read; Admin: write |
| `notifications_log` | UUID | user_id, channel, message, sent_at, status | Self only |

### 4.2 Core SQL Schema

```sql
-- health_units
CREATE TABLE health_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, type TEXT, municipality TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- beds
CREATE TABLE beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES health_units(id),
  bed_code TEXT, type TEXT,     -- ICU | semi-ICU | ward
  status TEXT DEFAULT 'free',   -- free | occupied | blocked
  blocked_reason TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- queue_entries
CREATE TABLE queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  dept_id UUID REFERENCES departments(id),
  registered_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  missed BOOLEAN DEFAULT false,
  visit_type TEXT  -- appointment | walkin
);
```

### 4.3 Security: Row Level Security (RLS) Policies

RLS is enabled on 100% of tables. Staff members can only query data within their assigned `hospital_id` JWT claim. Patient PII (name, DOB) is encrypted at rest using pgcrypto column-level encryption.

```sql
-- Staff can only access beds belonging to their hospital
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
CREATE POLICY 'staff_unit_access_beds' ON beds FOR ALL USING (
  unit_id = (SELECT hospital_id FROM users WHERE id = auth.uid())
);

-- Admins and State Admins can read all unit stats
CREATE POLICY 'admin_read_all' ON health_units FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
          AND role IN ('admin', 'state_admin'))
);
```

### 4.4 Audit Trigger

```sql
CREATE OR REPLACE FUNCTION log_bed_changes()
RETURNS TRIGGER AS $$ BEGIN
  INSERT INTO audit_logs(user_id, action, entity, entity_id, old_json, new_json, ts)
  VALUES (auth.uid(), TG_OP, 'beds', NEW.id, row_to_json(OLD), row_to_json(NEW), now());
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER bed_audit AFTER UPDATE ON beds
  FOR EACH ROW EXECUTE FUNCTION log_bed_changes();
```

### 4.5 pgvector RAG Configuration

Embeddings are stored directly in PostgreSQL via the pgvector extension, eliminating the need for an external vector database (no Pinecone, no Weaviate). An HNSW index provides sub-millisecond cosine similarity search.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding VECTOR(768),  -- nomic-embed-text = 768 dimensions
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for fast similarity search
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- RPC function used by LangChain SupabaseVectorStore
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(768), match_count INT DEFAULT 5)
RETURNS TABLE(id UUID, content TEXT, metadata JSONB, similarity FLOAT)
LANGUAGE SQL AS $$
  SELECT id, content, metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM documents ORDER BY similarity DESC LIMIT match_count;
$$;
```

### 4.6 Indexing Strategy

```sql
-- Beds: frequent occupancy filter
CREATE INDEX idx_beds_unit_status ON beds(unit_id, status);

-- Admissions: current occupants (partial index)
CREATE INDEX idx_admissions_active ON admissions(bed_id)
  WHERE discharged_at IS NULL;

-- Queue: active queue per department (partial index)
CREATE INDEX idx_queue_active ON queue_entries(dept_id, registered_at)
  WHERE ended_at IS NULL;

-- Audit logs: compliance queries
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id, ts DESC);
```

---

## 5. Sprint Plan (9 Days)

### Sprint 1 (Days 1–3): Supabase Foundation + Bed Management

**Goal:** Establish the open-source backend core and deliver a live, real-time bed dashboard with color-coded status and RBAC-secured access.

| Day | Task | Owner | Deliverable |
|---|---|---|---|
| Day 1 | Provision Supabase (cloud or self-hosted `docker compose`). Run migrations for `health_units`, `beds`, `patients`, `admissions`, `users`. | Backend Lead | Working Supabase instance + schema applied |
| Day 1 | Enable RLS on all tables. Write `staff_unit_access` and `admin_read_all` policies. | Backend Lead | RLS enforced with test queries |
| Day 1 | Configure Supabase GoTrue auth. Add custom JWT claims: `hospital_id`, `role` via GoTrue hook. | Backend Lead | Login returns JWT with role + hospital_id |
| Day 2 | Scaffold Next.js 14 App Router project. Install: shadcn/ui, Tailwind, TanStack Query, Supabase JS client. | Frontend Lead | Running dev server at localhost:3000 |
| Day 2 | Build Login page with `supabase.auth.signInWithPassword()`. Store JWT in httpOnly cookie via `@supabase/ssr`. | Frontend Lead | Login/logout flow working |
| Day 2 | Build Bed Grid component: TanStack Query for initial fetch + `supabase.channel()` for live diffs. | Frontend Lead | Grid shows color-coded beds (green/red/yellow) |
| Day 3 | Create audit trigger: `log_bed_changes()` fires on every UPDATE to beds. Write to `audit_logs`. | Backend Lead | Every bed change logged with old/new JSON |
| Day 3 | Implement occupancy threshold `check_occupancy_threshold()` PG function. Webhook to Novu when ≥ 85%. | Backend Lead | Novu alert fires at 85% occupancy |
| Day 3 | Add ECharts donut occupancy stats card. Wire Realtime subscription to TanStack Query cache patch. | Frontend Lead | Live dashboard auto-updates across browsers |

---

### Sprint 2 (Days 4–6): Queue Management + Moving Average Estimator

**Goal:** Deliver the public OPD queue system with a highly responsive, locally calculated wait time estimator powered by Redis moving average.

| Day | Task | Owner | Deliverable |
|---|---|---|---|
| Day 4 | Add `departments` and `queue_entries` tables to Supabase. Apply RLS policies. | Backend Lead | Tables migrated and secured |
| Day 4 | Build public `/checkin` page: dept selection, patient info form, `POST /api/queue/checkin`. Returns token A47-style. | Frontend Lead | Patient can check-in via QR scan |
| Day 4 | Implement Redis moving average algorithm: `RPUSH`/`LTRIM` window of 5, `SET avg EX 3600`. | Backend Lead | Redis stores rolling avg per dept |
| Day 5 | Build Doctor Dashboard: Call Next / Complete / Missed buttons. `PATCH /api/queue/:id/complete` updates `ended_at` + Redis window. | Frontend Lead | Doctor can advance queue; Redis updates |
| Day 5 | Build patient `/queue/[token]` tracker page: live position + estimated wait via Supabase Realtime. | Frontend Lead | Patient sees real-time position updates |
| Day 5 | Set up Novu self-hosted. Configure Termii SMS channel. Trigger SMS at queue position 3. | Backend Lead | SMS alert sent at position 3 |
| Day 6 | Implement missed turn logic: mark `missed=true`, re-insert at penalty position (append with lower priority). | Backend Lead | Missed patients re-enter at back of queue |
| Day 6 | Add appointment booking flow: slot creation (staff), booking (patient), conflict detection PG constraint. | Full Stack | Double-booking prevented at DB level |
| Day 6 | Integration testing: simulate queue flow end-to-end. Validate Redis avg accuracy within 20% of actual. | QA / Full Stack | Queue flow E2E validated |

---

### Sprint 3 (Days 7–9): ML Prediction + RAG Assistant + Production Readiness

**Goal:** Deploy Python AI microservices for ML-enhanced wait time predictions and the Ollama RAG assistant. Complete notifications, monitoring, and production docker stack.

| Day | Task | Owner | Deliverable |
|---|---|---|---|
| Day 7 | Build FastAPI `ml_service` container. Expose `/predict/waittime` endpoint. Load GBDT model on startup. | ML Lead | FastAPI container responding on port 8000 |
| Day 7 | Write `train.py`: extract last 90 days `queue_entries`, feature engineering (8 features), GridSearchCV, joblib pickle. | ML Lead | Model trained with MAE < 15 min |
| Day 7 | Wire hybrid formula: `final = 0.6×ml + 0.4×moving_average`. Configurable weights via Redis. | ML Lead | Hybrid endpoint returns blended estimate |
| Day 8 | Set up Ollama container (`llama3:8b` + `nomic-embed-text`). Write LangChain RAG pipeline with `SupabaseVectorStore`. | ML Lead | RAG query returns grounded answer + sources |
| Day 8 | Build `/rag/ingest` endpoint: PDF upload → LangChain chunking → nomic-embed-text → pgvector INSERT. | ML Lead | SOPs ingested and searchable |
| Day 8 | Add RAG chat widget to staff dashboard (Next.js floating button). Wire to `/rag/query` API route. | Frontend Lead | Staff can ask SOP questions with citations |
| Day 9 | Set up Grafana + Prometheus + Loki. Define dashboards: API latency, ML inference time, active WebSockets. | DevOps | Monitoring stack live |
| Day 9 | Set up GlitchTip error tracking. Configure GitHub Actions CI: lint, test, Docker build, Trivy CVE scan. | DevOps | CI pipeline passing on all PRs |
| Day 9 | Final integration test: full patient journey (checkin → queue → SMS → ML estimate → RAG query). Load test 500 users. | QA / Full Stack | System passes all acceptance criteria |

---

## 6. Algorithm & AI Design

### 6.1 Moving Average Wait Time (Redis)

| Property | Detail |
|---|---|
| Data Structure | Redis List (`RPUSH` + `LTRIM` to maintain last 5 durations) |
| Window Size | 5 consultations (configurable via ENV) |
| Update Trigger | `PATCH /api/queue/:id/complete` called by doctor on consultation end |
| Broadcast | Supabase Realtime UPDATE on `queue_entries` triggers frontend recalculation |
| Fallback | If Redis unavailable: query last 5 ended `queue_entries` from Supabase |
| Accuracy Target | Within 20% of actual wait time for 80% of patients |

```
ON consultation_complete(entryId):
  duration = ended_at - started_at           // seconds
  RPUSH  queue:{deptId}:window  duration
  LTRIM  queue:{deptId}:window  -5  -1        // keep last 5 only
  avg = mean( LRANGE queue:{deptId}:window 0 -1 )
  SET    queue:{deptId}:avg  avg  EX 3600
  // Triggers Supabase Realtime broadcast to all waiting patients

FUNCTION estimate_wait(position):
  RETURN position × avg_seconds ÷ 60          // result in minutes
```

#### Node.js Implementation

```javascript
async function recordCompletion(deptId, startTime, endTime) {
  const duration = endTime - startTime;  // seconds
  await redis.rpush(`queue:${deptId}:window`, duration);
  await redis.ltrim(`queue:${deptId}:window`, -5, -1);
  const window = await redis.lrange(`queue:${deptId}:window`, 0, -1);
  const avg = window.reduce((a, b) => a + +b, 0) / window.length;
  await redis.set(`queue:${deptId}:avg`, avg, 'EX', 3600);
  await supabase.from('queue_entries')
    .update({ ended_at: new Date() }).eq('id', currentEntryId);
}

async function estimateWait(deptId, position) {
  const avg = await redis.get(`queue:${deptId}:avg`) || 600; // 10min fallback
  return Math.round(position * avg / 60); // return minutes
}
```

---

### 6.2 Hybrid ML Prediction Formula

The hybrid prediction blends the immediate context-awareness of the moving average with the historical pattern recognition of the ML model. Weights are runtime-configurable in Redis.

```
final_estimate = (0.60 × ml_prediction) + (0.40 × moving_average_estimate)

Override rules:
  < 5 consultations today  →  100% ML prediction
  ML service offline       →  100% Moving average
  Weights configurable:    REDIS.SET('dept:{id}:ml_weight', 0.60)
```

#### FastAPI Implementation

```python
@app.post('/predict/waittime')
async def predict(req: PredictRequest):
    features = extract_features(req)
    ml_pred  = model.predict([features])[0]   # GBDT model
    ma_val   = redis.get(f'queue:{req.dept_id}:avg') or 600
    hybrid   = (0.6 * ml_pred) + (0.4 * float(ma_val) / 60)
    return {
        'estimate_minutes': round(hybrid, 1),
        'ml_component': round(ml_pred, 1),
        'ma_component': round(float(ma_val) / 60, 1)
    }
```

---

### 6.3 ML Feature Engineering

| Rank | Feature | Type | Extraction Logic |
|---|---|---|---|
| 1 | `queue_depth_ahead` | Integer | COUNT patients with earlier `registered_at` in active queue |
| 2 | `registration_hour` | Int 0–23 | `EXTRACT(hour FROM registered_at)` — cyclical load signal |
| 3 | `day_of_week` | One-hot (7) | `EXTRACT(dow FROM registered_at)` — e.g. Mondays typically busier |
| 4 | `visit_type` | Binary | 1 = appointment, 0 = walk-in |
| 5 | `turn_missed_flag` | Binary | 1 = patient missed turn previously today |
| 6 | `gender` | Binary | 1 = male, 0 = female |
| 7 | `payment_type` | Binary | 1 = insurance, 0 = self-pay |
| 8 | `registration_day` | Int 1–31 | `EXTRACT(day FROM registered_at)` — identifies month-end surges |

#### Model Training Pipeline

| Stage | Tool | Detail |
|---|---|---|
| Data Source | Supabase `queue_entries` | Fetch last 90 days completed consultations |
| Feature Engineering | pandas | Extract 8 features above |
| Model Training | scikit-learn GBDT + RF | GridSearchCV; 80/20 train/test split |
| Evaluation | sklearn.metrics | MAE, RMSE, R²; target MAE < 15 min |
| Serialization | joblib | Save to `/models/dept_{id}_gbdt.pkl` |
| Storage | Supabase Storage | Upload to `ml-models` bucket |
| Serving | FastAPI + joblib.load | Load on startup; predict in < 100ms |
| Retraining | GitHub Actions cron | Weekly Sunday 2AM; champion-challenger promotion |

---

### 6.4 RAG Pipeline Architecture

```
User Question
  │
  ├─ 1. POST /api/rag/query { question, dept_context }
  ├─ 2. LangChain: embed question → Ollama nomic-embed-text (768d vector)
  ├─ 3. supabase.rpc('match_documents', { query_embedding, match_count: 5 })
  │      └─ pgvector HNSW cosine similarity search over documents table
  ├─ 4. Top 5 chunks assembled as context + source metadata
  ├─ 5. LangChain RetrievalQA: [system_prompt + context + question] → Ollama llama3:8b
  ├─ 6. LLM generates grounded answer (context-only, no hallucination)
  └─ 7. Response: { answer, sources[], confidence_score }
```

#### Python RAG Implementation

```python
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.llms import Ollama

embeddings = OllamaEmbeddings(model='nomic-embed-text')
vectorstore = SupabaseVectorStore(
    client=supabase_client,
    embedding=embeddings,
    table_name='documents',
    query_name='match_documents'
)

llm = Ollama(model='llama3:8b', base_url='http://ollama:11434')
qa = RetrievalQA.from_chain_type(llm=llm, retriever=vectorstore.as_retriever())
answer = qa.invoke({'query': 'Protocol for ICU bed overflow?'})
```

---

## 7. API Contracts

### 7.1 Bed Management APIs

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/beds` | List all beds with current status | JWT (RLS enforced) |
| GET | `/api/v1/beds/:unitId` | Beds for specific health unit | JWT (RLS) |
| POST | `/api/v1/beds` | Create new bed | Admin JWT |
| PATCH | `/api/v1/beds/:id` | Update bed status / `blocked_reason` | Staff or Admin JWT |
| DELETE | `/api/v1/beds/:id` | Remove bed from unit | Admin JWT only |
| GET | `/api/v1/beds/stats/realtime` | Aggregate occupancy stats (free/occupied/blocked %) | Any JWT |

### 7.2 Queue Management APIs

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/v1/queue/checkin` | Register patient → returns token, position, estimate | Public |
| GET | `/api/v1/queue/:deptId` | Current queue status + wait estimates for dept | Any |
| PATCH | `/api/v1/queue/:entryId/complete` | Mark consultation done; update Redis moving avg | Staff JWT |
| PATCH | `/api/v1/queue/:entryId/miss` | Mark turn missed; apply penalty re-queue | Staff JWT |
| GET | `/api/v1/queue/predict/:deptId` | Hybrid ML + moving average prediction | Any |

### 7.3 Appointment APIs

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/v1/appointments` | Book appointment slot | Patient JWT |
| GET | `/api/v1/appointments/:deptId/slots` | Available slots for a department | Public |
| PATCH | `/api/v1/appointments/:id` | Confirm / cancel appointment | Staff or Patient JWT |
| DELETE | `/api/v1/appointments/:id` | Remove appointment | Admin JWT |

### 7.4 ML Service APIs (FastAPI, port 8000)

| Method | Endpoint | Input | Output |
|---|---|---|---|
| POST | `/predict/waittime` | `{dept_id, queue_depth, hour, dow, visit_type}` | `{estimate_minutes, ml_component, ma_component}` |
| POST | `/rag/query` | `{question, dept_context}` | `{answer, sources[], confidence}` |
| POST | `/rag/ingest` | PDF file (multipart/form-data) | `{chunks_added, doc_id, status}` |
| GET | `/health` | — | `{status, models_loaded, ollama_status}` |

---

## 8. Caching Strategy & Resilience Design

### 8.1 Redis Cache Keys

| Cache Key | TTL | Invalidation | Purpose |
|---|---|---|---|
| `queue:{deptId}:window` | No TTL (list) | `RPUSH` + `LTRIM` on each completion | Moving average 5-item window |
| `queue:{deptId}:avg` | 3600s | Overwritten on completion | Current avg consultation duration |
| `bed:unit:{unitId}:stats` | 60s | Supabase Realtime event | Occupancy summary |
| `rag:q:{hash(query)}` | 3600s | Document upload event clears cache | RAG answer dedup cache |

### 8.2 Service Failure Fallbacks

| Failed Service | Fallback Strategy | User Impact |
|---|---|---|
| Redis (moving average) | Query last 5 `queue_entries` from Supabase directly | ~200ms slower, still functional |
| FastAPI ML Service | Shift to 100% Redis moving average estimate | Less accurate prediction; no outage |
| Ollama LLM (RAG) | Return static FAQ from `documents` table | RAG offline; known answers shown |
| Supabase Realtime | Client polls REST API every 10 seconds | Updates delayed ≤ 10s max |
| Novu Notifications | Log failed events; exponential backoff retry × 3 | Delayed SMS; eventually delivered |
| Supabase Storage | Serve ML models from local Docker volume mount | No retraining only; serving unaffected |

---

## 9. Testing Strategy

### 9.1 Testing Pyramid

| Level | Framework | Coverage Focus | Target |
|---|---|---|---|
| Unit — Frontend | Jest + React Testing Library | BedGrid color logic, queue moving average formatting | 85%+ branch coverage |
| Unit — Backend (FastAPI) | Pytest | Feature extraction (no negative durations), model inference | 90%+ on ML logic |
| Integration | Pytest + Supabase local | Realtime CDC < 500ms, RAG pipeline citation injection | All critical paths |
| E2E (Browser) | Playwright | Checkin → token → queue tracker, Nurse admission flow, Doctor queue advance | 3 core user journeys |
| ML Evaluation | sklearn.metrics | MAE < 15 min on test split; champion-challenger weekly comparison | Automated in CI |
| Load / Concurrency | K6 + Locust | 500 concurrent HTTP + 200 concurrent WebSocket connections | 0% HTTP 5xx; < 200ms P95 |

### 9.2 Critical Test Cases

- **Time zone safety:** `ended_at - registered_at` must never yield negative values. Test with cross-midnight and DST scenarios.
- **RLS isolation:** Staff from Hospital A cannot query beds from Hospital B — verified via separate JWT-authenticated clients.
- **Redis fallback:** Artificially kill Redis container; verify wait estimate degrades gracefully to Supabase query.
- **Occupancy threshold:** Confirm Novu webhook fires exactly once at 85%, not repeatedly on subsequent updates.
- **RAG hallucination guard:** Queries outside ingested SOP context must return "not found in documents" — never invented answers.
- **Duplicate queue prevention:** Two simultaneous checkin requests for same patient/dept must create only one entry.

---

## 10. DevOps & Deployment Strategy

### 10.1 Environment Setup

```bash
# 1. Clone and configure
git clone https://github.com/your-org/hqbms && cd hqbms
cp .env.example .env  # fill SUPABASE_URL, SUPABASE_ANON_KEY, REDIS_URL

# 2. Start all services
docker compose up -d

# 3. Apply DB migrations
supabase db push

# 4. Install frontend and run
cd apps/web && npm install && npm run dev

# 5. Train initial ML models
python ml_service/train.py

# 6. Visit http://localhost:3000
```

### 10.2 Docker Compose Services

| Service | Image | Port | Purpose |
|---|---|---|---|
| `supabase-db` | `supabase/postgres:15` | 5432 | PostgreSQL + pgvector |
| `supabase-auth` | `supabase/gotrue` | 9999 | JWT auth (GoTrue) |
| `supabase-realtime` | `supabase/realtime` | 4000 | Phoenix channels / WebSocket |
| `supabase-storage` | `supabase/storage-api` | 5000 | File storage (S3-compatible) |
| `next-app` | `./apps/web` | 3000 | Frontend + API routes |
| `ml-service` | `./ml_service` | 8000 | FastAPI ML + RAG |
| `ollama` | `ollama/ollama` | 11434 | Local LLM inference (LLaMA3) |
| `redis` | `redis:7-alpine` | 6379 | Moving average cache |
| `novu` | `novu/novu` | 3002 | Notification service |
| `grafana` | `grafana/grafana` | 3001 | Metrics dashboard |
| `prometheus` | `prom/prometheus` | 9090 | Metrics scraping |
| `traefik` | `traefik:v3` | 80/443 | Reverse proxy + TLS |

### 10.3 CI/CD Pipeline (GitHub Actions + ArgoCD)

- **On every PR:** ESLint + Prettier (Next.js), Black + Flake8 (Python), Jest unit tests, Pytest unit tests
- **Docker build:** Build `next-app` and `ml-service` images. Run Trivy CVE scanner — fail on CRITICAL severity
- **Supabase check:** `supabase db lint` to validate SQL quality
- **On merge to main:** ArgoCD detects Helm chart change → auto-deploys to K3s cluster
- **Weekly cron (Sunday 2AM):** `python ml_service/train.py` retrain. Champion-challenger comparison. Auto-promote if MAE improves > 5%
- **Daily cron:** `pg_dump` to encrypted S3-compatible bucket (Backblaze B2 / MinIO)

### 10.4 Production K3s Architecture

```bash
# Self-hosted Supabase on K3s
git clone https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env  # configure POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY
docker compose up -d  # starts Kong, GoTrue, PostgREST, Realtime, Storage, Meta
```

Expose via **Traefik** reverse proxy with Let's Encrypt TLS. Backup: `pg_dump` scheduled daily via GitHub Actions → upload to S3-compatible storage.

---

## 11. Security Architecture

| Concern | Solution | Tool |
|---|---|---|
| Authentication | JWT via Supabase GoTrue; refresh token rotation every 60 min | Supabase Auth (GoTrue) |
| Authorization | PostgreSQL RLS on all tables; role in JWT claim | Supabase RLS |
| Patient PII Encryption | pgcrypto column-level `encrypt()`/`decrypt()` on `name_enc`, `dob_enc` | pgcrypto (built into PG) |
| Transport Security | TLS 1.3 on all endpoints via Traefik + Let's Encrypt auto-cert | Traefik + cert-manager |
| API Rate Limiting | Traefik middleware: 100 req/min per IP; stricter on `/checkin` | Traefik rate limit plugin |
| Audit Logging | PostgreSQL trigger on all bed/admission/queue write operations | Custom PG trigger function |
| Secrets Management | Docker secrets locally; HashiCorp Vault in production | Vault (open-source) |
| Container Scanning | Trivy scans all Docker images in CI before registry push | Trivy (Aqua Security OSS) |
| Session Security | JWT stored in httpOnly cookies; CSRF protection via `SameSite=Strict` | Next.js `@supabase/ssr` |

---

## 12. Feature Priority Matrix

| Feature | Priority | Sprint | Effort |
|---|---|---|---|
| Real-time ICU/Ward Bed Dashboard | P0 — Must Have | Sprint 1 | 2 days |
| Bed CRUD (Free / Occupied / Blocked) | P0 — Must Have | Sprint 1 | 1 day |
| Patient Admission / Discharge / Transfer | P0 — Must Have | Sprint 1 | 2 days |
| Supabase Auth (JWT + RBAC) | P0 — Must Have | Sprint 1 | 1 day |
| OPD Queue Display (Live) | P0 — Must Have | Sprint 2 | 2 days |
| Moving Average Wait Time Estimator | P0 — Must Have | Sprint 2 | 1 day |
| Basic Appointment Booking + Conflict Detection | P1 — Should Have | Sprint 2 | 2 days |
| SMS Notifications via Novu + Termii | P1 — Should Have | Sprint 2 | 1 day |
| ML Wait Time Prediction (GBDT/RF) | P1 — Should Have | Sprint 3 | 3 days |
| RAG Assistant (Ollama + pgvector) | P1 — Should Have | Sprint 3 | 2 days |
| 85% Occupancy Alert (PG Function + Novu) | P1 — Should Have | Sprint 3 | 0.5 days |
| Monitoring (Grafana + Prometheus + Loki) | P1 — Should Have | Sprint 3 | 0.5 days |
| PDF/Excel Report Export | P2 — Nice to Have | Post-MVP | 2 days |
| EMR / HL7 / FHIR API Integration | P2 — Nice to Have | Post-MVP | 3 days |
| LSTM 24hr ICU Occupancy Forecast | P2 — Nice to Have | Post-MVP | 3 days |
| Government Database Sync | P2 — Nice to Have | v1.5 | TBD |

---

## 13. Risk Register & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Redis unavailable during peak hours | Low | High | Fallback to Supabase query for last 5 entries. Autorestart policy in docker-compose. |
| ML model MAE > 15 min (training drift) | Medium | Medium | Weekly retraining cron. GlitchTip alert if MAE spikes. Automatic rollback to previous champion. |
| Ollama LLaMA3 inference too slow on CPU | Medium | Medium | GPU passthrough if available. Fallback to static FAQ. Cache RAG answers in Redis for 1hr. |
| Supabase Realtime message lag > 2s | Low | High | Client-side polling fallback (10s). Investigate WAL publication lag on DB load. |
| RLS policy bypass via malformed JWT | Low | Critical | Supabase GoTrue validates all JWTs. Regular RLS audit tests in CI. Trivy scanning. |
| Patient PII data breach | Low | Critical | pgcrypto column encryption. TLS 1.3. Audit logs on all reads. HashiCorp Vault for keys. |
| 9-day sprint timeline too tight | Medium | Medium | P0 features (bed grid + queue) deliverable in 6 days. P1 (ML + RAG) can slip to day 11 without blocking MVP. |
| SMS delivery failures (Termii outage) | Low | Medium | Novu exponential backoff retry × 3. In-app push notification as fallback channel. |

---

## 14. Success Metrics

| Metric | Baseline (Before) | Target (6 Months) | Measurement Method |
|---|---|---|---|
| Bed status update time | 15 min (phone call) | < 30 seconds | System timestamp diff (trigger → realtime receive) |
| OPD wait time prediction MAE | N/A (no system) | < 15 minutes | ML weekly evaluation script |
| Actual wait time reduction | Survey baseline | −20% | Queue analytics (avg `ended_at - registered_at`) |
| Patient satisfaction (NPS) | Survey baseline | +25 NPS points | Post-visit SMS survey (Novu workflow) |
| Staff daily active adoption | 0% | > 80% | Supabase Auth login logs |
| SOP lookup time | 5–10 min (manual) | < 30 seconds (RAG) | RAG query timestamp analytics |
| Dashboard initial load (P95) | N/A | < 2 seconds | Grafana / Prometheus API latency metrics |
| Realtime update propagation | N/A | < 2 seconds | Integration test: UPDATE → WebSocket receipt time |

---

## Open-Source Licence Summary

| Tool | Licence | Commercial Use |
|---|---|---|
| Supabase (self-hosted) | Apache 2.0 | Yes |
| Next.js | MIT | Yes |
| shadcn/ui + Tailwind | MIT | Yes |
| scikit-learn | BSD 3-Clause | Yes |
| LangChain | MIT | Yes |
| Ollama | MIT | Yes |
| pgvector | MIT | Yes |
| Novu | MIT | Yes |
| Grafana | AGPL v3 | Yes (self-host) |
| Traefik | MIT | Yes |
| Redis | BSD 3-Clause | Yes |

---

*HQBMS — Senior Developer Development Plan | v1.0 | Confidential — Internal Engineering Document*  
*All tools open-source · Apache 2.0 / MIT / BSD · Self-hostable · Zero proprietary licences*
