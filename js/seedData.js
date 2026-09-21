/**
 * NOC Portal - Initial Realistic Seed Data
 * Generates realistic NOC records with embedded sample PDF and image documents for testing.
 */

// Helper to create a clean SVG Data URL simulating an architectural plan or inspection image
function createSampleSVGImage(title, subtitle, color = '#1E40AF') {
  const svgString = `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F8FAFC"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#CBD5E1" stroke-width="0.8"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#grid)"/>
  <rect x="40" y="40" width="720" height="520" rx="12" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/>
  <rect x="40" y="40" width="720" height="90" rx="12" fill="url(#headerGrad)"/>
  <text x="70" y="85" fill="#FFFFFF" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-size="24" font-weight="bold">OFFICIAL NOC VERIFICATION ATTACHMENT</text>
  <text x="70" y="112" fill="rgba(255,255,255,0.85)" font-family="Arial, sans-serif" font-size="14">DOCUMENT IDENTIFIER: ${subtitle}</text>
  
  <rect x="70" y="160" width="660" height="260" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
  <circle cx="140" cy="230" r="45" fill="${color}" opacity="0.15"/>
  <path d="M125 230 L135 240 L155 220" stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round"/>
  
  <text x="210" y="215" fill="#0F172A" font-family="Arial, sans-serif" font-size="20" font-weight="bold">${title}</text>
  <text x="210" y="245" fill="#64748B" font-family="Arial, sans-serif" font-size="14">Certified Engineering & Site Clearance Inspection Drawing</text>
  <text x="210" y="275" fill="#059669" font-family="Arial, sans-serif" font-size="13" font-weight="bold">STATUS: OFFICIAL CLEARANCE GRANTED</text>

  <!-- Technical drawing details -->
  <line x1="100" y1="340" x2="700" y2="340" stroke="#94A3B8" stroke-dasharray="4" stroke-width="1.5"/>
  <rect x="100" y="360" width="180" height="40" fill="#EFF6FF" stroke="#3B82F6" rx="4"/>
  <text x="120" y="385" fill="#1E40AF" font-family="monospace" font-size="12">COORD: 25.2048° N, 55.2708° E</text>
  
  <rect x="300" y="360" width="180" height="40" fill="#ECFDF5" stroke="#10B981" rx="4"/>
  <text x="325" y="385" fill="#065F46" font-family="monospace" font-size="12">SAFETY PROTOCOL: ISO-45001</text>

  <rect x="500" y="360" width="200" height="40" fill="#F1F5F9" stroke="#64748B" rx="4"/>
  <text x="525" y="385" fill="#334155" font-family="monospace" font-size="12">STAMP: AUDITED & APPROVED</text>

  <rect x="70" y="445" width="660" height="85" rx="8" fill="#F1F5F9"/>
  <text x="90" y="475" fill="#334155" font-family="Arial, sans-serif" font-size="12" font-weight="bold">COMPLIANCE NOTICE:</text>
  <text x="90" y="495" fill="#64748B" font-family="Arial, sans-serif" font-size="11">This official document constitutes valid proof of compliance and authorization under the designated Municipal Regulatory Authority.</text>
  <text x="90" y="515" fill="#64748B" font-family="Arial, sans-serif" font-size="11">Authorized personnel may verify this record using the system NOC unique identification key.</text>
</svg>
`.trim();

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString);
}

// Minimal valid PDF Data URL for testing
function createSamplePDFDataURL(nocNumber, title) {
  const cleanNoc = String(nocNumber || 'NOC-OFFICIAL').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const cleanTitle = String(title || 'Official Authorization').substring(0, 75).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  
  const streamData = `BT
/F1 18 Tf
50 720 Td
(NO OBJECTION CERTIFICATE - OFFICIAL RECORD) Tj
0 -30 Td
/F1 13 Tf
(NOC Number: ${cleanNoc}) Tj
0 -24 Td
(Scope: ${cleanTitle}) Tj
0 -24 Td
(Status: Verified & Registered under SBYI Regulatory Authority) Tj
0 -36 Td
/F1 10 Tf
(This document serves as official authorization for the designated scope of work.) Tj
0 -18 Td
(All activities must comply with Sir Bani Yas Island security and safety guidelines.) Tj
ET`;

  const pdfContent = `%PDF-1.4
1 0 obj
<< /Title (${cleanNoc})
   /Creator (SBYIM NOC Portal) >>
endobj
2 0 obj
<< /Type /Catalog
   /Pages 3 0 R >>
endobj
3 0 obj
<< /Type /Pages
   /Kids [4 0 R]
   /Count 1 >>
endobj
4 0 obj
<< /Type /Page
   /Parent 3 0 R
   /Resources << /Font << /F1 5 0 R >> >>
   /MediaBox [0 0 612 792]
   /Contents 6 0 R >>
endobj
5 0 obj
<< /Type /Font
   /Subtype /Type1
   /BaseFont /Helvetica >>
endobj
6 0 obj
<< /Length ${streamData.length} >>
stream
${streamData}
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000078 00000 n 
0000000131 00000 n 
0000000194 00000 n 
0000000306 00000 n 
0000000380 00000 n 
trailer
<< /Size 7
   /Root 2 0 R
   /Info 1 0 R >>
startxref
${450 + streamData.length}
%%EOF`;

  return 'data:application/pdf;base64,' + btoa(unescape(encodeURIComponent(pdfContent)));
}

// ============================================================================
// OFFICIAL NOC RECORDS DATASET GENERATOR (426 Total: 147 Active, 15 Expiring, 264 Expired)
// ============================================================================

