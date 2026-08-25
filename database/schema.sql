-- ============================================================================
-- SBYIM NOC PORTAL - SUPABASE / POSTGRESQL DATABASE SCHEMA
-- ============================================================================
-- Compatible with Supabase SQL Editor and Standard PostgreSQL 14+
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Table: noc_records
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.noc_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    noc_number VARCHAR(100) UNIQUE NOT NULL,
    noc_type VARCHAR(100) NOT NULL DEFAULT 'Activity',
    client VARCHAR(255) NOT NULL,
    issued_to VARCHAR(255) NOT NULL,
    date_of_issuance DATE NOT NULL,
    date_of_expiration DATE NOT NULL,
    description TEXT,
    documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_noc_records_noc_number ON public.noc_records (noc_number);
CREATE INDEX IF NOT EXISTS idx_noc_records_noc_type ON public.noc_records (noc_type);
CREATE INDEX IF NOT EXISTS idx_noc_records_client ON public.noc_records (client);
CREATE INDEX IF NOT EXISTS idx_noc_records_issued_to ON public.noc_records (issued_to);
CREATE INDEX IF NOT EXISTS idx_noc_records_date_issuance ON public.noc_records (date_of_issuance DESC);
CREATE INDEX IF NOT EXISTS idx_noc_records_date_expiration ON public.noc_records (date_of_expiration ASC);
CREATE INDEX IF NOT EXISTS idx_noc_records_created_at ON public.noc_records (created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. Table: noc_requirements_docs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.noc_requirements_docs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL DEFAULT 0,
    data_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    uploaded_by VARCHAR(255) NOT NULL DEFAULT 'System Administrator'
);

CREATE INDEX IF NOT EXISTS idx_noc_req_docs_uploaded_at ON public.noc_requirements_docs (uploaded_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Table: sbyi_coc_docs (SBYI Code of Conduct (COC) PDF Documents)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sbyi_coc_docs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    size BIGINT NOT NULL DEFAULT 0,
    data_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    uploaded_by VARCHAR(255) NOT NULL DEFAULT 'SBYI Management'
);

CREATE INDEX IF NOT EXISTS idx_sbyi_coc_docs_uploaded_at ON public.sbyi_coc_docs (uploaded_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Table: noc_custom_types
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.noc_custom_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- 5. Trigger: Auto updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_noc_records_updated_at ON public.noc_records;
CREATE TRIGGER trg_noc_records_updated_at
    BEFORE UPDATE ON public.noc_records
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Row Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE public.noc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noc_requirements_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbyi_coc_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noc_custom_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on noc_records" ON public.noc_records;
CREATE POLICY "Allow all operations on noc_records"
    ON public.noc_records FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on noc_requirements_docs" ON public.noc_requirements_docs;
CREATE POLICY "Allow all operations on noc_requirements_docs"
    ON public.noc_requirements_docs FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on sbyi_coc_docs" ON public.sbyi_coc_docs;
CREATE POLICY "Allow all operations on sbyi_coc_docs"
    ON public.sbyi_coc_docs FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on noc_custom_types" ON public.noc_custom_types;
CREATE POLICY "Allow all operations on noc_custom_types"
    ON public.noc_custom_types FOR ALL TO public USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 7. Seed Default Types
-- ----------------------------------------------------------------------------
INSERT INTO public.noc_custom_types (name)
VALUES 
    ('Activity'),
    ('Activity NOC')
ON CONFLICT (name) DO NOTHING;
