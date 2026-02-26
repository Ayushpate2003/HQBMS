# HQBMS - Environment and DevOps Strategy

HQBMS ensures that no hospital data leaves the local or state-managed infrastructure. The DevOps strategy revolves around fully open-source, self-hosted deployments.

## 1. Local Development Environment
A single `docker-compose.yml` file provisions the entire local ecosystem identically to production, preventing "it works on my machine" errors.
```bash
git clone https://github.com/organization/hqbms
cp .env.example .env
docker compose up -d
supabase db push
# Stack is running on localhost (Traefik directs to Next.js on :3000, APIs on :8000)
```

## 2. Production Architecture

### Next.js & FastAPI Compute
Containers are orchestrated utilizing **Kubernetes (K3s)** for a lightweight, highly available cluster suitable for bare-metal hospital servers. 
- **Traefik** acts as the ingress controller, managing Let's Encrypt TLS certificates and rate-limiting (e.g., stopping DDoS on the public `/checkin` endpoint).

### Supabase Core
Supabase is deployed utilizing its official Docker Compose stack mapped to persistent volumes. 
PostgreSQL 15 is the single source of truth, avoiding the complexity of distributed Kafka clusters by leveraging Postgres' native WAL for real-time CDC (Change Data Capture) via Phoenix Channels.

### AI Compute
Ollama runs as a daemonized service with direct access to GPU resources (if available) or optimized CPU inference. Models (`llama3:8b`, `nomic-embed-text`) are pulled during the initialization script.

## 3. Observability & Monitoring
A comprehensive open-source observability stack is packaged alongside the application:
- **Metrics (Prometheus + Grafana):** Tracks API latency, PostgreSQL query execution times, ML inference duration, and active WebSocket connections.
- **Logs (Loki):** Aggregates stdout from Next.js, FastAPI, and Supabase containers.
- **Error Tracking (GlitchTip):** An open-source Sentry alternative. Captures all uncaught exceptions across the frontend and microservices for rapid triage.

## 4. CI / CD Pipeline
- **GitHub Actions:** Runs on every PR. Executes unit tests, `eslint`, `black` formatting, and builds the Next.js/FastAPI Docker images.
- **Trivy Scanner:** Scans Docker images for CVEs before pushing to the private registry.
- **ArgoCD:** Monitors the target branch and automatically deploys the updated Helm charts/manifests to the K3s cluster.
- **Automated Backups:** A secondary GitHub Action runs daily, executing `pg_dump` and pushing encrypted archives to an S3-compatible offsite bucket (e.g., Backblaze B2/MinIO).

## 5. Security & Secrets Management
- Application secrets (`POSTGRES_PASSWORD`, `JWT_SECRET`, etc.) are injected via Docker Secrets locally or HashiCorp Vault in production.
- Transport is secured universally with TLS 1.3.
- Database authorization is strictly controlled via Supabase GoTrue tokens coupled with Row Level Security.