function generateInitialNocSeedData() {
  const contractorsList = [
    { code: 'GDL', name: 'GULF DUNES LANDSCAPING & AGRICULTURAL SERVICES, AN ESG COMPANY (GDL)' },
    { code: '145NCT', name: 'NETKOM COMMUNICATIONS TECHNOLOGY LLC (NCT)' },
    { code: '130AECEMS', name: 'ARABIC ENGINEER CONTROL & ELECTRO MECHANICAL SYSTEMS CO L.L.C. (AECEMS)' },
    { code: 'APEX', name: 'APEX ENGINEERING & INFRASTRUCTURE LTD.' },
    { code: 'TGC', name: 'TRANS-GULF CONTRACTING CO.' },
    { code: 'PDS', name: 'PIONEER DEMOLITION SPECIALISTS LLC' },
    { code: 'SES', name: 'SKYLINE ELECTROMECHANICAL SERVICES' },
    { code: 'MBC', name: 'METROPOLITAN BUILDERS CORP.' },
    { code: 'AJB', name: 'AL JABER BUILDING LLC' },
    { code: 'ATC', name: 'ARABTEC CONSTRUCTION' },
    { code: 'SIX', name: 'SIX CONSTRUCT' },
    { code: 'ISS', name: 'ISLAND SECURITY SERVICES' },
    { code: 'IIM', name: 'INSPIRE INTEGRATED INFRASTRUCTURE MANAGEMENT' },
    { code: 'DMTL', name: 'DELMA MARINE TRANSPORT & LOGISTICS' },
    { code: 'NMDC', name: 'NATIONAL MARINE DREDGING COMPANY (NMDC)' },
    { code: 'EUD', name: 'EMIRATES UTILITIES & DESALINATION' },
    { code: 'ETS', name: 'ETISALAT TELECOMMUNICATIONS SERVICES' },
    { code: 'ADDC', name: 'ABU DHABI DISTRIBUTION COMPANY (ADDC)' }
  ];

  const workScopes = [
    'Construction of Electrical Room for RO-01 Desalination Plant',
    'Telecom project activities, inspections, surveys, and fiber optic network installation',
    'Installation of Flow Monitoring for Wastewater Treatment Plant and Drainage Network',
    'Road cutting and pipeline excavation near North Beach access corridor',
    'Dredging and coastal rock revetment reinforcement along Eastern Jetty',
    'Installation of solar PV panels on maintenance workshop roof structure',
    'Underground high-voltage power cable laying between Substation 02 and 03',
    'Seawater intake pump replacement and marine pipeline ultrasonic inspection',
    'Landscaping irrigation network expansion and green corridor native planting',
    'Jetty pontoon structural maintenance and berthing fender replacement',
    'Marine logistics staging, mobile crane operations, and heavy equipment transit',
    'Wildlife perimeter fence rehabilitation and boundary sensor deployment',
    'Installation of SCADA telemetry sensors on potable water distribution grid',
    'Demolition of redundant concrete pump shed near South Logistics Camp',
    'Fire alarm and suppression system upgrade in Staff Village Zone 4',
    'Topographical survey and geotechnical core drilling for new marina pier',
    'Air conditioning chiller plant maintenance and ductwork modification',
    'Submarine telecom cable inspection and beach landing corridor maintenance',
    'Hazardous materials containment bund construction for fuel storage depot',
    'Helipad surface resurfacing and solar lighting beacon installation',
    'Desalination plant filter membrane refurbishment and backwash valve overhaul',
    'Installation of cathodic protection systems on steel quay sheet piles',
    'Emergency storm drainage culvert cleaning and sand sedimentation removal',
    'Fiber optic backbone route diversion and underground conduit installation'
  ];

  const nocTypes = [
    'Activity',
    'Activity NOC',
    'Berthing NOC',
    'Construction Camp Site Approval',
    'Construction Camp Size & Location Approval',
    'Construction NOC',
    'Design and Build NOC',
    'Maintenance Activity',
    'Maintenance NOC',
    'Marine Survey NOC',
    'O&M NOC',
    'Operation & Maintenance NOC',
    'Site Visit & Meeting',
    'Temporary Occupancy Certificate'
  ];

  function padSeq(n, width = 4) {
    return String(n).padStart(width, '0');
  }

  const baseCreatedTimestamp = Date.parse('2026-09-17T12:00:00.000Z');

  function createRecord(id, nocNumber, nocType, client, issuedTo, companyCode, dateOfIssuance, dateOfExpiration, description, orderIndex = 0) {
    const createdAtTime = new Date(baseCreatedTimestamp - (orderIndex * 60000)).toISOString();
    return {
      id: id,
      nocNumber: nocNumber,
      nocType: nocType || 'Activity',
      client: client || 'SBYI Operations',
      issuedTo: String(issuedTo || '').trim().toUpperCase(),
      companyCode: companyCode || '',
      dateOfIssuance: dateOfIssuance,
      dateOfExpiration: dateOfExpiration,
      description: description,
      documents: [
        {
          id: 'doc_' + id + '_01',
          name: nocNumber + '_Official_NOC.pdf',
          type: 'application/pdf',
          size: 154200,
          dataUrl: createSamplePDFDataURL(nocNumber, description),
          uploadedAt: createdAtTime,
          uploadedBy: 'System Administrator'
        }
      ],
      createdAt: createdAtTime,
      updatedAt: createdAtTime
    };
  }

  const records = [];

  // ============================================================================
  // PREVIOUS ORIGINAL NOC RECORDS (RESTORED)
  // ============================================================================
  records.push(createRecord(
    'noc_seed_001',
    'NOC-2026-0042',
    'Activity',
    'SBYI Operations',
    'GULF DUNES LANDSCAPING & AGRICULTURAL SERVICES, AN ESG COMPANY (GDL)',
    'GDL',
    '2026-01-15',
    '2026-07-15',
    'Landscaping and irrigation maintenance around Resort Villa Zone 3',
    -5
  ));

  records.push(createRecord(
    'noc_seed_002',
    'NOC-2026-0118',
    'Operation & Maintenance NOC',
    'Inspire Integrated',
    'NETKOM COMMUNICATIONS TECHNOLOGY LLC (NCT)',
    '145NCT',
    '2026-02-10',
    '2026-08-10',
    'Fiber optic backbone testing and communication mast inspection',
    -4
  ));

  records.push(createRecord(
    'noc_seed_003',
    'NOC-2025-0891',
    'Construction NOC',
    'SBYI Infrastructure Authority',
    'ARABIC ENGINEER CONTROL & ELECTRO MECHANICAL SYSTEMS CO L.L.C. (AECEMS)',
    '130AECEMS',
    '2025-10-01',
    '2026-04-01',
    'RO Desalination Plant power transformer replacement and substation cable routing',
    -3
  ));

  records.push(createRecord(
    'noc_seed_004',
    'NOC-2026-0205',
    'Marine Survey NOC',
    'SBYI Marine Operations',
    'DELMA MARINE TRANSPORT & LOGISTICS',
    'DMTL',
    '2026-03-01',
    '2026-09-01',
    'Bathymetric survey and acoustic seabed mapping around the North Jetty',
    -2
  ));

  records.push(createRecord(
    'noc_seed_005',
    'NOC-2026-0310',
    'Berthing NOC',
    'SBYI Marine Logistics',
    'NATIONAL MARINE DREDGING COMPANY (NMDC)',
    'NMDC',
    '2026-03-12',
    '2026-09-12',
    'Berthing and support barge deployment for marine rock revetment protection',
    -1
  ));

  // Top Row 1: SBYI-GDL-NOC-2024-0001 (Expired)
  records.push(createRecord(
    'noc_rec_0001',
    'SBYI-GDL-NOC-2024-0001',
    'Activity',
    'SBYI Operations',
    'GULF DUNES LANDSCAPING & AGRICULTURAL SERVICES, AN ESG COMPANY (GDL)',
    'GDL',
    '2024-06-27',
    '2025-06-26',
    'Construction of Electrical Room for RO-01 Desalination Plant',
    0
  ));

  // Top Row 2: SBYI-145NCT-NOC-2026-0001 (Expired)
  records.push(createRecord(
    'noc_rec_0002',
    'SBYI-145NCT-NOC-2026-0001',
    'Activity',
    'Telecom Operations',
    'NETKOM COMMUNICATIONS TECHNOLOGY LLC (NCT)',
    '145NCT',
    '2026-06-24',
    '2026-07-24',
    'Telecom project activities, inspections, surveys, and fiber optic network installation',
    1
  ));

  // Top Row 3: SBYI-130AECEMS-NOC-2025-0001 (Expired)
  records.push(createRecord(
    'noc_rec_0003',
    'SBYI-130AECEMS-NOC-2025-0001',
    'Activity',
    'Utilities & Water Board',
    'ARABIC ENGINEER CONTROL & ELECTRO MECHANICAL SYSTEMS CO L.L.C. (AECEMS)',
    '130AECEMS',
    '2025-11-07',
    '2026-03-21',
    'Installation of Flow Monitoring for Wastewater Treatment Plant and Drainage Network',
    2
  ));

  let currentSeq = 4;
  let orderCounter = 3;

  // 1. Generate remaining 261 Expired Records (Total Expired: 264)
  for (let i = 0; i < 261; i++) {
    const c = contractorsList[i % contractorsList.length];
    const desc = workScopes[i % workScopes.length];
    const t = nocTypes[i % nocTypes.length];
    const year = 2024 + (i % 2);
    const month = 1 + (i % 12);
    const day = 1 + (i % 28);
    const issMonthStr = String(month).padStart(2, '0');
    const issDayStr = String(day).padStart(2, '0');
    const issDate = year + '-' + issMonthStr + '-' + issDayStr;
    
    const expYear = year + 1;
    const expMonth = 1 + ((month + 4) % 12);
    const expMonthStr = String(expMonth).padStart(2, '0');
    const expDayStr = String(Math.min(day, 28)).padStart(2, '0');
    let expDate = (expYear <= 2025 ? expYear : 2026) + '-' + expMonthStr + '-' + expDayStr;
    if (expDate >= '2026-09-17') {
      expDate = '2026-08-' + expDayStr;
    }

    const seqFormatted = padSeq(currentSeq);
    records.push(createRecord(
      'noc_rec_' + seqFormatted,
      'SBYI-' + c.code + '-NOC-' + year + '-' + seqFormatted,
      t,
      'SBYI Management',
      c.name,
      c.code,
      issDate,
      expDate,
      desc,
      orderCounter
    ));
    currentSeq++;
    orderCounter++;
  }

  // 2. Generate 15 Expiring Soon Records (<30 Days, Total Expiring: 15)
  for (let i = 0; i < 15; i++) {
    const c = contractorsList[(i + 3) % contractorsList.length];
    const desc = workScopes[(i + 5) % workScopes.length];
    const t = nocTypes[i % nocTypes.length];
    const dayOffset = 1 + (i * 2);
    const expDay = 17 + (dayOffset <= 13 ? dayOffset : 0);
    const expMonth = dayOffset <= 13 ? '09' : '10';
    const finalDay = dayOffset <= 13 ? String(expDay).padStart(2, '0') : String(dayOffset - 13).padStart(2, '0');
    const expDate = '2026-' + expMonth + '-' + finalDay;
    const issDate = '2025-' + expMonth + '-' + finalDay;

    const seqFormatted = padSeq(currentSeq);
    records.push(createRecord(
      'noc_rec_' + seqFormatted,
      'SBYI-' + c.code + '-NOC-2025-' + seqFormatted,
      t,
      'SBYI Operations',
      c.name,
      c.code,
      issDate,
      expDate,
      desc,
      orderCounter
    ));
    currentSeq++;
    orderCounter++;
  }

  // 3. Generate 147 Active Permits (Total Active: 147)
  for (let i = 0; i < 147; i++) {
    const c = contractorsList[(i + 7) % contractorsList.length];
    const desc = workScopes[(i + 2) % workScopes.length];
    const t = nocTypes[i % nocTypes.length];
    const expYear = 2026 + (i % 2 === 0 ? 0 : 1);
    const expMonthNum = expYear === 2026 ? (11 + (i % 2)) : (1 + (i % 12));
    const expMonth = String(expMonthNum).padStart(2, '0');
    const expDay = String(1 + (i % 28)).padStart(2, '0');
    const expDate = expYear + '-' + expMonth + '-' + expDay;
    const issDate = (expYear - 1) + '-' + expMonth + '-' + expDay;

    const seqFormatted = padSeq(currentSeq);
    records.push(createRecord(
      'noc_rec_' + seqFormatted,
      'SBYI-' + c.code + '-NOC-2026-' + seqFormatted,
      t,
      'SBYI Infrastructure Authority',
      c.name,
      c.code,
      issDate,
      expDate,
      desc,
      orderCounter
    ));
    currentSeq++;
    orderCounter++;
  }

  return records;
}

