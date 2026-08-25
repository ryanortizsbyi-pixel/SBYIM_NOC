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
  // A clean standard PDF format encoded in base64
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Title (${nocNumber} - ${title})
   /Creator (NOC Portal Official System) >>
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
<< /Length 260 >>
stream
BT
/F1 20 Tf
50 720 Td
(NO OBJECTION CERTIFICATE - OFFICIAL RECORD) Tj
0 -30 Td
/F1 14 Tf
(NOC Number: ${nocNumber}) Tj
0 -25 Td
(Subject: ${title}) Tj
0 -25 Td
(Status: Verified and Issued under Regulatory Guidelines) Tj
0 -40 Td
/F1 11 Tf
(This PDF certificate serves as official authorization for the designated scope of work.) Tj
0 -20 Td
(Valid for the designated contractor and specified period of validity.) Tj
ET
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000090 00000 n 
0000000143 00000 n 
0000000206 00000 n 
0000000318 00000 n 
0000000392 00000 n 
trailer
<< /Size 7
   /Root 2 0 R
   /Info 1 0 R >>
startxref
704
%%EOF`;

  return 'data:application/pdf;base64,' + btoa(pdfContent);
}

const INITIAL_NOC_SEED_DATA = [
  {
    id: 'noc_seed_001',
    nocNumber: 'NOC-2026-0042',
    nocType: 'Activity NOC',
    dateOfIssuance: '2026-01-15',
    dateOfExpiration: '2026-12-31',
    issuedTo: 'Apex Engineering & Infrastructure Ltd.',
    client: 'Municipal Urban Development Authority',
    description: 'Construction authorization for multi-story commercial tower including structural foundation, deep basement excavation, and fire life safety system installation.',
    documents: [
      {
        id: 'doc_101',
        name: 'Approved_Structural_Plan.pdf',
        type: 'application/pdf',
        size: 1048576, // 1MB
        dataUrl: createSamplePDFDataURL('NOC-2026-0042', 'Approved Structural Plan'),
        uploadedAt: '2026-01-15T08:30:00.000Z'
      },
      {
        id: 'doc_102',
        name: 'Site_Inspection_Clearance.svg',
        type: 'image/svg+xml',
        size: 524288,
        dataUrl: createSampleSVGImage('Site Inspection Clearance', 'NOC-2026-0042-SITE', '#1E40AF'),
        uploadedAt: '2026-01-15T08:32:00.000Z'
      },
      {
        id: 'doc_103',
        name: 'Environmental_Impact_Assurance.pdf',
        type: 'application/pdf',
        size: 786432,
        dataUrl: createSamplePDFDataURL('NOC-2026-0042', 'Environmental Impact Assurance'),
        uploadedAt: '2026-01-15T08:35:00.000Z'
      }
    ],
    createdAt: '2026-01-15T08:30:00.000Z',
    updatedAt: '2026-01-15T08:35:00.000Z'
  },
  {
    id: 'noc_seed_002',
    nocNumber: 'NOC-2026-0118',
    nocType: 'Activity',
    dateOfIssuance: '2026-07-01',
    dateOfExpiration: '2026-09-10', // Expiring Soon (< 30 days from Aug 24, 2026)
    issuedTo: 'Trans-Gulf Contracting Co.',
    client: 'National Highway Authority',
    description: 'Temporary road cutting permit for underground high-voltage 33kV cable laying across Sector 4B boulevard with complete traffic detour management.',
    documents: [
      {
        id: 'doc_201',
        name: 'Traffic_Detour_Plan.svg',
        type: 'image/svg+xml',
        size: 612000,
        dataUrl: createSampleSVGImage('Traffic Detour Plan & Safety Routing', 'NOC-2026-0118-TRAFFIC', '#D97706'),
        uploadedAt: '2026-07-01T10:15:00.000Z'
      },
      {
        id: 'doc_202',
        name: 'Road_Restoration_Guarantee.pdf',
        type: 'application/pdf',
        size: 890000,
        dataUrl: createSamplePDFDataURL('NOC-2026-0118', 'Road Restoration Bond'),
        uploadedAt: '2026-07-01T10:20:00.000Z'
      }
    ],
    createdAt: '2026-07-01T10:15:00.000Z',
    updatedAt: '2026-07-01T10:20:00.000Z'
  },
  {
    id: 'noc_seed_003',
    nocNumber: 'NOC-2025-0891',
    nocType: 'Activity NOC',
    dateOfIssuance: '2025-05-10',
    dateOfExpiration: '2026-05-10', // Expired
    issuedTo: 'Pioneer Demolition Specialists LLC',
    client: 'Vertex Commercial Properties',
    description: 'Controlled mechanical demolition of obsolete two-story industrial warehouse structure, hazardous asbestos abatement, and site debris removal.',
    documents: [
      {
        id: 'doc_301',
        name: 'Demolition_Safety_Plan.pdf',
        type: 'application/pdf',
        size: 1200000,
        dataUrl: createSamplePDFDataURL('NOC-2025-0891', 'Demolition Safety & Waste Management'),
        uploadedAt: '2025-05-10T14:00:00.000Z'
      },
      {
        id: 'doc_302',
        name: 'Asbestos_Clearance_Certificate.svg',
        type: 'image/svg+xml',
        size: 450000,
        dataUrl: createSampleSVGImage('Hazardous Material Remediation Clearance', 'NOC-2025-0891-HAZ', '#BE123C'),
        uploadedAt: '2025-05-10T14:05:00.000Z'
      }
    ],
    createdAt: '2025-05-10T14:00:00.000Z',
    updatedAt: '2025-05-10T14:05:00.000Z'
  },
  {
    id: 'noc_seed_004',
    nocNumber: 'NOC-2026-0205',
    nocType: 'Activity',
    dateOfIssuance: '2026-03-20',
    dateOfExpiration: '2027-03-20',
    issuedTo: 'Skyline Electromechanical Services',
    client: 'State Water & Power Dept.',
    description: 'Installation and commissioning of 1500kVA step-down compact substation transformer unit and feeder panel routing for residential district.',
    documents: [
      {
        id: 'doc_401',
        name: 'Substation_Schematic_Diagram.svg',
        type: 'image/svg+xml',
        size: 680000,
        dataUrl: createSampleSVGImage('1500kVA Substation Schematic Diagram', 'NOC-2026-0205-ELEC', '#059669'),
        uploadedAt: '2026-03-20T11:45:00.000Z'
      },
      {
        id: 'doc_402',
        name: 'Utility_Grid_Integration_Approval.pdf',
        type: 'application/pdf',
        size: 940000,
        dataUrl: createSamplePDFDataURL('NOC-2026-0205', 'Utility Grid Integration Approval'),
        uploadedAt: '2026-03-20T11:50:00.000Z'
      }
    ],
    createdAt: '2026-03-20T11:45:00.000Z',
    updatedAt: '2026-03-20T11:50:00.000Z'
  },
  {
    id: 'noc_seed_005',
    nocNumber: 'NOC-2026-0310',
    nocType: 'Activity NOC',
    dateOfIssuance: '2026-06-01',
    dateOfExpiration: '2026-11-30',
    issuedTo: 'Metropolitan Builders Corp.',
    client: 'Grand Plaza Shopping Mall',
    description: 'Internal architectural fit-out, HVAC duct installation, fire suppression sprinkler routing, and ceiling framing for retail store Units 104-106.',
    documents: [
      {
        id: 'doc_501',
        name: 'Fitout_Architectural_Layout.svg',
        type: 'image/svg+xml',
        size: 512000,
        dataUrl: createSampleSVGImage('Retail Interior Fit-out Architectural Layout', 'NOC-2026-0310-FIT', '#0284C7'),
        uploadedAt: '2026-06-01T09:00:00.000Z'
      }
    ],
    createdAt: '2026-06-01T09:00:00.000Z',
    updatedAt: '2026-06-01T09:00:00.000Z'
  }
];

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
\\cf1\\b B. Digital Document Guidelines:\\b0\\cf3\\par
  - Attachments must be clear and legible in PDF, Word (DOC/DOCX), or high-resolution Image format.\\par
  - Maximum limit of 5 supporting documents per NOC record in the portal.\\par
  - File sizes must not exceed 25MB per document.\\par
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

/**
 * Seeds the database if empty on startup.
 */
async function seedInitialDatabaseIfEmpty() {
  try {
    const existing = await window.nocDB.getAll();
    if (!existing || existing.length === 0) {
      console.log('Seeding initial NOC records...');
      await window.nocDB.bulkInsert(INITIAL_NOC_SEED_DATA);
      return true;
    }
  } catch (err) {
    console.error('Seed data initialization error:', err);
  }
  return false;
}

window.DEFAULT_NOC_REQUIREMENTS_DOCS = DEFAULT_NOC_REQUIREMENTS_DOCS;
window.DEFAULT_SBYI_COC_DOCS = DEFAULT_SBYI_COC_DOCS;
window.seedInitialDatabaseIfEmpty = seedInitialDatabaseIfEmpty;
window.INITIAL_NOC_SEED_DATA = INITIAL_NOC_SEED_DATA;
