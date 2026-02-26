# HQBMS - Testing Strategy

To ensure clinical safety and robust data integrity, HQBMS requires a rigorous testing approach across all functional tiers, particularly targeting the real-time bed updates and wait time estimations.

## 1. Unit Testing
- **Frontend (Next.js):** 
  - `Jest` and `React Testing Library`.
  - Focuses on complex UI mutations: BedGrid color transitions based on data states, formatting the Queue Moving Average accurately.
- **Backend (FastAPI):**
  - `Pytest`.
  - Focuses meticulously on the Feature Extraction logic. We must guarantee that `ended_at - registered_at` never yields negative outliers due to time-zone mishandling, as this would poison the ML training dataset.

## 2. Integration Testing
- **Supabase Realtime Verification:**
  - Automated tests simulating an `UPDATE` on the `beds` table using the PostgREST API, observing a dummy WebSocket client to ensure the CDC payload arrives within < 500ms.
- **RAG Pipeline Validation:**
  - Testing the `/rag/query` pipeline utilizing a mock `pgvector` return to verify LangChain correctly parses the prompt and Ollama generates a response containing the exact injected citations.

## 3. End-to-End (E2E) Browser Testing
Utilizes `Playwright` to test critical user journeys visually:
1. **The Check-in Flow:** Navigating to `/checkin`, filling the React Hook Form, submitting, and verifying generation of Token A47 on the patient dashboard.
2. **The Clinical Admission Flow:** Logging in as Nurse Priya, clicking a green bed, submitting an admission, and verifying the bed turns red.
3. **The Queue Progression:** Logging in as Doctor Lee, clicking "Call Next", and verifying the Wait Time on the mock patient's browser instantly decreases.
4. **Integration Journey:** Full patient flow (checkin → queue → SMS → ML estimate → RAG query).

## 4. Machine Learning Evaluation
The Wait Time model (GBDT/Random Forest) is evaluated programmatically on every retraining cycle (Sunday 2AM).
- Target Metric: Mean Absolute Error (MAE) must be < 15 minutes.
- If the Challenger Model (newly trained) outperforms the Champion Model (currently deployed) by > 5% on the test split, it is automatically serialized to `joblib` and promoted to the `ml-models` bucket.
- The Python evaluation script will alert the engineering team via GlitchTip if data drift is detected (e.g., MAE suddenly spikes to 45 mins).

## 5. Load and Concurrency Testing
Given hospital peak hours, the system must not drop Redis connections or lock Postgres tables.
- **K6 / Locust:** 
  - Simulating 500 concurrent users hitting public HTTP check-ins (`/api/v1/queue/checkin`).
  - Simulating 200 concurrent WebSockets actively listening to `beds` and `queue_entries` channels.
  - Asserting 0% HTTP 5xx codes and sub-200ms API response times.
