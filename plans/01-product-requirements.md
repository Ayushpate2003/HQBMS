# HQBMS - Product Requirements Document

## 1. Product Vision
Build a fully open-source, Supabase-powered hospital operations platform that gives patients live queue positions with AI-predicted wait times, and gives administrators a real-time bed occupancy dashboard — all backed by a RAG assistant grounded in hospital protocols. Zero proprietary software licences. Self-hostable for data sovereignty.

## 2. Problem Statement
- **No real-time bed visibility:** Delayed transfers and wrong planning, leading to 15+ min delay per inquiry for Admins and Charge Nurses.
- **Unpredictable OPD waiting:** Anxiety, crowding, and missed turns, leading to 30-45 min wasted per visit for Patients.
- **Manual paper admissions:** Data errors and no audit trail, taking ~15 min entry time per patient for Clinical Staff.
- **No AI wait prediction:** Workload spikes unmanaged, 47% higher MAE vs ML model.
- **No SOP quick reference:** Slow protocol lookup leading to 5-10 min delay per incident.
- **Data siloed per hospital:** State Admins cannot track resource allocation efficiently.

## 3. Target Users & Personas
- **Dr. Sharma (ICU Head):** Wants to see all unit beds at a glance via a real-time bed grid dashboard.
- **Nurse Priya (Ward Staff):** Wants to admit/discharge patients quickly via a fast mobile admission form.
- **Admin Rahul (State Health Dept):** Wants to aggregate occupancy across hospitals via a multi-unit summary dashboard.
- **Patient Ananya (OPD Visitor):** Wants to know exact wait time before arriving via an SMS/app wait time estimate.
- **Dr. Lee (OPD Doctor):** Wants to see predicted patient load per hour via ML-powered queue forecast.
- **IT Manager Vijay:** Wants to securely deploy, integrate, and maintain the system via open-source tools and Docker.
- **Compliance Officer:** Needs to audit patient data access using immutable logs.

## 4. Functional Requirements

### 4.1 Bed Management
- **FR-BED-001:** Real-time bed grid auto-updates on status change via Supabase Realtime CDC.
- **FR-BED-002:** CRUD beds with status (free/occupied/blocked) using PostgREST API + RLS.
- **FR-BED-003:** Admit, discharge, transfer patient linked to bed using Postgres FK + Edge Function.
- **FR-BED-004:** Aggregate occupancy at unit/state level via PostgreSQL aggregate views.
- **FR-BED-005:** Alert when unit occupancy exceeds 85% via DB Function + Novu webhook.
- **FR-BED-006:** LSTM-based 24hr ICU occupancy forecast via FastAPI ML service.
- **FR-BED-007:** Export bed report as PDF via Next.js API route + @react-pdf.

### 4.2 OPD Queue Management
- **FR-Q-001:** Patient self-checkin via web (QR scan → form).
- **FR-Q-002:** Live queue position display for patient via Realtime subscription.
- **FR-Q-003:** Moving average wait time (last 5 consultations) stored in Redis.
- **FR-Q-004:** ML-enhanced hybrid prediction (GBDT/RF) API.
- **FR-Q-005:** SMS notification at position 3 via Novu.
- **FR-Q-006:** Mark turn as missed; re-enter at penalty position.
- **FR-Q-007:** Department-level queue analytics dashboard via ECharts.

### 4.3 Appointment Management
- **FR-APPT-001:** Doctor slot creation and management with RLS policy.
- **FR-APPT-002:** Patient appointment booking (web + kiosk).
- **FR-APPT-003:** Conflict detection (no double-book) via PostgreSQL constraint.
- **FR-APPT-004:** Booking confirmation via SMS + email.
- **FR-APPT-005:** Appointment-to-queue auto conversion on arrival.

### 4.4 RAG Assistant
- **FR-RAG-001:** Upload hospital SOPs as PDF to knowledge base via Supabase Storage.
- **FR-RAG-002:** Semantic search over SOPs using pgvector.
- **FR-RAG-003:** Admin chatbot with source citations (LangChain + Ollama).
- **FR-RAG-004:** Auto-suggest bed protocol on ICU threshold alert.

## 5. Non-Functional Requirements
- **Performance:** Initial dashboard load < 2s (P95, SSR). Real-time update propagation < 2s. ML prediction response < 500ms.
- **Availability:** Supabase self-hosted uptime > 99.5%.
- **Scalability:** 500+ concurrent users per deployment.
- **Security:** RLS enforced on 100% of tables. Patient PII encrypted via `pgcrypto` column encryption.
- **Licence:** All tools open-source, zero proprietary licences.
- **Self-Hostable:** Full stack runs on-premise using `docker compose up`.
- **Accessibility:** WCAG 2.1 AA achieved with shadcn/ui.

## 6. Success Metrics
- Bed status update time reduced from 15 mins to < 30 seconds.
- OPD wait time prediction MAE < 15 min.
- Actual wait time reduction by 20%.
- Patient satisfaction (NPS) improved by 25 points.
- Staff adoption rate > 80% daily active.
- SOP lookup time reduced from 5-10 mins to < 30 seconds using RAG.
