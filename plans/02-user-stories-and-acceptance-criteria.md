# HQBMS - User Stories and Acceptance Criteria

## 1. Patient Stories

### 1.1 OPD Self-Checkin and Queue Tracking
**User Story:** As an OPD Patient, I want to scan a QR code to check in and monitor my queue position on my phone, so that I don't have to wait in a crowded waiting room.
**Acceptance Criteria:**
- Given a QR code on the OPD board, when the patient scans it, they are redirected to a public `/checkin` page.
- The patient can select their department and submit personal details (Name, DOB, Visit Type).
- Upon submission, a token (e.g., A47) is generated and saved via `POST /api/queue/checkin`.
- The patient sees their token, current position in the queue, and an estimated wait time (blended ML + Moving Average).
- The patient receives an immediate SMS verification via Novu + Termii.
- The patient's queue position and wait time update in real-time on `/queue/{token}` via Supabase Realtime.
- The patient receives an SMS when their position reaches 3, asking them to proceed to the room.
- Following the consultation, an automated SMS requests feedback 30 minutes after completion.

## 2. Clinical Staff Stories

### 2.1 Bed Management and Patient Admission
**User Story:** As a Nurse, I want to view a real-time bed grid and admit patients to free beds, so I can accurately manage my unit's occupancy.
**Acceptance Criteria:**
- When logged in, the staff sees a color-coded bed grid (Green = free, Red = occupied, Yellow = blocked) specific to their unit (enforced via Supabase RLS).
- Real-time updates push grid color changes across all connected staff screens instantly.
- Clicking a green bed cell opens an Admission Modal.
- Staff can search for existing patients or create new ones, filling diagnosis and exam details.
- Submitting the admission updates the bed status to `occupied` transactionally.
- An audit log is automatically generated via a `log_bed_changes()` PostgreSQL trigger on updates.
- If occupancy exceeds 85%, a `check_occupancy_threshold()` PostgreSQL function triggers a webhook to Novu to send an admin alert.

### 2.2 Standard Operating Procedures (SOP) Assistance
**User Story:** As a Nurse, I want to ask an AI assistant about hospital protocols during high-stress situations (like ICU overflow), so I can quickly follow the correct procedure.
**Acceptance Criteria:**
- An AI chat widget (floating button) is available in the staff dashboard.
- Staff can ask questions like "Protocol for ICU bed overflow?".
- A LangChain + pgvector + FastAPI pipeline processes the query, performs similarity search, and passes context to an Ollama (LLaMA3) model.
- The answer must be grounded, strictly using specific citations from uploaded SOPs to prevent hallucinations, returning "not found" if out of context.

## 3. Hospital Admin Stories

### 3.1 Monitoring and Alerting
**User Story:** As a Hospital Admin, I want an overview dashboard of bed occupancy across all wards and receive alerts on capacity, so I can ensure smooth hospital operations.
**Acceptance Criteria:**
- The admin dashboard provides aggregated statistics (beds free/occupied %, avg wait times) visualized via ECharts.
- The admin can view real-time maps of all units within their hospital.
- If any unit drops below 15% available beds, an in-app toast and email alert is sent via Novu.
- Admins have access to an interface to upload new SOP PDF documents, which are processed via a `/rag/ingest` endpoint and chunked into the Supabase pgvector database for RAG.
- (Post-MVP) Admins can export a daily bed report as a PDF.

## 4. State Admin Stories

### 4.1 Multi-Hospital Oversight
**User Story:** As a State Administrator, I want to view aggregate occupancy across multiple municipalities, so I can direct resources where they are most needed.
**Acceptance Criteria:**
- State Admin authenticates with a specific role granting cross-hospital read access.
- The state dashboard shows aggregate metrics (total beds, free %, occupied %) grouped by municipality.
- Admins can drill down into a specific hospital's unit details in read-only mode.
- 30-day hospitalization trends are visualized via ECharts.
- State-wide PDF reports can be generated and downloaded.

## 5. Doctor Stories

### 5.1 Queue Consultation Flow
**User Story:** As an OPD Doctor, I want to call the next patient and mark consultations as complete, so that the queue advances automatically.
**Acceptance Criteria:**
- The doctor dashboard displays the live queue list for their assigned department, ordered by position.
- The doctor can click "Call Next" which updates `queue_entry.started_at` in Supabase.
- When the doctor clicks "Complete", `ended_at` is updated.
- The completion triggers a Redis Moving Average update, and Supabase Realtime broadcasts updated time estimates to all waiting patients.
- The doctor can mark a patient as "Missed" (`missed=true`), moving them back with a penalty position.
- The doctor has access to a hybrid wait time prediction blending ML predictions from the FastAPI service with the Redis moving average.
