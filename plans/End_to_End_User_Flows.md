# HQBMS — End-to-End User Flow Document
**Hospital Queue & Bed Management System**
> Version 2.0 | All User Journeys | Step-by-Step with Tech Layer

---

## 1. Document Purpose

This document maps every user interaction from entry point to outcome, showing exactly what the user sees (UI), what happens in the system (tech), and which open-source component handles each step.

**Actors covered:** Patient · Clinical Staff · Hospital Admin · State Admin · Doctor · IT Manager

---

## 2. System Entry Points

| Entry Point | URL / Channel | Actor | Authentication |
|---|---|---|---|
| Patient OPD Checkin | `/checkin` | Patient (unauthenticated) | None — public page |
| Patient Queue Tracker | `/queue/{token}` | Patient | Token-based (URL param) |
| Staff Dashboard | `/staff` | Nurse, Doctor, Receptionist | Supabase Auth login |
| Admin Dashboard | `/admin` | Hospital Admin | Supabase Auth + MFA |
| State Dashboard | `/state` | State Health Dept | Supabase Auth (state role) |
| Mobile PWA | Installable from any browser | Staff + Admin | Supabase Auth (cookie) |
| API (External EMR) | `/api/v1` | Hospital IT Systems | Supabase Service Key |

---

## 3. Flow 1 — Patient: OPD Self-Checkin → Real-Time Queue Tracking

```
Patient arrives at hospital
        │
        ▼
Scans QR code on OPD board
        │
        ▼
Selects department → Enters name/DOB/visit type
        │
        ▼
Clicks "Get Token"
        │  POST /api/queue/checkin
        ▼
Receives token slip: "A47 · Position 6 · ~32 min"
        │
        ├──► SMS sent via Novu ("You are A47, est wait 32 min")
        │
        ▼
Leaves waiting room; tracks on phone at /queue/{token}
        │  Supabase Realtime subscription
        ▼
Position reaches 3 → SMS fires: "Please proceed to Room 3"
        │
        ▼
Enters consultation → consultation marked complete by staff
        │
        ▼
All other patients' estimates auto-update
        │
        ▼
30 min later → feedback SMS sent via Novu
```

| Step | What Patient Does | What System Does | Tech Component |
|---|---|---|---|
| 1 | Scans QR code on OPD board | Loads public `/checkin` page | Next.js public route |
| 2 | Selects department from dropdown | `supabase.from('departments').select()` | Supabase PostgREST |
| 3 | Enters name, DOB, visit type | Form validation client-side | React Hook Form + Zod |
| 4 | Clicks "Get Token" | `POST /api/queue/checkin` — inserts queue entry, fetches Redis position | Next.js API route + Redis |
| 5 | Sees: Token A47, Position 6, Est. 32 min | ML hybrid estimate (FastAPI) + moving avg (Redis) blended | FastAPI + Redis |
| 6 | Receives SMS confirmation | Novu sends SMS via Termii | Novu + Termii |
| 7 | Tracks queue on phone | `/queue/{token}` — Supabase Realtime shows live position | Supabase Realtime |
| 8 | Position reaches 3 | Novu scheduled trigger → SMS: "Please proceed to Room 3" | Novu + Edge Function |
| 9 | Enters consultation | Staff marks `started_at = now()` | Staff UI → Supabase UPDATE |
| 10 | Consultation ends | Staff marks `ended_at = now()`; Redis window updates | Redis RPUSH + LTRIM |
| 11 | All patients see updated estimates | Supabase Realtime broadcasts to all queue subscribers | Phoenix Channels |
| 12 | Receives feedback request | Novu triggers feedback SMS 30 min after `ended_at` | Novu scheduled event |

---

## 4. Flow 2 — Clinical Staff: Patient Admission & Bed Assignment

```
Staff logs in
        │  Supabase GoTrue JWT
        ▼
Views color-coded bed grid for their unit
        │  Supabase Realtime subscription
        ▼
Identifies free ICU bed (green)
        │
        ▼
Clicks "Admit Patient" on bed cell
        │
        ├──► Searches patient by name/ID
        ├──► Fills diagnosis type + exam reference
        └──► Submits admission
                │  supabase.from('admissions').insert()
                │  + UPDATE beds SET status='occupied'
                ▼
        Bed turns red on ALL connected dashboards
                │  PG Trigger → audit_log entry
                │  Supabase Realtime broadcast
                ▼
        If occupancy ≥ 85% → admin receives alert email
                │  PG Function → Novu webhook
                ▼
        Staff asks RAG: "ICU overflow protocol?"
                │  LangChain + pgvector + Ollama
                ▼
        AI responds with cited SOP steps
```