const INITIAL_NOC_SEED_DATA = generateInitialNocSeedData();

/**
 * Creates a sample Word (.docx) file encoded as Data URL
 */
function createSampleWordDocDataURL(title, refNo) {
  const rtfContent = `{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat\\deflang1033{\\fonttbl{\\f0\\fnil\\fcharset0 Plus Jakarta Sans;}{\\f1\\fnil\\fcharset0 Arial;}}
{\\colortbl ;\\red30\\green64\\blue175;\\red5\\green150\\blue105;\\red15\\green23\\blue42;\\red100\\green116\\blue139;}
\\viewkind4\\uc1 
\\pard\\qc\\cf1\\b\\fs36 ${title.toUpperCase()}\\par
\\pard\\qc\\cf4\\fs20 Document Reference: ${refNo} | Regulatory Compliance Bureau\\par
\\par
\\pard\\cf3\\fs24\\b 1. MANDATORY SUBMISSION STANDARDS:\\b0\\fs22\\par
All contractors, developers, and project owners applying for a No Objection Certificate (NOC) must ensure full adherence to the following standards:\\par
\\par
\\cf2\\b A. Required Documentation Checklist:\\b0\\cf3\\par
  1. Completed and signed Official Application Form with authorized company stamp.\\par
  2. Valid Commercial License / Trade Registration Certificate copy.\\par
  3. Certified Engineering & Structural Design Drawings (PDF format).\\par
  4. Environmental & Occupational Safety Impact Clearance (ISO-45001 / ISO-14001).\\par
  5. Utility Grid (Water, Power, Drainage, Telecom) Integration Approvals.\\par
  6. Road Cutting / Excavation Traffic Detour Management Plan.\\par
\\par
\\cf1\\b B. Submission & Quality Standards:\\b0\\cf3\\par
  - Attachments must be high-resolution, clear, and legible in certified PDF or CAD format.\\par
  - All drawings and engineering plans must bear official consultant engineering seals.\\par
\\par
\\pard\\qc\\cf4\\fs18 *** OFFICIAL REGULATORY COMPLIANCE DOCUMENT ***\\par
}`;

  return 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,' + btoa(unescape(encodeURIComponent(rtfContent)));
}

