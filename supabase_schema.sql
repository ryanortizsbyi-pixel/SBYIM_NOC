-- ============================================================================
-- SBYIM NOC PORTAL - SUPABASE / POSTGRESQL DATABASE SCHEMA
-- ============================================================================
-- Instructions:
-- 1. Open your Supabase Project Dashboard (https://supabase.com/dashboard)
-- 2. Go to the SQL Editor (left sidebar > SQL Editor)
-- 3. Paste this entire script and click "Run" (or press Ctrl+Enter / Cmd+Enter)
-- 4. Copy your Project URL & Anon Key from Project Settings > API
-- 5. Paste them into the Database Settings modal in the NOC Portal Web App!
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. TABLE: noc_records (Main NOC Certificate & Permit Registry)
-- ============================================================================
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

-- Comments for documentation
COMMENT ON TABLE public.noc_records IS 'Official No Objection Certificate (NOC) registry storing permit details and attachments';
COMMENT ON COLUMN public.noc_records.documents IS 'Array of JSON objects containing document metadata and DataURL/Storage paths';

-- Create performance indexes for search, filtering, and sorting
CREATE INDEX IF NOT EXISTS idx_noc_records_noc_number ON public.noc_records (noc_number);
CREATE INDEX IF NOT EXISTS idx_noc_records_noc_type ON public.noc_records (noc_type);
CREATE INDEX IF NOT EXISTS idx_noc_records_client ON public.noc_records (client);
CREATE INDEX IF NOT EXISTS idx_noc_records_issued_to ON public.noc_records (issued_to);
CREATE INDEX IF NOT EXISTS idx_noc_records_date_issuance ON public.noc_records (date_of_issuance DESC);
CREATE INDEX IF NOT EXISTS idx_noc_records_date_expiration ON public.noc_records (date_of_expiration ASC);
CREATE INDEX IF NOT EXISTS idx_noc_records_created_at ON public.noc_records (created_at DESC);

-- ============================================================================
-- 2. TABLE: noc_requirements_docs (Official Guidelines & Compliance Files)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.noc_requirements_docs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL DEFAULT 0,
    data_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    uploaded_by VARCHAR(255) NOT NULL DEFAULT 'System Administrator'
);

COMMENT ON TABLE public.noc_requirements_docs IS 'Official NOC guideline and standard compliance documents (Max 5 documents enforced)';
CREATE INDEX IF NOT EXISTS idx_noc_req_docs_uploaded_at ON public.noc_requirements_docs (uploaded_at DESC);

-- ============================================================================
-- 3. TABLE: sbyi_coc_docs (SBYI Code of Conduct (COC) PDF Documents)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sbyi_coc_docs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    size BIGINT NOT NULL DEFAULT 0,
    data_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    uploaded_by VARCHAR(255) NOT NULL DEFAULT 'SBYI Management'
);

COMMENT ON TABLE public.sbyi_coc_docs IS 'Official SBYI Code of Conduct (COC) PDF Documents (Max 8 PDF files enforced)';
CREATE INDEX IF NOT EXISTS idx_sbyi_coc_docs_uploaded_at ON public.sbyi_coc_docs (uploaded_at DESC);

-- ============================================================================
-- 4. TABLE: noc_custom_types (Dynamic NOC Categories)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.noc_custom_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.noc_custom_types IS 'Custom NOC classification types added by administrators';

-- ============================================================================
-- 5. AUTOMATIC TIMESTAMP TRIGGER (Updates updated_at on row modification)
-- ============================================================================
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

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS
ALTER TABLE public.noc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noc_requirements_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbyi_coc_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noc_custom_types ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies if any
DROP POLICY IF EXISTS "Allow public read on noc_records" ON public.noc_records;
DROP POLICY IF EXISTS "Allow all operations on noc_records" ON public.noc_records;
DROP POLICY IF EXISTS "Allow public read on noc_requirements_docs" ON public.noc_requirements_docs;
DROP POLICY IF EXISTS "Allow all operations on noc_requirements_docs" ON public.noc_requirements_docs;
DROP POLICY IF EXISTS "Allow public read on sbyi_coc_docs" ON public.sbyi_coc_docs;
DROP POLICY IF EXISTS "Allow all operations on sbyi_coc_docs" ON public.sbyi_coc_docs;
DROP POLICY IF EXISTS "Allow public read on noc_custom_types" ON public.noc_custom_types;
DROP POLICY IF EXISTS "Allow all operations on noc_custom_types" ON public.noc_custom_types;

-- Simple, permissive policies for NOC Portal Web App (Supports anon public key & authenticated users)
CREATE POLICY "Allow all operations on noc_records"
    ON public.noc_records
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on noc_requirements_docs"
    ON public.noc_requirements_docs
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on sbyi_coc_docs"
    ON public.sbyi_coc_docs
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on noc_custom_types"
    ON public.noc_custom_types
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 7. SEED DATA (Default Standard Types)
-- ============================================================================
INSERT INTO public.noc_custom_types (name)
VALUES 
    ('Activity'),
    ('Activity NOC')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- END OF SCHEMA SCRIPT
-- ============================================================================
