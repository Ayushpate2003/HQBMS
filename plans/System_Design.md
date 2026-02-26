# HQBMS — System Design Document
**Hospital Queue & Bed Management System**
> Version 2.0 | Supabase + Open-Source | Low-Level Design, Algorithms & Data Flows

---

## 1. Supabase Schema Design

### 1.1 Full Table Inventory

| Table | Primary Key | Key Columns | RLS Policy |
|---|---|---|---|
| `health_units` | UUID | name, type, municipality, state | Admin: all; Staff: own unit |
| `beds` | UUID | unit_id(FK), bed_code, type, status, blocked_reason, updated_at | Staff: unit_id match |
| `patients` | UUID | name_enc, dob_enc, gender, municipality, created_at | Staff: unit scope |
| `admissions` | UUID | patient_id, bed_id, admitted_at, discharged_at, diagnosis, status | Staff: unit scope |
| `departments` | UUID | unit_id(FK), name, category, open_from, open_to | Staff: unit scope |
| `queue_entries` | UUID | patient_id, dept_id, registered_at, started_at, ended_at, missed, visit_type | All: own entry; Staff: dept |
| `appointments` | UUID | patient_id, dept_id, slot_start, slot_end, status | All: own; Staff: dept |
| `users` | UUID | email_enc, role, hospital_id, last_login | Self only; Admin: all |
| `audit_logs` | UUID | user_id, action, entity, entity_id, old_json, new_json, ts | Admin read-only |
| `documents` | UUID | content, embedding(vector 768), metadata_json, source | Staff: read; Admin: write |
| `notifications_log` | UUID | user_id, channel, message, sent_at, status | Self only |

### 1.2 PostgreSQL Functions & Triggers

#### Bed Status Audit Trigger

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

#### Occupancy Threshold Alert Function