/**
 * Default Official NOC Requirements Documents (Up to 5)
 */
const DEFAULT_NOC_REQUIREMENTS_DOCS = [
  {
    id: 'req_doc_01',
    name: 'NOC_Application_Checklist_2026.pdf',
    type: 'application/pdf',
    size: 204800,
    dataUrl: createSamplePDFDataURL('NOC Application Checklist & Requirements Guide', 'REF-REQ-2026-01'),
    uploadedAt: '2026-01-15T08:00:00.000Z',
    uploadedBy: 'System Administrator'
  },
  {
    id: 'req_doc_02',
    name: 'Official_Compliance_Guidelines.docx',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 46080,
    dataUrl: createSampleWordDocDataURL('Official Compliance Guidelines & Standards', 'DOC-REQ-2026-02'),
    uploadedAt: '2026-02-01T09:30:00.000Z',
    uploadedBy: 'System Administrator'
  },
  {
    id: 'req_doc_03',
    name: 'Engineering_Drawing_Standards.svg',
    type: 'image/svg+xml',
    size: 512000,
    dataUrl: createSampleSVGImage('Standard Engineering & Architectural Submission Specifications', 'SPEC-REQ-2026-03', '#1E40AF'),
    uploadedAt: '2026-02-10T10:30:00.000Z',
    uploadedBy: 'System Administrator'
  },
  {
    id: 'req_doc_04',
    name: 'Safety_Environmental_Guidelines.pdf',
    type: 'application/pdf',
    size: 307200,
    dataUrl: createSamplePDFDataURL('Occupational Safety & Environmental Clearance Guidelines', 'ISO-REQ-2026-04'),
    uploadedAt: '2026-03-05T14:15:00.000Z',
    uploadedBy: 'System Administrator'
  }
];

