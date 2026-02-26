# HQBMS - Database Schema & Security Models

## 1. Relational Schema Overview (PostgreSQL 15)

The database is built on PostgreSQL 15, hosted via Supabase. It uses UUIDs for all primary keys and utilizes Supabase's built-in `auth.users` for identity management.

### 1.1 Core Tables (DDL)

```sql
-- health_units (Hospitals or Clinics)
CREATE TABLE health_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, 
  type TEXT, 
  municipality TEXT,
  state TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- beds
CREATE TABLE beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES health_units(id) ON DELETE CASCADE,
  bed_code TEXT NOT NULL, 
  type TEXT,   -- ICU | semi-ICU | ward
  status TEXT DEFAULT 'free', -- free | occupied | blocked
  blocked_reason TEXT, 
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- patients (Encrypted PII via pgcrypto)
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_enc TEXT NOT NULL, -- Encrypted using pgcrypto extension
  dob_enc TEXT,
  gender TEXT,
  municipality TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- admissions
CREATE TABLE admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  bed_id UUID REFERENCES beds(id),
  diagnosis TEXT,
  status TEXT DEFAULT 'active', -- active | discharged | transferred
  admitted_at TIMESTAMPTZ DEFAULT now(),
  discharged_at TIMESTAMPTZ
);

-- departments (Within Health Units)
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES health_units(id),
  name TEXT NOT NULL, 
  category TEXT, 
  open_from TIME, 
  open_to TIME
);

-- queue_entries
CREATE TABLE queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  dept_id UUID REFERENCES departments(id),
  registered_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ, 
  ended_at TIMESTAMPTZ,
  missed BOOLEAN DEFAULT false,
  visit_type TEXT  -- appointment | walkin
);

-- users (Linked to auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email_enc TEXT NOT NULL,
  role TEXT NOT NULL, -- admin | doctor | nurse | receptionist | state_admin
  hospital_id UUID REFERENCES health_units(id)
);
```

## 2. Row Level Security (RLS) Policies

Supabase enforces Row Level Security at the Postgres layer to guarantee data isolation between hospitals. Staff members can only query or modify data belonging to their assigned `hospital_id`.

```sql
-- Enable RLS
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;

-- Staff can only access their hospital's beds
CREATE POLICY 'staff_unit_access_beds' ON beds
  FOR ALL USING (
    unit_id = (SELECT hospital_id FROM users WHERE id = auth.uid())
  );

-- Admins and State Admins can read all unit stats
CREATE POLICY 'admin_read_all' ON health_units
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'state_admin'))
  );
```

## 3. Vector Database (pgvector for RAG)

SOPs and protocol documents are embedded and stored natively in Postgres using the `pgvector` extension.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding VECTOR(768),  -- Sized for nomic-embed-text
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW Index for rapid similarity lookups
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- RPC Function for LangChain Similarity Search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(768), match_count INT DEFAULT 5)
RETURNS TABLE(id UUID, content TEXT, metadata JSONB, similarity FLOAT)
LANGUAGE SQL AS $$
  SELECT id, content, metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM documents
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
```

## 4. Audit Triggers
PostgreSQL triggers automatically write to an `audit_logs` table upon any modification, ensuring full compliance tracing without requiring application-level logic.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  old_json JSONB,
  new_json JSONB,
  ts TIMESTAMPTZ DEFAULT now()
);
CREATE OR REPLACE FUNCTION log_bed_changes()
RETURNS TRIGGER AS $$ BEGIN
  INSERT INTO audit_logs(user_id, action, entity, entity_id, old_json, new_json, ts)
  VALUES (auth.uid(), TG_OP, 'beds', NEW.id, row_to_json(OLD), row_to_json(NEW), now());
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER bed_audit AFTER UPDATE ON beds
  FOR EACH ROW EXECUTE FUNCTION log_bed_changes();
```

## 5. Indexing Strategy
```sql
-- Beds: frequent occupancy filter
CREATE INDEX idx_beds_unit_status ON beds(unit_id, status);

-- Admissions: current occupants (partial index)
CREATE INDEX idx_admissions_active ON admissions(bed_id)
  WHERE discharged_at IS NULL;

-- Queue: active queue per department (partial index)
CREATE INDEX idx_queue_active ON queue_entries(dept_id, registered_at)
  WHERE ended_at IS NULL;

-- Audit logs: compliance queries
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id, ts DESC);
```
