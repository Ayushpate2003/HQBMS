# HQBMS - Information Architecture

## 1. System Navigation Overview
HQBMS is structured around role-based access control (RBAC). The information architecture isolates views based on the user's role (Patient, Staff, Hospital Admin, State Admin) with Supabase RLS policies ensuring data safety at the database level.

## 2. Sitemap

### 2.1 Public & Patient Views
- **Landing Page** (`/`) - Entry point describing the system.
- **OPD Check-in** (`/checkin`) - Public page for patients scanning the hospital QR code.
  - Form: Department selection, Patient Info.
- **Queue Tracker** (`/queue/[token]`) - Live status dashboard for patients. No authentication, reliant on secure URL tokens.

### 2.2 Shared Authentication
- **Login** (`/login`) - Supabase GoTrue authentication.
- **Forgot Password** (`/forgot-password`) - Password reset flow.

### 2.3 Staff Dashboard (Nurses, Receptionists)
- **Staff Home** (`/staff`) - Overview of the user's assigned unit/department.
- **Bed Grid** (`/staff/beds`) - Visual map of unit beds (Green/Red/Yellow).
  - Modal: Admit Patient / Update Bed Status.
- **Patient Directory** (`/staff/patients`) - Local unit patient search and history.
- **RAG Assistant Widget** - Global floating action button for quick SOP queries.

### 2.4 Doctor Dashboard
- **Queue Management** (`/doctor/queue`) - Actionable list of waiting patients (`Call Next`, `Complete`, `Missed`).
- **Load Forecast** (`/doctor/forecast`) - 2-hour predictive load charts powered by the ML Engine.
- **Patient History** (`/doctor/patients/[id]`) - View previous admission/queue logs.

### 2.5 Hospital Admin Dashboard
- **Admin Overview** (`/admin`) - High-level metrics (ECharts) across the hospital.
- **Ward Management** (`/admin/wards`) - Aggregate visualization of all units' bed grids.
- **SOP Management** (`/admin/sops`) - Document upload interface for the RAG engine.
- **Audit Logs** (`/admin/audit`) - Immutable operational logs for compliance.
- **Report Generation** (`/admin/reports`) - Interface to export PDF daily summaries.

### 2.6 State Admin Dashboard
- **State Overview** (`/state`) - Aggregated multi-hospital occupancy by municipality.
- **Hospital Drill-down** (`/state/hospital/[id]`) - Read-only view into a specific hospital's aggregated stats.
- **Global Reports** (`/state/reports`) - (Post-MVP) State-wide trend analysis and PDF export.

## 3. Data Entities & Relationships (High-Level)
- **Health Units (Hospitals/Clinics):** The top-level hierarchy enclosing Departments and Beds.
- **Departments (OPD/Wards):** Associated with specific Health Units. Contains Queue Entries.
- **Beds:** Assigned to Health Units. Can be Free, Occupied, or Blocked. Linked to Admissions.
- **Patients:** Central entity linked to both Queue Entries and Admissions.
- **Users (Staff/Admins):** Tied to a Health Unit and Role, dictating visibility policies.