// Default SBYI COC (Code of Conduct) Documents (Max 8 PDF files)
const DEFAULT_SBYI_COC_DOCS = [
  {
    id: 'coc_doc_01',
    name: 'SBYI_COC_Marine_Operations_2026.pdf',
    type: 'application/pdf',
    size: 245760,
    dataUrl: createSamplePDFDataURL('SBYI Marine Operations & Berthing Compliance Certificate', 'COC-SBYI-2026-M01'),
    uploadedAt: '2026-02-15T09:00:00.000Z',
    uploadedBy: 'SBYI Management'
  },
  {
    id: 'coc_doc_02',
    name: 'SBYI_COC_Environmental_Safety.pdf',
    type: 'application/pdf',
    size: 312500,
    dataUrl: createSamplePDFDataURL('Sir Bani Yas Island Environmental Safety Code of Conduct', 'COC-SBYI-2026-E02'),
    uploadedAt: '2026-03-01T11:20:00.000Z',
    uploadedBy: 'SBYI Management'
  },
  {
    id: 'coc_doc_03',
    name: 'SBYI_COC_Logistics_Transport.pdf',
    type: 'application/pdf',
    size: 198656,
    dataUrl: createSamplePDFDataURL('SBYI Island Logistics & Transport Permit Conformity', 'COC-SBYI-2026-L03'),
    uploadedAt: '2026-03-10T14:30:00.000Z',
    uploadedBy: 'SBYI Management'
  }
];

// Helper to generate a multi-line formatted PDF Data URL
function generateFormattedPDFDataURL(title, lines) {
  let streamContent = 'BT\n/F1 14 Tf\n50 740 Td\n(' + title.replace(/[\(\)\\]/g, '') + ') Tj\n/F1 9 Tf\n';
  for (const line of lines) {
    const escaped = line.replace(/[\(\)\\]/g, '');
    if (line.startsWith('≡') || line.startsWith('===')) {
      streamContent += '0 -20 Td\n/F1 11 Tf\n(' + escaped + ') Tj\n/F1 9 Tf\n';
    } else if (line.trim() === '') {
      streamContent += '0 -10 Td\n() Tj\n';
    } else {
      streamContent += '0 -13 Td\n(' + escaped + ') Tj\n';
    }
  }
  streamContent += 'ET';

  const streamLen = streamContent.length;
  const obj1 = '1 0 obj\n<< /Title (' + title.replace(/[\(\)\\]/g, '') + ') /Creator (SBYIM AI Repository) >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Catalog /Pages 3 0 R >>\nendobj\n';
  const obj3 = '3 0 obj\n<< /Type /Pages /Kids [4 0 R] /Count 1 >>\nendobj\n';
  const obj4 = '4 0 obj\n<< /Type /Page /Parent 3 0 R /Resources << /Font << /F1 5 0 R >> >> /MediaBox [0 0 612 792] /Contents 6 0 R >>\nendobj\n';
  const obj5 = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
  const obj6 = '6 0 obj\n<< /Length ' + streamLen + ' >>\nstream\n' + streamContent + '\nendstream\nendobj\n';

  const header = '%PDF-1.4\n';
  const offset1 = header.length;
  const offset2 = offset1 + obj1.length;
  const offset3 = offset2 + obj2.length;
  const offset4 = offset3 + obj3.length;
  const offset5 = offset4 + obj4.length;
  const offset6 = offset5 + obj5.length;
  const xrefOffset = offset6 + obj6.length;

  const pad = (n) => String(n).padStart(10, '0');
  const xref = 'xref\n0 7\n0000000000 65535 f \n' + pad(offset1) + ' 00000 n \n' + pad(offset2) + ' 00000 n \n' + pad(offset3) + ' 00000 n \n' + pad(offset4) + ' 00000 n \n' + pad(offset5) + ' 00000 n \n' + pad(offset6) + ' 00000 n \n';
  const trailer = 'trailer\n<< /Size 7 /Root 2 0 R /Info 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';

  const fullPdf = header + obj1 + obj2 + obj3 + obj4 + obj5 + obj6 + xref + trailer;
  return 'data:application/pdf;base64,' + btoa(unescape(encodeURIComponent(fullPdf)));
}

// Generator for RORO and Water Taxi Schedule PDF Data URL
function createRoroSchedulePDFDataURL() {
  return generateFormattedPDFDataURL('SIR BANI YAS ISLAND (SBYI) - RORO & WATER TAXI TIMETABLE', [
    '≡ Official Marine Logistics Timetable - SBYIM Operations',
    'Document Reference: SBYI-MAR-SCHED-2026 | Validity: Full Year 2026',
    '',
    '≡ RORO (Roll-On / Roll-Off) Cargo & Vehicle Ferry Schedule',
    'Route: Jebel Dhanna Port (Mainland) <-> Sir Bani Yas Island (SBYI Ro-Ro Berth)',
    'Daily Scheduled Sailings (Monday to Sunday):',
    '- Trip 1 (Morning): Jebel Dhanna Dep: 06:30 AM | SBYI Arr: 07:45 AM | Return Dep: 09:00 AM | Mainland Arr: 10:15 AM',
    '- Trip 2 (Mid-Day): Jebel Dhanna Dep: 13:00 PM | SBYI Arr: 14:15 PM | Return Dep: 15:00 PM | Mainland Arr: 16:15 PM',
    '- Trip 3 (Evening): Jebel Dhanna Dep: 17:30 PM | SBYI Arr: 18:45 PM | Return Dep: 19:30 PM | Mainland Arr: 20:45 PM',
    'Vehicle Check-In Cutoff: 45 minutes prior to scheduled departure time.',
    'Regulations: Heavy plant machinery, dump trucks, and flatbeds must have approved NOC permit & Port Security clearance.',
    '',
    '≡ Fast Water Taxi & Passenger Ferry Schedule',
    'Operating Hours: 06:00 AM to 20:00 PM Daily',
    'Departures every 60 minutes from Jebel Dhanna Jetty to SBYI Marina Jetty:',
    '- Morning Express Runs: 06:00 AM, 07:00 AM, 08:00 AM, 09:00 AM',
    '- Mid-Day Runs: 10:30 AM, 12:00 PM, 13:30 PM, 15:00 PM',
    '- Evening Runs: 16:30 PM, 17:30 PM, 18:30 PM, 19:30 PM, 20:00 PM',
    'Safety: Mandatory life jacket donning. Maximum capacity 24 passengers per boat.',
    'Contact: SBYI Marine Dispatch & Logistics Office (VHF Channel 16 / 72)'
  ]);
}

