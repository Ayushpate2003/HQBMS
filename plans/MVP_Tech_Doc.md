# HQBMS — MVP Technical Document
**Hospital Queue & Bed Management System**
> Version 2.0 | Supabase + Open-Source Stack | Engineering Sprint Reference

---

## 1. MVP Scope

The MVP delivers the core 70% of features across **3 sprints (9 days)**. All backend is powered by Supabase (auth, DB, realtime, storage). The ML and RAG layers run as separate Python FastAPI containers. All tools are open-source.

### 1.1 Open-Source Tool Decision Matrix

| Need | Chosen OSS Tool | Why Chosen | Licence |
|---|---|---|---|
| Database | Supabase / PostgreSQL 15 | Realtime CDC + RLS + vector support | Apache 2.0 / PostgreSQL |
| Auth | Supabase GoTrue | JWT + RBAC built-in, no Keycloak needed | MIT |
| Real-Time | Supabase Realtime | Phoenix channels on PG changes, no Kafka | Apache 2.0 |
| Frontend | Next.js 14 | SSR + App Router + API routes in one | MIT |
| UI | shadcn/ui + Tailwind | Accessible components, copy-paste, no fees | MIT |
| Cache / Queue | Redis (Upstash) | Moving average state; sorted set for queue | BSD / free tier |
| ML Models | scikit-learn + FastAPI | GBDT/RF wait time predictor | BSD / MIT |
| RAG LLM | Ollama + LangChain | Fully offline LLaMA3/Mistral — no API costs | MIT |
| Vector Store | pgvector (Supabase extension) | Embeddings in same Postgres DB | MIT |
| Notifications | Novu (self-hosted) | Multi-channel: SMS, email, push unified | MIT |
| Monitoring | Grafana + Prometheus + Loki | Full observability stack | Apache 2.0 / AGPL |
| CI/CD | GitHub Actions | Free for public/small private repos | Free tier |

---

## 2. Sprint Breakdown

### Sprint 1 (Days 1–3) — Supabase Foundation + Bed Management

**Goal:** Live bed dashboard with real-time status updates via Supabase Realtime.

#### 2.1.1 Supabase Setup Tasks

1. Create Supabase project (cloud or self-host with `docker compose up`)
2. Run migrations: `health_units`, `beds`, `bed_statuses`, `patients`, `admissions`, `users` tables
3. Enable Row Level Security; write policies: staff sees own unit only, admin sees all
4. Create Supabase Auth users; add custom claim: `hospital_id`, `role` via GoTrue hook
5. Enable Realtime on `beds` and `admissions` tables in Supabase dashboard

#### 2.1.2 SQL Schema — Core Tables

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
  bed_code TEXT, type TEXT,   -- ICU | semi-ICU | ward
  status TEXT DEFAULT 'free', -- free | occupied | blocked
  blocked_reason TEXT, updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Example
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
CREATE POLICY 'staff_unit_access' ON beds
  FOR ALL USING (
    unit_id = (SELECT hospital_id FROM users WHERE id = auth.uid())
  );
```

#### 2.1.3 Next.js Frontend Tasks

1. `supabase/client.ts`: `createBrowserClient` from `@supabase/ssr`
2. Login page: `supabase.auth.signInWithPassword()` — JWT stored in httpOnly cookie
3. Bed Grid component: TanStack Query for initial fetch; Supabase channel subscription for live diffs
4. Color coding: green=free, red=occupied, yellow=blocked using Tailwind classes
5. Occupancy stats card using Apache ECharts donut chart

#### 2.1.4 Supabase Realtime Subscription Pattern

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

### Sprint 2 (Days 4–6) — Queue Management + Moving Average

**Goal:** OPD queue live with real-time wait time estimates powered by the moving average algorithm stored in Redis.

#### 2.2.1 Additional SQL Tables

```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES health_units(id),
  name TEXT, category TEXT, open_from TIME, open_to TIME
);

CREATE TABLE queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  dept_id UUID REFERENCES departments(id),
  registered_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ,
  missed BOOLEAN DEFAULT false,
  visit_type TEXT  -- appointment | walkin
);
```

#### 2.2.2 Moving Average Algorithm (Redis + Node.js)

```javascript
// Redis keys:
// queue:{deptId}:window  — List, max 5 durations in seconds
// queue:{deptId}:avg     — String, current average

async function recordCompletion(deptId, startTime, endTime) {
  const duration = endTime - startTime;  // seconds
  await redis.rpush(`queue:${deptId}:window`, duration);
  await redis.ltrim(`queue:${deptId}:window`, -5, -1);  // keep last 5
  const window = await redis.lrange(`queue:${deptId}:window`, 0, -1);
  const avg = window.reduce((a, b) => a + +b, 0) / window.length;
  await redis.set(`queue:${deptId}:avg`, avg, 'EX', 3600);
  // Also update Supabase for audit trail
  await supabase.from('queue_entries')
    .update({ ended_at: new Date() }).eq('id', currentEntryId);
}