| Step | What Staff Does | What System Does | Tech Component |
|---|---|---|---|
| 1 | Logs in at staff dashboard | `supabase.auth.signInWithPassword()`; JWT in httpOnly cookie | Supabase GoTrue |
| 2 | Views bed grid for their unit | Fetches beds with RLS filter; subscribes to Realtime channel | Supabase + Realtime |
| 3 | Identifies free ICU bed (green cell) | status = 'free' confirmed live | Supabase Realtime |
| 4 | Clicks "Admit Patient" | Opens admission modal | Next.js component state |
| 5 | Searches patient by name | `supabase.from('patients').ilike('name_enc', ...)` | Supabase PostgREST |
| 6 | Fills diagnosis type + exam ref | Form validation | React Hook Form |
| 7 | Submits admission | Insert admission + UPDATE bed status = 'occupied' | Supabase transaction |
| 8 | Bed turns red for all viewers | RLS Realtime broadcast; PG trigger creates audit log | PG Trigger + Realtime |
| 9 | Admin gets email if ≥ 85% | PG threshold function calls webhook → Novu fires | PG Function + Novu |
| 10 | Asks RAG: "ICU overflow protocol?" | pgvector similarity search → Ollama generates answer with SOP cites | LangChain + pgvector + Ollama |
| 11 | Transfers patient to another unit | New bed assigned; old bed set to 'free' | Supabase UPDATE ×2 |
| 12 | Discharges patient | `admission.discharged_at = now()`; bed freed | Supabase UPDATE |

---

## 5. Flow 3 — Hospital Admin: Monitoring & Reporting

```
Admin logs in (MFA enabled)
        │  GoTrue TOTP verification
        ▼
Views admin overview dashboard
        │  Aggregate views + ECharts
        ▼
Monitors live bed map across all wards
        │  Supabase Realtime (all unit channels)
        ▼
Receives low-bed alert
        │  Novu in-app toast
        ▼
Uploads new SOP PDF for RAG ingestion
        │  Supabase Storage → LangChain ingestion pipeline
        ▼
Asks RAG: "Which ward has capacity for 3 pediatric patients?"
        │  pgvector + Ollama with live bed context
        ▼
Exports daily bed report as PDF
        │  @react-pdf/renderer
        ▼
Reviews audit log for compliance
        │  Supabase PostgREST — admin RLS policy
```

| Step | What Admin Does | What System Does | Tech Component |
|---|---|---|---|
| 1 | Logs in with MFA | GoTrue verifies TOTP; returns JWT with `role=admin` | Supabase GoTrue + TOTP |
| 2 | Views overview dashboard | Aggregate stats: beds free/occupied %, avg wait/dept | Supabase views + ECharts |
| 3 | Monitors live bed map | Realtime subscriptions on all unit channels | Supabase Realtime |
| 4 | Reviews 7-day occupancy trend | Time-series query from `admissions` table | Supabase + ECharts line chart |
| 5 | Receives low-bed alert | Novu in-app toast: "ICU at 91% capacity" | Novu + Next.js toast |
| 6 | Uploads SOP PDF | File → Supabase Storage → LangChain chunks → pgvector index | Supabase Storage + LangChain |
| 7 | Queries RAG assistant | pgvector similarity search + Ollama response with citations | LangChain + pgvector + Ollama |
| 8 | Exports report as PDF | Next.js API route → `@react-pdf/renderer` | @react-pdf/renderer (OSS) |
| 9 | Reviews audit log | `audit_logs` query with date filter; admin RLS policy | Supabase PostgREST |
| 10 | Manages staff accounts | `supabase.auth.admin.inviteUserByEmail()` | Supabase Admin API |

---

## 6. Flow 4 — State Admin: Aggregate Multi-Hospital View

| Step | What State Admin Does | What System Does | Tech Component |
|---|---|---|---|
| 1 | Logs in to State Dashboard | JWT with `role=state_admin`; RLS permits read-all `health_units` | Supabase GoTrue |
| 2 | Views state-level bed summary | Aggregate: total beds, free%, occupied% per municipality | Supabase aggregate view |
| 3 | Drills into specific hospital | Navigate to unit detail; RLS read-only for state admin | Supabase RLS read policy |
| 4 | Reviews 30-day hospitalization trend | Time-series from `admissions` partitioned table | Supabase view + ECharts |
| 5 | Downloads state report PDF | Generates multi-hospital summary | @react-pdf/renderer |
| 6 | Receives critical alert (hospital at 95% ICU) | Novu email alert configured for state role | Novu alert policy |