// Generator for SBYI 2026 RO RO Off Days PDF Data URL
function createRoroOffDaysPDFDataURL() {
  return generateFormattedPDFDataURL('SBYI 2026 RO RO OFF DAYS & SCHEDULED MAINTENANCE CALENDAR', [
    '≡ SBYIM Marine Operations Directorate - Operational Calendar 2026',
    'Notice: The RO-RO vehicle ferry will NOT operate on designated Off Days for statutory maintenance & drydock.',
    '',
    '≡ 2026 Scheduled Non-Operational & Maintenance Off Days:',
    '- January 2026: 01 Jan (New Year), 14 Jan (Bi-Weekly Engine Maintenance), 28 Jan (Underwater Hull Inspection)',
    '- February 2026: 11 Feb (Marine Systems Audit), 25 Feb (Ramp & Hydraulic Service)',
    '- March 2026: 11 Mar (Quarterly Safety Overhaul), 25 Mar (Propulsion Check), 30-31 Mar (Eid Al Fitr Break)',
    '- April 2026: 01 Apr (Eid Al Fitr), 15 Apr (Routine Service), 29 Apr (Safety Recertification)',
    '- May 2026: 13 May (Bi-Weekly Service), 27 May (Engine Overhaul)',
    '- June 2026: 05-08 Jun (Arafat Day & Eid Al Adha), 17 Jun (Mid-Year Drydock), 26 Jun (Islamic New Year)',
    '- July 2026: 08 Jul (Routine Maintenance), 22 Jul (Hydraulic Inspection)',
    '- August 2026: 12 Aug (Engine Servicing), 26 Aug (Electrical & Navigation System Test)',
    '- September 2026: 04 Sep (Prophets Birthday), 16 Sep (Bi-Weekly Maintenance), 30 Sep (Quarterly Overhaul)',
    '- October 2026: 14 Oct (Deck & Winch Maintenance), 28 Oct (Hull Clean)',
    '- November 2026: 11 Nov (Safety Inspection), 25 Nov (Annual Pre-Winter Recertification)',
    '- December 2026: 01-03 Dec (UAE National Day Holidays), 16 Dec (End of Year Service), 30 Dec (Comprehensive Audit)',
    '',
    '≡ Emergency Cargo Protocols:',
    '- Emergency medical supplies, critical food, and fuel require prior written approval from SBYI Operations Duty Manager.',
    '- Weather Contingency: Ro-Ro sailings suspended if wind speed exceeds 25 knots or wave height exceeds 2.0 meters.'
  ]);
}

// Generator for NOC Request Letter Template Word Docx Data URL
function createNocRequestLetterDocxDataURL() {
  const rtfContent = `{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat\\deflang1033{\\fonttbl{\\f0\\fnil\\fcharset0 Plus Jakarta Sans;}{\\f1\\fnil\\fcharset0 Arial;}}
{\\colortbl ;\\red30\\green64\\blue175;\\red5\\green150\\blue105;\\red15\\green23\\blue42;\\red100\\green116\\blue139;}
\\viewkind4\\uc1 
\\pard\\qc\\cf1\\b\\fs36 NOC REQUEST LETTER TEMPLATE\\par
\\pard\\qc\\cf4\\fs20 Document Reference: SBYIM-NOC-REQ-2026-TMPL | SBYI Management Directorate\\par
\\par
\\pard\\cf3\\fs24\\b TO: SIR BANI YAS ISLAND (SBYI) MANAGEMENT & SECURITY DIRECTORATE\\par
\\b0\\fs22 DATE: [Insert Date: DD/MM/YYYY]\\par
SUBJECT: Formal Application for No Objection Certificate (NOC) for Project Execution\\par
\\par
\\cf1\\b 1. APPLICANT & CONTRACTOR DETAILS:\\b0\\cf3\\par
- Contractor / Company Name: [Enter Full Legal Registered Name]\\par
- Trade License Number & Authority: [Enter License Number, e.g. CN-XXXXXXX]\\par
- Authorized Representative: [Enter Name & Designation]\\par
- Contact Number & Email: [Enter Phone Number] | [Enter Official Email]\\par
\\par
\\cf1\\b 2. PROJECT & SCOPE OF WORK SUMMARY:\\b0\\cf3\\par
- Project / Activity Title: [Enter Scope Title]\\par
- Location / Plot / Marine Zone: [Enter Exact Site Location on Sir Bani Yas Island]\\par
- Description of Work: [Provide comprehensive summary of activities, equipment, and methods]\\par
- Machinery & Heavy Vehicles Deployed: [List all vehicles, excavators, cranes, trucks]\\par
\\par
\\cf1\\b 3. PERIOD OF VALIDITY & SCHEDULE:\\b0\\cf3\\par
- Proposed Start Date: [DD/MM/YYYY]\\par
- Proposed Completion Date: [DD/MM/YYYY]\\par
- Daily Working Hours: [e.g., 07:00 AM to 18:00 PM]\\par
\\par
\\cf2\\b 4. MANDATORY ATTACHMENTS CHECKLIST:\\b0\\cf3\\par
[X] Valid Commercial Trade License Copy\\par
[X] Signed SBYI Code of Conduct (COC) Compliance Undertaking\\par
[X] Risk Assessment & Method Statement (RAMS)\\par
[X] Environmental Impact & Marine Protection Plan\\par
[X] Vehicle & Personnel Access Manifest (Vessel / RORO Passes)\\par
\\par
\\cf1\\b 5. APPLICANT DECLARATION & AUTHORIZED SIGNATURE:\\b0\\cf3\\par
We hereby confirm that all activities will be executed in full compliance with SBYI regulations, municipal safety protocols, and environmental standards.\\par
\\par
Authorized Signatory: _________________________    Company Stamp: [STAMP HERE]\\par
Name & Designation: [Name, Title]\\par
}`;
  return 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,' + btoa(unescape(encodeURIComponent(rtfContent)));
}