async function estimateWait(deptId, position) {
  const avg = await redis.get(`queue:${deptId}:avg`) || 600;  // 10min fallback
  return Math.round(position * avg / 60);  // return minutes
}
```

---

### Sprint 3 (Days 7–9) — ML Prediction + RAG Assistant

**Goal:** ML-powered wait time predictions active; RAG assistant deployed using Ollama + pgvector inside Supabase.

#### 2.3.1 ML FastAPI Service (Python)

```python
# POST /predict/waittime
@app.post('/predict/waittime')
async def predict(req: PredictRequest):
    features = extract_features(req)  # dept, hour, dow, queue_depth, visit_type
    ml_pred  = model.predict([features])[0]  # GBDT model
    ma_val   = redis.get(f'queue:{req.dept_id}:avg') or 600
    hybrid   = (0.6 * ml_pred) + (0.4 * float(ma_val) / 60)
    return {
        'estimate_minutes': round(hybrid, 1),
        'ml_component': round(ml_pred, 1),
        'ma_component': round(float(ma_val) / 60, 1)
    }
```

#### 2.3.2 RAG with pgvector + Ollama

```python
# Ingest SOP documents into Supabase pgvector
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_community.embeddings import OllamaEmbeddings

embeddings = OllamaEmbeddings(model='nomic-embed-text')
vectorstore = SupabaseVectorStore(
    client=supabase_client,
    embedding=embeddings,
    table_name='documents',        # pgvector table in Supabase
    query_name='match_documents'   # Supabase RPC function
)

# Query pipeline
from langchain_community.llms import Ollama
llm = Ollama(model='llama3:8b', base_url='http://ollama:11434')
qa = RetrievalQA.from_chain_type(llm=llm, retriever=vectorstore.as_retriever())
answer = qa.invoke({'query': 'Protocol for ICU bed overflow?'})
```

---

## 3. Environment Setup

```bash
# 1. Clone and configure
git clone https://github.com/your-org/hqbms && cd hqbms
cp .env.example .env  # fill SUPABASE_URL, SUPABASE_ANON_KEY, REDIS_URL

# 2. Start all services
docker compose up -d  # starts: supabase, redis, ml-service, ollama, novu

# 3. Apply DB migrations
supabase db push

# 4. Install frontend dependencies and run
cd apps/web && npm install && npm run dev

# 5. Train initial ML models
python ml_service/train.py

# 6. Visit http://localhost:3000 — login with seeded admin account
```

### docker-compose.yml Services

| Service | Image | Port | Purpose |
|---|---|---|---|
| `supabase-db` | `supabase/postgres:15` | 5432 | PostgreSQL + pgvector |
| `supabase-auth` | `supabase/gotrue` | 9999 | JWT auth |
| `supabase-realtime` | `supabase/realtime` | 4000 | Phoenix channels |
| `supabase-storage` | `supabase/storage-api` | 5000 | File storage |
| `next-app` | `./apps/web` | 3000 | Frontend + API routes |
| `ml-service` | `./ml_service` | 8000 | FastAPI ML + RAG |
| `ollama` | `ollama/ollama` | 11434 | Local LLM inference |
| `redis` | `redis:7-alpine` | 6379 | Moving average cache |
| `novu` | `novu/novu` | 3002 | Notification service |
| `grafana` | `grafana/grafana` | 3001 | Metrics dashboard |
| `prometheus` | `prom/prometheus` | 9090 | Metrics scraping |

---

## 4. MVP Feature Matrix

| Feature | Priority | Sprint | Effort (Days) |
|---|---|---|---|
| Real-time ICU/Ward Bed Dashboard | P0 — Must Have | Sprint 1 | 2 |
| Bed CRUD (Free/Occupied/Blocked) | P0 — Must Have | Sprint 1 | 1 |
| Patient Admission/Discharge/Transfer | P0 — Must Have | Sprint 1 | 2 |
| Supabase Auth (JWT + RBAC) | P0 — Must Have | Sprint 1 | 1 |
| OPD Queue Display (Live) | P0 — Must Have | Sprint 2 | 2 |
| Moving Average Wait Time Estimator | P0 — Must Have | Sprint 2 | 1 |
| Basic Appointment Booking | P1 — Should Have | Sprint 2 | 2 |
| ML Wait Time Prediction (GBDT/RF) | P1 — Should Have | Sprint 3 | 3 |
| RAG Assistant (Ollama + pgvector) | P1 — Should Have | Sprint 3 | 2 |
| Email/SMS Alerts via Novu | P1 — Should Have | Sprint 3 | 1 |
| PDF/Excel Export Reports | P2 — Nice to Have | Post-MVP | 2 |
| EMR API Integration | P2 — Nice to Have | Post-MVP | 3 |
