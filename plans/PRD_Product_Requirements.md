# HQBMS — Product Requirements Document (PRD)
**Hospital Queue & Bed Management System**
> Version 2.0 | Open-Source Stack | Supabase-Powered

---

## 1. Product Vision

Build a fully **open-source, Supabase-powered** hospital operations platform that gives patients live queue positions with AI-predicted wait times, and gives administrators a real-time bed occupancy dashboard — all backed by a RAG assistant grounded in hospital protocols.

**Zero proprietary software licences. Self-hostable for data sovereignty.**

---

## 2. Problem Statement

| Problem | Affected User | Impact | Metric |
|---|---|---|---|
| No real-time bed visibility | Admin, Charge Nurse | Delayed transfers, wrong planning | 15+ min delay per inquiry |
| Unpredictable OPD waiting | Patient | Anxiety, crowding, missed turns | 30–45 min wasted per visit |
| Manual paper admissions | Clinical Staff | Data errors, no audit trail | ~15 min entry time per patient |
| No AI wait prediction | Patient, Doctor | Workload spikes unmanaged | 47% higher MAE vs ML model |
| No SOP quick reference | All Staff | Slow protocol lookup | 5–10 min delay per incident |
| Data siloed per hospital | State Admin | Can't track resource allocation | No aggregate view |

---

## 3. Target Users & Personas

| Persona | Role | Goal | Key Feature Needed |
|---|---|---|---|
| Dr. Sharma | ICU Head | See all unit beds at a glance | Real-time bed grid dashboard |
| Nurse Priya | Ward Staff | Admit/discharge patients quickly | Fast mobile admission form |
| Admin Rahul | State Health Dept | Aggregate occupancy across hospitals | Multi-unit summary dashboard |
| Patient Ananya | OPD Visitor | Know exact wait time before arriving | SMS / app wait time estimate |
| Dr. Lee | OPD Doctor | See predicted patient load per hour | ML-powered queue forecast |
| IT Manager Vijay | Hospital IT | Deploy, integrate, maintain system | Open-source, Docker, API docs |
| Compliance Officer | HIPAA/DPDP | Audit patient data access | Immutable audit log viewer |

---

## 4. Functional Requirements

### 4.1 Bed Management

| FR ID | Requirement | Supabase Feature Used | Priority |
|---|---|---|---|
| FR-BED-001 | Real-time bed grid auto-updates on status change | Supabase Realtime CDC | P0 |
| FR-BED-002 | CRUD beds with status: free / occupied / blocked | PostgREST API + RLS | P0 |
| FR-BED-003 | Admit, discharge, transfer patient linked to bed | Postgres FK + Edge Function | P0 |
| FR-BED-004 | Aggregate occupancy at unit / state level | PostgreSQL aggregate views | P0 |
| FR-BED-005 | Alert when unit occupancy exceeds 85% | DB Function + Novu webhook | P1 |
| FR-BED-006 | LSTM-based 24hr ICU occupancy forecast | FastAPI ML service | P2 |
| FR-BED-007 | Export bed report as PDF | Next.js API route + @react-pdf | P2 |

### 4.2 OPD Queue Management

| FR ID | Requirement | Tech Implementation | Priority |
|---|---|---|---|
| FR-Q-001 | Patient self-checkin via web (QR scan → form) | Next.js public page + Supabase insert | P0 |
| FR-Q-002 | Live queue position display for patient | Supabase Realtime subscription | P0 |
| FR-Q-003 | Moving average wait time (last 5 consultations) | Redis list + Node.js API route | P0 |
| FR-Q-004 | ML-enhanced hybrid prediction (GBDT/RF) | FastAPI predict endpoint | P1 |
| FR-Q-005 | SMS notification at position 3 | Novu + Termii SMS gateway | P1 |
| FR-Q-006 | Mark turn as missed; re-enter at penalty position | Queue Service logic + Supabase | P1 |
| FR-Q-007 | Department-level queue analytics dashboard | ECharts + Supabase views | P2 |

### 4.3 Appointment Management

| FR ID | Requirement | Tech Implementation | Priority |
|---|---|---|---|
| FR-APPT-001 | Doctor slot creation and management | Supabase CRUD + RLS policy | P1 |
| FR-APPT-002 | Patient appointment booking (web + kiosk) | Next.js booking flow | P1 |
| FR-APPT-003 | Conflict detection (no double-book) | PostgreSQL constraint + DB function | P1 |
| FR-APPT-004 | Booking confirmation via SMS + email | Novu multi-channel notification | P1 |
| FR-APPT-005 | Appointment-to-queue auto conversion on arrival | Supabase Edge Function trigger | P2 |

### 4.4 RAG Assistant

| FR ID | Requirement | Tech Implementation | Priority |
|---|---|---|---|
| FR-RAG-001 | Upload hospital SOPs as PDF to knowledge base | Supabase Storage + ingestion pipeline | P1 |
| FR-RAG-002 | Semantic search over SOPs using pgvector | pgvector HNSW index in Supabase | P1 |
| FR-RAG-003 | Admin chatbot with source citations | LangChain + Ollama + Next.js widget | P1 |
| FR-RAG-004 | Auto-suggest bed protocol on ICU threshold alert | RAG query on alert trigger | P2 |

---

## 5. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| Performance | Initial dashboard load | < 2s (P95, SSR) |
| Performance | Real-time update propagation | < 2s (Supabase Realtime) |
| Performance | ML prediction response | < 500ms |
| Availability | Supabase self-hosted uptime | 99.5% |
| Scalability | Concurrent users | 500+ per deployment |
| Security | RLS enforced on all tables | 100% table coverage |
| Privacy | Patient PII encrypted | pgcrypto column encryption |
| Licence | All tools open-source | Zero proprietary licences |
| Self-Hostable | Full stack runs on-premise | `docker compose up` |
| Accessibility | WCAG 2.1 AA | shadcn/ui accessible components |

---

## 6. Success Metrics

| Metric | Before | Target (6 Months) | Measurement |
|---|---|---|---|
| Bed status update time | 15 min (phone call) | < 30 seconds | System timestamps |
| OPD wait time prediction MAE | N/A (no system) | < 15 min | ML evaluation |
| Actual wait time reduction | Baseline survey | −20% | Queue analytics |
| Patient satisfaction | Baseline survey | +25 NPS points | Post-visit SMS |
| Staff adoption rate | 0% | > 80% daily active | Supabase Auth logs |
| SOP lookup time | 5–10 min (manual) | < 30 seconds (RAG) | RAG usage analytics |

---

## 7. Out of Scope (v1.0)

- EMR deep integration — API hooks provided, integration in v2.0
- Direct integration with government health databases (planned v1.5)
- Billing and insurance claim management
- Pharmacy and lab management modules
- Surgical scheduling and operating room management
- HIPAA/GDPR full compliance certification (compliance review in v1.5)

---

## 8. Open-Source Licence Summary

| Tool | Licence | Commercial Use |
|---|---|---|
| Supabase (self-hosted) | Apache 2.0 | Yes |
| Next.js | MIT | Yes |
| shadcn/ui + Tailwind | MIT | Yes |
| scikit-learn | BSD 3-Clause | Yes |
| LangChain | MIT | Yes |
| Ollama | MIT | Yes |
| pgvector | MIT | Yes |
| Novu | MIT | Yes |
| Grafana | AGPL v3 | Yes (self-host) |
| Traefik | MIT | Yes |
| Redis | BSD 3-Clause | Yes |