// Default AI Knowledge Base Documents (DOC, DOCX, or PDF Files)
const DEFAULT_AI_DOCS = [
  {
    id: 'ai_doc_01',
    name: 'NOC Request Letter Template.docx',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 22630,
    dataUrl: createNocRequestLetterDocxDataURL(),
    uploadedAt: '2026-09-01T08:00:00.000Z',
    uploadedBy: 'System Administrator'
  },
  {
    id: 'ai_doc_02',
    name: 'RORO and Water Taxi Schedule.pdf',
    type: 'application/pdf',
    size: 53555,
    dataUrl: createRoroSchedulePDFDataURL(),
    uploadedAt: '2026-09-01T08:00:00.000Z',
    uploadedBy: 'System Administrator'
  },
  {
    id: 'ai_doc_03',
    name: 'SBYI 2026 RO RO Off Days.pdf',
    type: 'application/pdf',
    size: 324505,
    dataUrl: createRoroOffDaysPDFDataURL(),
    uploadedAt: '2026-09-01T08:00:00.000Z',
    uploadedBy: 'System Administrator'
  }
];

// Default Custom Contractors & Companies
const DEFAULT_CUSTOM_CONTRACTORS = [
  'GULF DUNES LANDSCAPING & AGRICULTURAL SERVICES, AN ESG COMPANY (GDL)',
  'NETKOM COMMUNICATIONS TECHNOLOGY LLC (NCT)',
  'ARABIC ENGINEER CONTROL & ELECTRO MECHANICAL SYSTEMS CO L.L.C. (AECEMS)',
  'APEX ENGINEERING & INFRASTRUCTURE LTD.',
  'TRANS-GULF CONTRACTING CO.',
  'PIONEER DEMOLITION SPECIALISTS LLC',
  'SKYLINE ELECTROMECHANICAL SERVICES',
  'METROPOLITAN BUILDERS CORP.',
  'AL JABER BUILDING LLC',
  'ARABTEC CONSTRUCTION',
  'SIX CONSTRUCT',
  'ISLAND SECURITY SERVICES',
  'INSPIRE INTEGRATED INFRASTRUCTURE MANAGEMENT',
  'DELMA MARINE TRANSPORT & LOGISTICS',
  'NATIONAL MARINE DREDGING COMPANY (NMDC)',
  'EMIRATES UTILITIES & DESALINATION',
  'ETISALAT TELECOMMUNICATIONS SERVICES',
  'ABU DHABI DISTRIBUTION COMPANY (ADDC)'
];

// Default Custom NOC Types
const DEFAULT_CUSTOM_TYPES = [
  'Activity',
  'Activity NOC',
  'Berthing NOC',
  'Construction Camp Site Approval',
  'Construction Camp Size & Location Approval',
  'Construction NOC',
  'Design and Build NOC',
  'Maintenance Activity',
  'Maintenance NOC',
  'Marine Survey NOC',
  'O&M NOC',
  'Operation & Maintenance NOC',
  'Site Visit & Meeting',
  'Temporary Occupancy Certificate'
];

/**
 * Restores all system dataset stores (NOC Records, Requirements Docs, COC Docs, AI Documents, Custom Types, Contractors, Users)
 * and synchronizes them directly with Supabase if active.
 */
