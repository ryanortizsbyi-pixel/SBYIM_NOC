-- ============================================================================
-- SBYIM NOC PORTAL - SAMPLE SEED DATA
-- ============================================================================

-- 1. Default Custom Types
INSERT INTO public.noc_custom_types (name)
VALUES 
    ('Activity'),
    ('Activity NOC')
ON CONFLICT (name) DO NOTHING;

-- 2. Default Custom Contractors
INSERT INTO public.noc_custom_contractors (name)
VALUES
    ('APEX ENGINEERING & INFRASTRUCTURE LTD.'),
    ('TRANS-GULF CONTRACTING CO.'),
    ('PIONEER DEMOLITION SPECIALISTS LLC'),
    ('SKYLINE ELECTROMECHANICAL SERVICES'),
    ('METROPOLITAN BUILDERS CORP.'),
    ('AL JABER BUILDING LLC'),
    ('ARABTEC CONSTRUCTION'),
    ('SIX CONSTRUCT')
ON CONFLICT (name) DO NOTHING;

-- 3. Initial Sample NOC Records
INSERT INTO public.noc_records (id, noc_number, noc_type, client, issued_to, company_code, date_of_issuance, date_of_expiration, description, documents)
VALUES 
(
    'noc_seed_001',
    'NOC-2026-0042',
    'Activity NOC',
    'Municipal Urban Development Authority',
    'APEX ENGINEERING & INFRASTRUCTURE LTD.',
    'APEX-01',
    '2026-01-15',
    '2026-12-31',
    'Construction authorization for multi-story commercial tower including structural foundation, deep basement excavation, and fire life safety system installation.',
    '[]'::jsonb
),
(
    'noc_seed_002',
    'NOC-2026-0118',
    'Activity',
    'National Highway Authority',
    'TRANS-GULF CONTRACTING CO.',
    'TG-2026',
    '2026-07-01',
    '2026-09-10',
    'Temporary road cutting permit for underground high-voltage 33kV cable laying across Sector 4B boulevard with complete traffic detour management.',
    '[]'::jsonb
),
(
    'noc_seed_003',
    'NOC-2025-0891',
    'Activity NOC',
    'Vertex Commercial Properties',
    'PIONEER DEMOLITION SPECIALISTS LLC',
    NULL,
    '2025-05-10',
    '2026-05-10',
    'Controlled mechanical demolition of obsolete two-story industrial warehouse structure, hazardous asbestos abatement, and site debris removal.',
    '[]'::jsonb
),
(
    'noc_seed_004',
    'NOC-2026-0205',
    'Activity',
    'State Water & Power Dept.',
    'SKYLINE ELECTROMECHANICAL SERVICES',
    'SKY-04',
    '2026-03-20',
    '2027-03-20',
    'Installation and commissioning of 1500kVA step-down compact substation transformer unit and feeder panel routing for residential district.',
    '[]'::jsonb
),
(
    'noc_seed_005',
    'NOC-2026-0310',
    'Activity NOC',
    'Grand Plaza Shopping Mall',
    'METROPOLITAN BUILDERS CORP.',
    NULL,
    '2026-06-01',
    '2026-11-30',
    'Internal architectural fit-out, HVAC duct installation, fire suppression sprinkler routing, and ceiling framing for retail store Units 104-106.',
    '[]'::jsonb
)
ON CONFLICT (noc_number) DO UPDATE
SET client = EXCLUDED.client,
    issued_to = EXCLUDED.issued_to,
    company_code = EXCLUDED.company_code,
    date_of_issuance = EXCLUDED.date_of_issuance,
    date_of_expiration = EXCLUDED.date_of_expiration,
    description = EXCLUDED.description;

-- 4. Initial User Accounts
INSERT INTO public.noc_users (username, password, role, display_name, email)
VALUES
    ('ryan', 'SBYIM@2026', 'developer', 'Ryan (Developer)', 'ryan@nocportal.gov'),
    ('admin', 'SBYIM@2026', 'admin', 'System Administrator', 'admin@nocportal.gov'),
    ('SBYIM', 'ManagementNOC', 'admin', 'SBYIM Management', 'sbyim@nocportal.gov'),
    ('developer', 'dev123', 'developer', 'Lead Developer (System Engineer)', 'developer@nocportal.gov'),
    ('security', 'security123', 'security', 'Security Officer (Lookup & View)', 'security@nocportal.gov'),
    ('main', 'main123', 'main', 'Main Control Officer (Lookup & View)', 'main@nocportal.gov'),
    ('guest', 'guest123', 'guest', 'Guest Officer / Viewer', 'guest@nocportal.gov')
ON CONFLICT (username) DO UPDATE
SET password = EXCLUDED.password,
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email;
