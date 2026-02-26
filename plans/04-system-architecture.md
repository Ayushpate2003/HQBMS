# HQBMS - System Architecture

## 1. Executive Summary
The system utilizes a **majestic monolith + AI satellites** pattern. The core of HQBMS is a monolithic frontend/backend hybrid inside Next.js, built heavily relying on a self-hosted Supabase instance for database (PostgreSQL 15), authentication, real-time messaging, and storage. Computationally heavy or specialized workloads (ML, LLM RAG) run as stateless microservices.

## 2. Global Architecture Stack
- **Frontend / API:** Next.js 14 (App Router)
- **UI & Styling:** Tailwind CSS + shadcn/ui + Apache ECharts
- **Core Backend:** Supabase (Self-hosted via Docker Compose)
  - **Database:** PostgreSQL 15 + pgvector
  - **Auth:** Supabase GoTrue (JWT)
  - **Real-Time:** Supabase Realtime (Phoenix Channels)
  - **Storage:** Supabase Storage
- **Caching & Quick State:** Redis (Moving Average Queue computation)
- **ML / AI Microservice:** Python FastAPI
  - **Models:** scikit-learn (GBDT/RF)
  - **RAG:** LangChain + pgvector + Ollama (llama3:8b, nomic-embed-text)
- **Notifications:** Novu (Email / SMS)
- **Infrastructure:** Docker, Traefik (Gateway), Prometheus + Grafana (Monitoring)

## 3. Layer Detail & Interactions

### 3.1 Presentation Layer
Next.js handles SSR for dashboard initialization. Client Components subscribe to `supabase.channel()` to observe Postgres CDC (Change Data Capture) events. State is merged into a TanStack Query cache dynamically to ensure instant UI reactivity without full page polling.

### 3.2 Supabase Data & Auth Layer
Supabase replaces traditional disparate backend services. GoTrue handles JWT assignment, embedding `role` and `hospital_id` claims. Postgres Row Level Security (RLS) dynamically filters reads based on these JWT claims. 

Real-time flows directly out of Postgres transaction logs. e.g., an `UPDATE beds SET status='occupied'` automatically pushes a payload over WebSockets to any client subscribing to the `beds` channel.

### 3.3 AI / ML Satellite Tier
The FastAPI service executes wait time prediction heuristics (`0.6 ML + 0.4 Moving Average`). It natively calls Redis to retrieve the latest rolling average, injects ML features, and responds synchronously.
The RAG pipeline works within FastAPI by vectorizing queries via Ollama (nomic-embed), executing a Postgres `match_documents` RPC similarity search, and piping the context to Ollama's LLaMA3 model.

## 4. Primary Data Flows

### Real-Time Realization Model
1. Client actions trigger `supabase.from('table').update/insert()`.
2. Postgres writes to disk, evaluating constraints and triggering audit functions.
3. Supabase Realtime reads the WAL (Write-Ahead Log) and publishes diffs.
4. Active Next.js clients intercept payloads and patch visual state in milliseconds.

### Threshold Alerts
Using Postgres internal triggers, if a bed update pushes the aggregate occupancy over 85%, a `pg_net` async HTTP hook calls the Novu notification server, which sequences out Emails and SMS alerts to the respective hospital administrator without blocking the original transaction.

## 5. Deployment Topology
The system is self-hostable in disconnected or air-gapped environments fulfilling strict healthcare data compliance requirements. 
A single robust VM handles the entire `docker-compose` topology behind a Traefik proxy managing TLS offloading. 
ArgoCD and K3s can be utilized for scaled multi-node bare-metal production environments.
