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
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

-- audit_logs
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

-- pgvector documents
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

-- Enable RLS
ALTER TABLE health_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- STAFF POLICIES

-- Staff can only access their hospital's beds
CREATE POLICY "staff_unit_access_beds" ON beds
  FOR ALL USING (
    unit_id = (SELECT hospital_id FROM users WHERE id = auth.uid())
  );

-- Staff can only access their hospital's queue entries
CREATE POLICY "staff_unit_access_queues" ON queue_entries
  FOR ALL USING (
    dept_id IN (SELECT id FROM departments WHERE unit_id = (SELECT hospital_id FROM users WHERE id = auth.uid()))
  );

-- Admins and State Admins can read all unit stats
CREATE POLICY "admin_read_all_health_units" ON health_units
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'state_admin'))
  );

-- Audit Trigger for beds
CREATE OR REPLACE FUNCTION log_bed_changes()
RETURNS TRIGGER AS $$ BEGIN
  INSERT INTO audit_logs(user_id, action, entity, entity_id, old_json, new_json, ts)
  VALUES (auth.uid(), TG_OP, 'beds', NEW.id, row_to_json(OLD), row_to_json(NEW), now());
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER bed_audit AFTER UPDATE ON beds
  FOR EACH ROW EXECUTE FUNCTION log_bed_changes();

-- Bed Occupancy Threshold Trigger Function
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION check_occupancy_threshold()
RETURNS TRIGGER AS $$
DECLARE
  v_total_beds INT;
  v_occupied_beds INT;
  v_occupancy_ratio FLOAT;
BEGIN
  -- Only care about occupancy transitions
  IF NEW.status = 'occupied' AND OLD.status != 'occupied' THEN
    SELECT COUNT(*) INTO v_total_beds FROM beds WHERE unit_id = NEW.unit_id;
    SELECT COUNT(*) INTO v_occupied_beds FROM beds WHERE unit_id = NEW.unit_id AND status = 'occupied';
    
    v_occupancy_ratio := v_occupied_beds::FLOAT / NULLIF(v_total_beds, 0);
    
    -- Fire Webhook to Novu when 85% capacity is hit
    IF v_occupancy_ratio >= 0.85 THEN
      PERFORM net.http_post(
          url:='https://api.novu.co/v1/events/trigger',
          headers:='{"Content-Type": "application/json", "Authorization": "ApiKey placeholder_novu_api_key"}',
          body:=json_build_object(
            'name', 'high-occupancy-alert',
            'to', json_build_object(
                'subscriberId', NEW.unit_id,
                'email', 'admin@hospital.org'
            ),
            'payload', json_build_object(
                'hospital_id', NEW.unit_id,
                'occupancy', v_occupancy_ratio,
                'total_beds', v_total_beds
            )
          )::jsonb
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER occupancy_alert AFTER UPDATE ON beds
  FOR EACH ROW EXECUTE FUNCTION check_occupancy_threshold();

-- INDEXES
CREATE INDEX idx_beds_unit_status ON beds(unit_id, status);
CREATE INDEX idx_admissions_active ON admissions(bed_id) WHERE discharged_at IS NULL;
CREATE INDEX idx_queue_active ON queue_entries(dept_id, registered_at) WHERE ended_at IS NULL;
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id, ts DESC);