---

## 7. Flow 5 — Doctor: Queue Management During OPD Session

```
Doctor logs in → sees department queue
        │  Supabase Realtime (dept channel)
        ▼
Calls next patient
        │  queue_entry.started_at = now()
        ▼
Consultaton complete → clicks "Done"
        │  queue_entry.ended_at = now()
        │  Redis RPUSH + LTRIM (moving average update)
        ▼
ALL patients' estimates auto-update live
        │  Supabase Realtime broadcast
        ▼
Views predicted load for next 2 hours
        │  FastAPI GBDT forecast + ECharts
```

| Step | What Doctor Does | What System Does | Tech Component |
|---|---|---|---|
| 1 | Logs in to doctor view | `role=doctor`; RLS shows only assigned dept queue | Supabase RLS |
| 2 | Views live queue | Queue list ordered by position; est. wait per patient | Supabase Realtime |
| 3 | Calls next patient | `queue_entry.started_at = now()` | Supabase UPDATE |
| 4 | Sees patient details | Fetches patient record linked to `queue_entry` | Supabase JOIN |
| 5 | Marks consultation complete | `ended_at = now()` | Supabase UPDATE |
| 6 | Moving average recalculates | Redis window updates; estimates broadcast to all patients | Redis + Supabase Realtime |
| 7 | Marks missed turn | `missed = true`; patient position penalized | Supabase UPDATE + API logic |
| 8 | Views 2-hour forecast | GBDT prediction by 30-min slot | FastAPI + ECharts |

---

## 8. Flow 6 — IT Manager: Deployment & System Monitoring

```bash
# 1. Clone and configure
git clone https://github.com/your-org/hqbms && cd hqbms
cp .env.example .env

# 2. Start all services (one command)
docker compose up -d

# 3. Apply database migrations + RLS policies
supabase db push

# 4. Train initial ML models
python ml_service/train.py

# 5. Pull Ollama models
docker exec ollama ollama pull llama3:8b
docker exec ollama ollama pull nomic-embed-text

# 6. Verify system health
curl http://localhost:3000/api/health
curl http://localhost:8000/health
```

| Step | What IT Manager Does | What System Does | Tech Component |
|---|---|---|---|
| 1 | Clones repo, reviews `docker-compose.yml` | Sees all services: supabase, next-app, ml-service, ollama, novu, redis, grafana | Docker Compose |
| 2 | Configures `.env` | Environment variables loaded by all services | Docker env |
| 3 | Runs `docker compose up -d` | Starts all services; Supabase self-hosted (7 containers) | Docker Compose |
| 4 | Runs `supabase db push` | Applies all SQL migrations, RLS policies, triggers | Supabase CLI |
| 5 | Runs `python ml_service/train.py` | Trains GBDT/RF; uploads artifacts to Supabase Storage | scikit-learn + Supabase |
| 6 | Visits `/admin/health` | System health check: all services green | Next.js health endpoint |
| 7 | Visits Grafana at `:3001` | Views: API latency, DB query time, ML predictions | Grafana + Prometheus |
| 8 | Configures SSL via Traefik | Updates `traefik.yml` with domain + Let's Encrypt | Traefik + cert-manager |
| 9 | Sets up daily DB backup | GitHub Actions cron: `pg_dump` → S3/Backblaze upload | GitHub Actions |
| 10 | Monitors errors in GlitchTip | Aggregates uncaught exceptions from Next.js + FastAPI | GlitchTip (OSS Sentry) |

---

## 9. System State Transitions

### 9.1 Bed State Machine

```
         ┌─────────────────────────────────┐
         │           FREE                  │
         │  (default on creation)          │
         └──┬──────────────────────┬───────┘
            │ Admit patient        │ Mark maintenance
            ▼                      ▼
      ┌──────────┐          ┌────────────┐
      │ OCCUPIED │          │  BLOCKED   │
      └──────────┘          └────────────┘
            │                      │
            │ Discharge/Transfer   │ Maintenance done
            ▼                      ▼
         ┌─────────────────────────────────┐
         │           FREE                  │
         └─────────────────────────────────┘
```

| Current State | Allowed Transitions | Triggered By | DB Operation |
|---|---|---|---|
| `free` | → `occupied` | Staff admission form | `UPDATE beds SET status='occupied'` |
| `free` | → `blocked` | Staff marks blocked | `UPDATE beds SET status='blocked', blocked_reason=...` |
| `occupied` | → `free` | Staff discharge/transfer | `UPDATE beds` + `UPDATE admissions SET discharged_at=now()` |
| `occupied` | → `blocked` | Not allowed directly | Must discharge first |
| `blocked` | → `free` | Staff unblocks | `UPDATE beds SET status='free', blocked_reason=NULL` |

