# HQBMS - Engineering Scope Definition

## 1. MVP Scope Statement
The Minimum Viable Product (MVP) isolates the core 70% of features required to operationalize the hospital bed grid and outpatient queues. It acts as a foundation built entirely on self-hosted open-source technologies (Supabase, Next.js, Redis, FastAPI, Ollama) allowing zero-licensing-cost deployment in resource-constrained public hospitals.

## 2. In Scope for MVP (v1.0)

### 2.1 Core Bed Management
- Visual map of ICU, Semi-ICU, and Ward beds.
- Real-time status indicators (Free, Occupied, Blocked).
- Patient Admission, Discharge, and Transfer workflows linked directly to beds.
- Over-capacity threshold automated alerts (via Novu).

### 2.2 Outpatient Queue Management
- Public QR-code self-check-in web forms.
- Hybrid Wait Time Estimates (Redis Moving Average + Scikit-Learn GBDT/RF).
- Live position tracking viewable on patient smartphones using Supabase Realtime.
- SMS notifications indicating queue progress (e.g., "You are position 3") via Novu+Termii.

### 2.3 System & Analytics
- Role-Based Access Control (RBAC) via Supabase GoTrue.
- Hospital Admin summary dashboards (ECharts).
- RAG-based AI assistant capable of answering protocol questions grounded in uploaded PDF SOPs.

## 3. Out of Scope for MVP (v1.0)
- **Deep EMR Integration:** v1.0 operates standalone. API hooks are provided for future HL7/FHIR integration (v2.0).
- **Billing & Insurance Management:** Financial tracking is completely excluded.
- **Surgical Scheduling:** Operating room utilization is out of scope.
- **Direct Government Database Sync:** State health database auto-syncing is deferred to v1.5 (currently handled via state admin dashboard).

## 4. Feature Priority Matrix

| Feature | Category | Priority | Effort Estimate |
|---|---|---|---|
| Real-time Bed Dashboard | Core | P0 (Must Have) | 2 Days |
| Bed CRUD Operations | Core | P0 (Must Have) | 1 Day |
| Supabase Auth & RBAC | Core | P0 (Must Have) | 1 Day |
| OPD Queue Display (Live) | Queue | P0 (Must Have) | 2 Days |
| Moving Average Estimator | AI/Queue | P0 (Must Have) | 1 Day |
| Email/SMS Alerts (Novu) | System | P1 (Should Have) | 1 Day |
| ML Wait Time Prediction | AI | P1 (Should Have) | 3 Days |
| RAG Assistant (Ollama) | AI | P1 (Should Have) | 2 Days |
| PDF/Excel Reports | Export | P2 (Nice to Have) | Post-MVP |
| EMR API Integration | Integration | P2 (Nice to Have) | Post-MVP |