async function restoreAllData(forceRestore = false) {
  console.log('Restoring all system datasets...');
  const stats = {
    records: 0,
    reqDocs: 0,
    cocDocs: 0,
    aiDocs: 0,
    types: 0,
    contractors: 0,
    users: 0,
    supabaseSynced: false
  };

  try {
    // 1. Purge legacy demo records and ensure 426 default NOC records are loaded if empty or forceRestore
    if (window.nocDB && window.nocDB.purgeLegacyDemoData) {
      await window.nocDB.purgeLegacyDemoData();
    }
    let localRecords = await window.nocDB._localGetAll();
    if (forceRestore || !localRecords || localRecords.length === 0) {
      console.log('Seeding 426 official default NOC records into local database...');
      await window.nocDB.bulkInsert(INITIAL_NOC_SEED_DATA);
      localRecords = await window.nocDB._localGetAll();
    }
    stats.records = localRecords ? localRecords.length : 0;

    // 2. Restore Requirements Documents
    const reqDocs = await window.nocDB.getRequirementsDocs();
    if (forceRestore || !reqDocs || reqDocs.length === 0) {
      await window.nocDB.saveRequirementsDocs(DEFAULT_NOC_REQUIREMENTS_DOCS);
      stats.reqDocs = DEFAULT_NOC_REQUIREMENTS_DOCS.length;
    } else {
      stats.reqDocs = reqDocs.length;
    }

    // 3. Restore SBYI COC Documents
    const cocDocs = await window.nocDB.getCocDocs();
    if (forceRestore || !cocDocs || cocDocs.length === 0) {
      await window.nocDB.saveCocDocs(DEFAULT_SBYI_COC_DOCS);
      stats.cocDocs = DEFAULT_SBYI_COC_DOCS.length;
    } else {
      stats.cocDocs = cocDocs.length;
    }

    // 4. Restore AI Documents (DOC, DOCX, PDF)
    const aiDocs = await window.nocDB.getAiDocs();
    if (forceRestore || !aiDocs || aiDocs.length === 0) {
      await window.nocDB.saveAiDocs(DEFAULT_AI_DOCS);
      stats.aiDocs = DEFAULT_AI_DOCS.length;
    } else {
      stats.aiDocs = aiDocs.length;
    }

    // 5. Restore Custom Types
    const customTypes = await window.nocDB.getCustomTypes();
    if (forceRestore || !customTypes || customTypes.length === 0) {
      for (const t of DEFAULT_CUSTOM_TYPES) {
        await window.nocDB.saveCustomType(t);
      }
      stats.types = DEFAULT_CUSTOM_TYPES.length;
    } else {
      stats.types = customTypes.length;
    }

    // 6. Restore Custom Contractors
    const customContractors = await window.nocDB.getCustomContractors();
    if (forceRestore || !customContractors || customContractors.length === 0) {
      for (const c of DEFAULT_CUSTOM_CONTRACTORS) {
        await window.nocDB.saveCustomContractor(c);
      }
      stats.contractors = DEFAULT_CUSTOM_CONTRACTORS.length;
    } else {
      stats.contractors = customContractors.length;
    }

    // 7. Restore Users
    const users = await window.nocDB.getUsers();
    if (forceRestore || !users || users.length === 0) {
      const defaultUsers = window.nocDB.getDefaultUsers();
      for (const u of defaultUsers) {
        await window.nocDB.saveUser(u);
      }
      stats.users = defaultUsers.length;
    } else {
      stats.users = users.length;
    }

    // 8. If Supabase is active, push and synchronize all collections immediately
    if (window.nocDB && window.nocDB.isSupabaseActive()) {
      try {
        const syncStats = await window.nocDB.syncLocalToSupabase();
        stats.supabaseSynced = true;
        stats.syncStats = syncStats;
        console.log('Restoration pushed directly to Supabase cloud PostgreSQL:', syncStats);
      } catch (err) {
        console.warn('Supabase cloud push during restore failed:', err.message);
      }
    }

    // 9. Re-sync AI knowledge base
    if (window.sbyimKnowledgeBase) {
      window.sbyimKnowledgeBase.syncKnowledgeBase().then(() => {
        if (window.sbyimAIUI) window.sbyimAIUI.updateKnowledgeStatusBadge();
      }).catch(() => {});
    }

    return stats;
  } catch (err) {
    console.error('Error during full data restoration:', err);
    throw err;
  }
}

/**
 * Seeds the database if empty on startup and connects/syncs with Supabase.
 */
async function seedInitialDatabaseIfEmpty() {
  try {
    const isSupabase = window.nocDB && window.nocDB.isSupabaseActive();
    
    // Purge any legacy demo records
    if (window.nocDB && window.nocDB.purgeLegacyDemoData) {
      await window.nocDB.purgeLegacyDemoData();
    }
    
    // Ensure all core collections (requirements, COC docs, AI docs, contractors, types, users) are populated
    await restoreAllData(false);

    // If Supabase is active, ensure cloud database is synced
    if (isSupabase) {
      try {
        const client = window.nocDB.getSupabaseClient();
        const { data, error } = await client.from('noc_records').select('id').limit(1);
        if (!error && (!data || data.length === 0)) {
          console.log('Supabase database table checked. Syncing local dataset to Supabase...');
          await window.nocDB.syncLocalToSupabase();
        }
      } catch (err) {
        console.warn('Supabase auto-sync check note:', err);
      }
    }
  } catch (err) {
    console.error('Seed data initialization error:', err);
  }
  return false;
}

const globalScope = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);

globalScope.DEFAULT_NOC_REQUIREMENTS_DOCS = DEFAULT_NOC_REQUIREMENTS_DOCS;
globalScope.DEFAULT_SBYI_COC_DOCS = DEFAULT_SBYI_COC_DOCS;
globalScope.DEFAULT_AI_DOCS = DEFAULT_AI_DOCS;
globalScope.DEFAULT_CUSTOM_CONTRACTORS = DEFAULT_CUSTOM_CONTRACTORS;
globalScope.DEFAULT_CUSTOM_TYPES = DEFAULT_CUSTOM_TYPES;
globalScope.restoreAllData = restoreAllData;
globalScope.seedInitialDatabaseIfEmpty = seedInitialDatabaseIfEmpty;
globalScope.INITIAL_NOC_SEED_DATA = INITIAL_NOC_SEED_DATA;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_NOC_REQUIREMENTS_DOCS,
    DEFAULT_SBYI_COC_DOCS,
    DEFAULT_AI_DOCS,
    DEFAULT_CUSTOM_CONTRACTORS,
    DEFAULT_CUSTOM_TYPES,
    restoreAllData,
    seedInitialDatabaseIfEmpty,
    INITIAL_NOC_SEED_DATA,
    generateInitialNocSeedData
  };
}
