-- ============================================================================
-- SBYIM NOC PORTAL - SAMPLE SEED DATA
-- ============================================================================

-- Default Custom Types
INSERT INTO public.noc_custom_types (name)
VALUES 
    ('Activity'),
    ('Activity NOC')
ON CONFLICT (name) DO NOTHING;

-- Initial Sample NOC Records
INSERT INTO public.noc_records (id, noc_number, noc_type, client, issued_to, date_of_issuance, date_of_expiration, description, documents)
VALUES 
(
    'noc_seed_001',
    'NOC-2026-0042',
    'Activity NOC',
    'Municipal Urban Development Authority',
    'Apex Engineering & Infrastructure Ltd.',
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
    'Trans-Gulf Contracting Co.',
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
    'Pioneer Demolition Specialists LLC',
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
    'Skyline Electromechanical Services',
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
    'Metropolitan Builders Corp.',
    '2026-06-01',
    '2026-11-30',
    'Internal architectural fit-out, HVAC duct installation, fire suppression sprinkler routing, and ceiling framing for retail store Units 104-106.',
    '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