### 9.2 Queue Entry State Machine

```
WAITING ──► IN_CONSULTATION ──► COMPLETED (terminal)
   ▲               │
   │ Re-enter      ▼
   └────────── MISSED
                   │
CANCELLED ◄────────┘ (if patient leaves)
```

| State | Description | Next State | Trigger |
|---|---|---|---|
| `waiting` | Patient in queue, not yet called | `in_consultation` | Staff clicks "Call Next" |
| `in_consultation` | Currently with doctor | `completed` or `missed` | Staff clicks "Complete" or "Missed" |
| `completed` | Consultation done | — (terminal) | Staff marks complete |
| `missed` | Did not respond when called | `waiting` (re-enter) | Patient re-joins at penalty position |
| `cancelled` | Patient left before being called | — (terminal) | Patient or staff cancels |

---

## 10. Error Handling Flows

| Error Scenario | User Sees | System Does | Recovery |
|---|---|---|---|
| Supabase Realtime disconnects | Yellow banner: "Live updates paused" | Client polls REST API every 10s | Auto-reconnects; banner clears |
| ML service down | "Est. wait: ~32 min (approx)" | Falls back to moving average only | No action needed; ML resumes |
| Redis unavailable | Slight delay in checkin response | Falls back to Supabase query for last 5 | Transparent to user |
| RAG / Ollama unavailable | "AI assistant temporarily offline" | Shows static help FAQ from `documents` | IT alert via GlitchTip |
| Duplicate patient checkin | "You already have token A47" | Supabase unique constraint check | User shown existing token |
| Bed admit conflict (race) | "Bed was just taken. Please select another" | `updated_at` optimistic lock check | Bed grid refreshes instantly |

---

## 11. Notification Event Map

| Event | Recipient | Channel | Timing | Novu Template |
|---|---|---|---|---|
| Queue checkin confirmed | Patient | SMS + In-app | Immediate | `queue-checkin` |
| Queue position = 3 | Patient | SMS | When position updates | `queue-position-3` |
| Consultation complete | Patient | SMS (feedback) | 30 min after `ended_at` | `post-consult-feedback` |
| Bed occupancy ≥ 85% | Hospital Admin | Email + In-app | Immediate on threshold | `bed-threshold-alert` |
| Appointment reminder | Patient | SMS | 24hr before slot | `appt-reminder` |
| New user account created | New staff member | Email (invite) | On admin invite | `staff-invite` |
| Missed turn | Patient | SMS | When marked missed | `queue-missed` |
| Report generated | Admin | Email (with PDF link) | On report export | `report-ready` |

---

## 12. Full System Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 14)                    │
│  /checkin  /queue/{token}  /staff  /admin  /state               │
│  shadcn/ui + Tailwind + Apache ECharts + TanStack Query         │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS (Traefik + Let's Encrypt)
┌───────────────────────▼─────────────────────────────────────────┐
│                    SUPABASE (Self-Hosted)                        │
│  ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐ │
│  │ PostgreSQL  │ │  GoTrue  │ │ Realtime │ │    Storage     │ │
│  │ 15+pgvector │ │  Auth    │ │ Phoenix  │ │  (SOP PDFs,    │ │
│  │ + RLS       │ │  JWT     │ │ Channels │ │   ML models)   │ │
│  └─────────────┘ └──────────┘ └──────────┘ └────────────────┘ │
└───────────┬──────────────────────────────┬──────────────────────┘
            │                              │
┌───────────▼──────────┐    ┌─────────────▼──────────────────────┐
│  Redis (Upstash)     │    │   FastAPI ML Service (Python)       │
│  - MA window list    │    │   - scikit-learn GBDT/RF models     │
│  - Current avg       │    │   - LangChain + Ollama RAG          │
│  - Queue sorted set  │    │   - pgvector retriever              │
└──────────────────────┘    └────────────────────────────────────┘
                                           │
                            ┌──────────────▼──────────┐
                            │   Ollama (Self-Hosted)  │
                            │   llama3:8b             │
                            │   nomic-embed-text      │
                            └─────────────────────────┘

Supporting Services:
  Novu          → Multi-channel notifications (SMS, email, push)
  Grafana       → Metrics dashboards
  Prometheus    → Metrics scraping
  Loki          → Log aggregation
  GlitchTip     → Error tracking
  GitHub Actions → CI/CD pipelines
```
