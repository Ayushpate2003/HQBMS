# HQBMS - Monorepo Structure

The project is structured as a monorepo containing the Next.js frontend, the FastAPI machine learning service, and Supabase configurations. Using Docker Compose, all components can be spun up simultaneously.

## Directory Tree

```
hqbms/
├── apps/
│   ├── web/                      # Next.js 14 Web Application
│   │   ├── app/                  # App Router (Pages & Layouts)
│   │   │   ├── (auth)/           # Login/Signup groupings
│   │   │   ├── (dashboard)/      # Protected routes (Admin/Staff)
│   │   │   ├── checkin/          # Public OPD QR routing
│   │   │   ├── queue/            # Public live tracking view
│   │   │   └── api/              # API routes (Redis, Novu orchestrations)
│   │   ├── components/           # UI Components
│   │   │   ├── ui/               # shadcn/ui generic primitives
│   │   │   └── hospital/         # Domain-specific (BedGrid, QueueList)
│   │   ├── lib/                  # Utilities (Supabase client, Redis connect)
│   │   ├── hooks/                # Custom React hooks (useRealtimeBeds)
│   │   ├── package.json
│   │   └── tailwind.config.ts
│   │
│   └── ml_service/                 # Python FastAPI AI service
│       ├── app/
│       │   ├── main.py           # FastAPI entry point
│       │   ├── models/           # Scikit-learn pickled artifacts (*.pkl)
│       │   ├── routes/           # /predict and /rag definitions
│       │   └── services/         # Predictor logic, LangChain RAG pipeline
│       ├── train.py              # Script to retrain GBDT models
│       ├── Dockerfile
│       └── requirements.txt
│
├── packages/                     # Shared monorepo config
│   ├── eslint-config/
│   └── typescript-config/
│
├── supabase/                     # Supabase local environment config
│   ├── migrations/               # PostgreSQL DDLs & RLS policies
│   ├── functions/                # Edge functions (Deno)
│   ├── seed.sql                  # Initial mock data for development
│   └── config.toml               # Supabase CLI configuration
│
├── docker-compose.yml            # Unified orchestration (Next, ML, Postgres, Redis)
├── package.json                  # Root monorepo scripts (e.g., turbo run dev)
├── README.md
└── .github/
    └── workflows/                # CI/CD pipelines (Test, Deploy, DB Push)
```

## Key Infrastructure Components

- **`docker-compose.yml`**: Defines the self-hosted environment, including:
  - `supabase-db` (PostgreSQL 15 + pgvector)
  - `supabase-auth` (GoTrue)
  - `supabase-realtime` (Phoenix channels)
  - `supabase-storage` (S3-compatible API)
  - `redis` (7-alpine, Moving average cache)
  - `next-app` (Frontend + API routes, port 3000)
  - `ml-service` (FastAPI + RAG, port 8000)
  - `ollama` (Local LLM daemon `llama3:8b` and `nomic-embed-text`)
  - `novu` (Notification worker stack)
  - `grafana` & `prometheus`
  - `traefik` (Reverse proxy + TLS)

- **`supabase/migrations/`**: Vital directory containing all transactional schema setups. Must be applied via `supabase db push` prior to starting the application logic services.
