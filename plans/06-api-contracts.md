# HQBMS - API Contracts

The application utilizes Supabase's auto-generated PostgREST APIs for standard CRUD operations, combined with Next.js API Routes and FastAPI endpoints for complex business logic. 

## 1. Bed Management APIs (Standard PostgREST)

| Method | Endpoint | Description | Auth Requirement |
|---|---|---|---|
| `GET` | `/rest/v1/beds?unit_id=eq.{id}` | Fetch beds for a unit | Valid JWT (RLS enforced) |
| `PATCH`| `/rest/v1/beds?id=eq.{id}` | Update bed status | Valid JWT (Staff/Admin) |
| `POST` | `/rest/v1/admissions` | Create new admission | Valid JWT (Staff) |
| `GET` | `/rest/v1/beds/stats/realtime`| Get unit occupancy aggregates | Valid JWT |

*Note: All realtime updates are delivered via WebSockets over `supabase.channel('beds')`.*

## 2. Queue Management APIs (Next.js Edge/Serverless)

These hit `/api/v1/` routes hosted in Next.js to orchestrate Redis, ML prediction, and Supabase insertions synchronously.

### `POST /api/v1/queue/checkin`
Registers a patient in the OPD queue.
**Request Body:**
```json
{
  "patient_name": "Ananya K.",
  "dob": "1990-05-14",
  "dept_id": "uuid-v4-string",
  "visit_type": "walkin"
}
```
**Response (200 OK):**
```json
{
  "token": "A47",
  "position": 6,
  "queue_entry_id": "uuid-v4",
  "estimate_minutes": 32.5
}
```

### `PATCH /api/v1/queue/:entryId/complete`
Marks consultation as complete and updates the Redis moving average window.
**Request Body:**
```json
{ "action": "complete" }
```
**Response (200 OK):**
```json
{ "status": "success", "new_dept_avg_seconds": 645 }
```

## 3. Fast API Machine Learning Endpoints

Hosted on a separate python container (`ml-service` on port `8000`).

### `POST /predict/waittime`
Computes the hybrid wait time prediction for a given department.
**Request Body:**
```json
{
  "dept_id": "uuid-v4",
  "queue_depth": 5,
  "hour": 14,
  "dow": 2,
  "visit_type": 1
}
```
**Response:**
```json
{
  "estimate_minutes": 32.5,
  "ml_component": 28.0,
  "ma_component": 35.5
}
```

### `POST /rag/query`
Executes semantic search over hospital SOPs and returns a synthesized LLM answer.
**Request Body:**
```json
{
  "question": "What is the ICU overflow protocol?",
  "dept_context": "ICU Ward B"
}
```
**Response:**
```json
{
  "answer": "According to the Critical Care SOP (Section 4), when ICU capacity reaches 100%, stable patients should be transitioned to a step-down Semi-ICU unit. Alert the floor supervisor immediately.",
  "sources": [
    { "id": "doc-uuid", "title": "Critical Care SOP 2024", "page": 12 }
  ],
  "confidence": 0.89
}
```

### `POST /rag/ingest`
Admin endpoint to upload new PDF SOPs for pgvector chunking and embedding.
**Request (Multipart Form Data):**
`file`: `[binary pdf stream]`
**Response:**
```json
{ "status": "success", "chunks_added": 45, "doc_id": "uuid-v4" }
```