```sql
CREATE OR REPLACE FUNCTION check_occupancy_threshold()
RETURNS TRIGGER AS $$ DECLARE
  total_beds INT; occupied INT; pct FLOAT;
BEGIN
  SELECT COUNT(*) INTO total_beds FROM beds WHERE unit_id = NEW.unit_id;
  SELECT COUNT(*) INTO occupied  FROM beds
    WHERE unit_id = NEW.unit_id AND status = 'occupied';
  pct := occupied::FLOAT / NULLIF(total_beds, 0);
  IF pct >= 0.85 THEN
    PERFORM net.http_post(
      url  := current_setting('app.webhook_url'),
      body := json_build_object('unit_id', NEW.unit_id, 'pct', pct)::text
    );
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 1.3 pgvector Setup for RAG

```sql
-- Enable extension (already included in Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table with embedding
CREATE TABLE documents (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content   TEXT NOT NULL,
  embedding VECTOR(768),  -- nomic-embed-text = 768 dims
  metadata  JSONB,
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
  FROM documents
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
```

---

## 2. Algorithm Designs

### 2.1 Moving Average Wait Time Algorithm

| Property | Detail |
|---|---|
| Data Structure | Redis List (`RPUSH` / `LTRIM` to keep last 5) |
| Window Size | 5 consultations (configurable via ENV) |
| Update Trigger | `POST /api/queue/complete` called by staff on consultation end |
| Broadcast | Supabase Realtime UPDATE on `queue_entries` triggers frontend recalc |
| Fallback | If Redis down: query last 5 ended `queue_entries` from Supabase |
| Accuracy Target | Within 20% of actual wait for 80% of patients |

```
ON consultation_complete(patient_id):
  ├─ duration = ended_at - started_at  (seconds)
  ├─ RPUSH  queue:{deptId}:window  duration
  ├─ LTRIM  queue:{deptId}:window  -5  -1   ← keep last 5 only
  ├─ avg = mean( LRANGE queue:{deptId}:window 0 -1 )
  ├─ SET queue:{deptId}:avg  avg  EX 3600
  └─ Supabase UPDATE queue_entries → triggers Realtime broadcast

FUNCTION estimate_wait(position):
  └─ RETURN position × avg ÷ 60   (minutes)
```

### 2.2 ML Model Pipeline

| Stage | Tool | Detail |
|---|---|---|
| Data Source | Supabase `queue_entries` | Fetch last 90 days completed consultations |
| Feature Engineering | pandas | Extract: hour, dow, queue_depth, visit_type, missed, gender |
| Model Training | scikit-learn GBDT + RF | GridSearchCV hyperparameter tuning; 80/20 split |
| Evaluation | sklearn.metrics | MAE, RMSE, R²; target MAE < 15 min |
| Serialization | joblib | Save to `/models/dept_{id}_gbdt.pkl` |
| Storage | Supabase Storage | Upload model artifacts to `ml-models` bucket |
| Serving | FastAPI + joblib.load | Load on startup; predict in < 100ms |
| Retraining | Cron (GitHub Actions) | Weekly Sunday 2AM; champion-challenger promotion |
| Hybrid Blend | API route | `final = 0.6 × ml_pred + 0.4 × moving_avg` |

#### Feature Importance Ranking

| Rank | Feature | Type | Extraction |
|---|---|---|---|
| 1 | `queue_depth_ahead` | Integer | COUNT of queue entries with earlier timestamp |
| 2 | `registration_hour` | Integer 0–23 | EXTRACT hour FROM registered_at |
| 3 | `day_of_week` | One-hot (7) | EXTRACT dow FROM registered_at |
| 4 | `visit_type` | Binary | 1=appointment, 0=walkin |
| 5 | `turn_missed_flag` | Binary | 1=patient has missed previously today |
| 6 | `gender` | Binary | 1=male, 0=female |
| 7 | `payment_type` | Binary | 1=insurance, 0=self-pay |
| 8 | `registration_day` | Integer 1–31 | EXTRACT day FROM registered_at |

#### Hybrid Prediction Formula

```
final_estimate = (0.60 × ml_prediction) + (0.40 × moving_average_estimate)
```

> Weights are configurable at runtime via `REDIS.SET('dept:{id}:ml_weight', 0.60)`.  
> If < 5 historical consultations exist: shifts to 100% ML.  
> If ML service unavailable: shifts to 100% moving average.

### 2.3 RAG Query Pipeline (Ollama + pgvector)

```
User Query
  │
  ├─ 1. POST /api/rag/query { question, dept_context }
  ├─ 2. LangChain: embed question → Ollama nomic-embed-text (768d vector)
  ├─ 3. supabase.rpc('match_documents', { query_embedding, match_count: 5 })
  │      └─ pgvector HNSW cosine similarity search
  ├─ 4. Top 5 chunks assembled as context + source metadata
  ├─ 5. LangChain RetrievalQA: [system_prompt + context + question] → Ollama llama3:8b
  ├─ 6. LLM generates grounded answer (no hallucination — context-only)
  └─ 7. Response: { answer, sources[], confidence_score }
```

---

## 3. Data Flow Diagrams

### 3.1 Bed Status Update Flow

| # | Actor | Action | Supabase Feature |
|---|---|---|---|
| 1 | Clinical Staff | Clicks bed cell, selects new status in modal | Next.js UI |
| 2 | Frontend | `supabase.from('beds').update({status}).eq('id', bedId)` | PostgREST PATCH |
| 3 | Supabase Auth | Verifies JWT; checks RLS policy `unit_id` match | GoTrue + RLS |
| 4 | PostgreSQL | Writes UPDATE; audit trigger fires, inserts to `audit_logs` | PG trigger |
| 5 | Supabase Realtime | CDC picks up UPDATE; broadcasts to `beds:unit_id=eq.{x}` | Phoenix Channels |
| 6 | All dashboards | Receive payload; TanStack Query updates local cache | React state |
| 7 | Threshold Function | PG function checks if occupancy ≥ 85% | PostgreSQL function |
| 8 | Novu | Receives webhook; sends email/SMS to unit admin | Novu notifications |

### 3.2 Patient Queue Checkin & Prediction Flow

| # | Actor | Action | Tech |
|---|---|---|---|
| 1 | Patient | Scans QR code at OPD; opens web form | Next.js public page |
| 2 | Patient | Submits: name, DOB, department, visit type | `POST /api/queue/checkin` |
| 3 | API Route | `supabase.from('queue_entries').insert({...})` | Supabase insert |
| 4 | API Route | `ZRANK redis queue:{deptId}` to get position | Redis sorted set |
| 5 | API Route | `GET redis queue:{deptId}:avg` for moving average | Redis GET |
| 6 | FastAPI | `POST /predict/waittime` with extracted features | ML microservice |
| 7 | API Route | `hybrid = 0.6×ml + 0.4×ma`; return result | Node.js |
| 8 | Frontend | Display: Token A47 · Position 6 · Est. Wait 32 min | Next.js UI |
| 9 | Novu | Schedule SMS trigger when position reaches 3 | Novu scheduled event |
| 10 | Supabase Realtime | Each consultation_complete broadcasts queue shift | Phoenix Channels |

---

## 4. Caching Strategy

| Cache Key | TTL | Invalidation | Purpose |
|---|---|---|---|
| `queue:{deptId}:window` | No TTL (list) | `RPUSH` + `LTRIM` on completion | Moving average window |
| `queue:{deptId}:avg` | 3600s | Overwritten on completion | Current avg duration |
| `bed:unit:{unitId}:stats` | 60s | Supabase Realtime event | Occupancy summary |
| `rag:q:{hash(query)}` | 3600s | Document upload event | RAG answer cache |

---

## 5. Resilience & Fallback Design

| Failed Service | Fallback Strategy | User Impact |
|---|---|---|
| Redis (moving average) | Query last 5 `queue_entries` from Supabase | Slightly slower (~200ms) but functional |
| FastAPI ML Service | Use 100% Redis moving average estimate | Less accurate prediction; no outage |
| Ollama LLM | Return static FAQ from Supabase `documents` table | RAG offline; pre-baked answers shown |
| Supabase Realtime | Client polls Supabase REST API every 10 seconds | Updates delayed 10s max |
| Novu Notifications | Log failed events; exponential backoff retry ×3 | Delayed SMS, eventually delivered |
| Supabase Storage | Serve ML models from local Docker volume | No retraining only; serving unaffected |

---

## 6. Indexing Strategy

```sql
-- Beds: frequent occupancy filter
CREATE INDEX idx_beds_unit_status ON beds(unit_id, status);

-- Admissions: patient history
CREATE INDEX idx_admissions_patient ON admissions(patient_id, admitted_at DESC);

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

## 7. API Contracts

### Bed Management APIs

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/api/v1/beds` | List all beds with current status | All |
| GET | `/api/v1/beds/:unitId` | Beds for specific health unit | All |
| POST | `/api/v1/beds` | Create new bed | Admin |
| PATCH | `/api/v1/beds/:id` | Update bed status/info | Staff, Admin |
| DELETE | `/api/v1/beds/:id` | Remove bed | Admin |
| GET | `/api/v1/beds/stats/realtime` | Aggregate occupancy stats | All |

### Queue Management APIs

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/v1/queue/checkin` | Register patient in OPD queue | Public |
| GET | `/api/v1/queue/:deptId` | Get current queue status + estimates | All |
| PATCH | `/api/v1/queue/:entryId/complete` | Mark consultation complete | Staff |
| PATCH | `/api/v1/queue/:entryId/miss` | Mark turn missed | Staff |
| GET | `/api/v1/queue/predict/:deptId` | ML-predicted wait time | All |

### ML Service APIs (FastAPI)

| Method | Endpoint | Input | Output |
|---|---|---|---|
| POST | `/predict/waittime` | `{dept_id, queue_depth, hour, dow, visit_type}` | `{estimate_minutes, ml_component, ma_component}` |
| POST | `/rag/query` | `{question, dept_context}` | `{answer, sources[], confidence}` |
| POST | `/rag/ingest` | PDF file (multipart) | `{chunks_added, status}` |
| GET | `/health` | — | `{status, models_loaded, ollama_status}` |
