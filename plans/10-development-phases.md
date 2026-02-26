# HQBMS - Development Phases

The MVP is developed over a tight 9-day schedule consisting of 3 tightly scoped sprints. 

## Sprint 1 (Days 1–3): Supabase Foundation + Bed Management
**Goal:** Establish the open-source backend core and deliver a live, real-time bed dashboard.

### Key Deliverables:
1. **Infrastructure:** Stand up the `docker-compose` stack (Supabase, Next.js base). 
2. **Schema & Security:** Run migrations for `health_units`, `beds`, `patients`, `admissions`, `users`. Enforce Row Level Security (RLS) policies.
3. **Authentication:** Implement Supabase GoTrue login and RBAC JWT claims.
4. **Bed Grid UI:** Build the Next.js visual bed mapper.
5. **Real-Time Wiring:** Integrate `supabase.channel()` so admissions and status changes instantly reflect green/red/yellow on all active clients.

## Sprint 2 (Days 4–6): Queue Management + Moving Average
**Goal:** Deliver the public OPD queue system with a highly responsive, locally calculated wait time estimator.

### Key Deliverables:
1. **Queue Schema:** Add `departments` and `queue_entries` tables.
2. **Public Check-in:** Create the unauthorized `/checkin` flow yielding a tracker token.
3. **Doctor Dashboard:** Provide standard "Call Next", "Missed", and "Complete" controls.
4. **Moving Average Engine:** Implement the Redis Node.js cache. On every `queue_entry` completion, update the 5-person moving average list and broadcast the new localized wait time via Supabase Realtime.
5. **Patient Tracker:** Build the `/queue/[token]` page.

## Sprint 3 (Days 7–9): ML Prediction + RAG Assistant
**Goal:** Deploy the Python AI satellites to enhance the queue with predictive modeling and equip staff with the SOP assistant.

### Key Deliverables:
1. **AI Microservice:** Build the FastAPI container structure.
2. **GBDT Training:** Script the `scikit-learn` pipeline (`train.py`) to pull historical `queue_entries`, train the model, and pickle it.
3. **Hybrid Inference API:** Expose the `/predict/waittime` endpoint blending ML and Redis moving average data.
4. **pgvector Integration:** Map the `documents` table and write the HNSW index and `match_documents` RPC.
5. **RAG Workflow:** Integrate LangChain and localized Ollama (`llama3:8b`, `nomic-embed-text`) into the `/rag/query` endpoint and expose the Next.js chatbot widget to staff.
6. **Notifications:** Hook `pg_net` threshold triggers into Novu for state/admin alerting.
