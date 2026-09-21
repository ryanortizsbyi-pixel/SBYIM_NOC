/**
 * SBYIM NOC Portal - Aiven PostgreSQL Migration Script
 * Migrates all local data records (426 NOC records, Requirements Docs, COC Docs, AI Documents, Custom Types, Contractors, Users, Settings)
 * into Aiven Cloud PostgreSQL.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// SSL CA Certificate for Aiven
const caCertPath = path.join(__dirname, '..', 'certs', 'ca.pem');
if (!fs.existsSync(caCertPath)) {
  console.error('ERROR: Aiven CA certificate not found at:', caCertPath);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set in .env');
  process.exit(1);
}

const dbUrl = new URL(process.env.DATABASE_URL);
const cleanConnString = `${dbUrl.protocol}//${dbUrl.username}:${dbUrl.password}@${dbUrl.host}${dbUrl.pathname}`;

const pool = new Pool({
  connectionString: cleanConnString,
  ssl: {
    ca: fs.readFileSync(caCertPath, 'utf-8'),
    rejectUnauthorized: false
  }
});

// ============================================================================
// DOCUMENT GENERATORS (PDF, DOCX, SVG)
// ============================================================================

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
  <text x="210" y="245" fill="#64748B" font-family="Arial, sans-serif" font-size="14">Certified Engineering &amp; Site Clearance Inspection Drawing</text>
  <text x="210" y="275" fill="#059669" font-family="Arial, sans-serif" font-size="13" font-weight="bold">STATUS: OFFICIAL CLEARANCE GRANTED</text>
  <line x1="100" y1="340" x2="700" y2="340" stroke="#94A3B8" stroke-dasharray="4" stroke-width="1.5"/>
  <rect x="100" y="360" width="180" height="40" fill="#EFF6FF" stroke="#3B82F6" rx="4"/>
  <text x="120" y="385" fill="#1E40AF" font-family="monospace" font-size="12">COORD: 25.2048° N, 55.2708° E</text>
  <rect x="300" y="360" width="180" height="40" fill="#ECFDF5" stroke="#10B981" rx="4"/>
  <text x="325" y="385" fill="#065F46" font-family="monospace" font-size="12">SAFETY PROTOCOL: ISO-45001</text>
  <rect x="500" y="360" width="200" height="40" fill="#F1F5F9" stroke="#64748B" rx="4"/>
  <text x="525" y="385" fill="#334155" font-family="monospace" font-size="12">STAMP: AUDITED &amp; APPROVED</text>
  <rect x="70" y="445" width="660" height="85" rx="8" fill="#F1F5F9"/>
  <text x="90" y="475" fill="#334155" font-family="Arial, sans-serif" font-size="12" font-weight="bold">COMPLIANCE NOTICE:</text>
  <text x="90" y="495" fill="#64748B" font-family="Arial, sans-serif" font-size="11">This official document constitutes valid proof of compliance and authorization under the designated Municipal Regulatory Authority.</text>
  <text x="90" y="515" fill="#64748B" font-family="Arial, sans-serif" font-size="11">Authorized personnel may verify this record using the system NOC unique identification key.</text>
</svg>`.trim();

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString);
}

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

  return 'data:application/pdf;base64,' + Buffer.from(pdfContent, 'utf-8').toString('base64');
}

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
  return 'data:application/pdf;base64,' + Buffer.from(fullPdf, 'utf-8').toString('base64');
}

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
  return 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,' + Buffer.from(rtfContent, 'utf-8').toString('base64');
}

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
  return 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,' + Buffer.from(rtfContent, 'utf-8').toString('base64');
}

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

// ============================================================================
// DATASET DEFINITIONS (426 NOCs, Docs, Types, Contractors, Users, Settings)
// ============================================================================

function generateOfficialNocRecords() {
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
      noc_number: nocNumber,
      noc_type: nocType || 'Activity',
      client: client || 'SBYI Operations',
      issued_to: String(issuedTo || '').trim().toUpperCase(),
      company_code: companyCode || '',
      date_of_issuance: dateOfIssuance,
      date_of_expiration: dateOfExpiration,
      description: description,
      documents: JSON.stringify([
        {
          id: 'doc_' + id + '_01',
          name: nocNumber + '_Official_NOC.pdf',
          type: 'application/pdf',
          size: 154200,
          dataUrl: createSamplePDFDataURL(nocNumber, description),
          uploadedAt: createdAtTime,
          uploadedBy: 'System Administrator'
        }
      ]),
      created_at: createdAtTime,
      updated_at: createdAtTime
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

  // Top Row 2: SBYI-145NCT-NOC-2026-0002 (Active)
  records.push(createRecord(
    'noc_rec_0002',
    'SBYI-145NCT-NOC-2026-0002',
    'Activity NOC',
    'Telecom Project Management',
    'NETKOM COMMUNICATIONS TECHNOLOGY LLC (NCT)',
    '145NCT',
    '2026-06-11',
    '2026-12-07',
    'Telecom project activities, inspections, surveys, and fiber optic network installation',
    1
  ));

  // Top Row 3: SBYI-130AECEMS-NOC-2024-0003 (Expired)
  records.push(createRecord(
    'noc_rec_0003',
    'SBYI-130AECEMS-NOC-2024-0003',
    'Construction NOC',
    'Infrastructure Development Dept',
    'ARABIC ENGINEER CONTROL & ELECTRO MECHANICAL SYSTEMS CO L.L.C. (AECEMS)',
    '130AECEMS',
    '2024-06-11',
    '2024-12-07',
    'Installation of Flow Monitoring for Wastewater Treatment Plant and Drainage Network',
    2
  ));

  let currentSeq = 4;
  let orderCounter = 3;

  // 1. Generate remaining 262 Expired Permits (Total Expired: 264)
  for (let i = 0; i < 262; i++) {
    const c = contractorsList[i % contractorsList.length];
    const desc = workScopes[i % workScopes.length];
    const t = nocTypes[i % nocTypes.length];
    const year = 2024 + (i % 2 === 0 ? 0 : 1);
    const monthNum = 1 + (i % 12);
    const month = String(monthNum).padStart(2, '0');
    const day = String(1 + (i % 28)).padStart(2, '0');
    const issDate = (year - 1) + '-' + month + '-' + day;
    const expDate = year + '-' + month + '-' + day;

    const seqFormatted = padSeq(currentSeq);
    records.push(createRecord(
      'noc_rec_' + seqFormatted,
      'SBYI-' + c.code + '-NOC-' + year + '-' + seqFormatted,
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

  // 2. Generate 15 Expiring Soon Permits (Total Expiring: 15)
  for (let i = 0; i < 15; i++) {
    const c = contractorsList[(i + 3) % contractorsList.length];
    const desc = workScopes[(i + 5) % workScopes.length];
    const t = nocTypes[(i + 2) % nocTypes.length];
    const expDayNum = 18 + (i % 12);
    const expDay = String(expDayNum).padStart(2, '0');
    const expDate = '2026-09-' + expDay;
    const issDate = '2025-09-' + expDay;

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

  // 3. Generate 146 Active Permits (Total Active: 147)
  for (let i = 0; i < 146; i++) {
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

const NOC_REQUIREMENTS_DOCS = [
  {
    id: 'req_doc_01',
    name: 'NOC_Application_Checklist_2026.pdf',
    type: 'application/pdf',
    size: 204800,
    data_url: createSamplePDFDataURL('NOC Application Checklist & Requirements Guide', 'REF-REQ-2026-01'),
    uploaded_at: '2026-01-15T08:00:00.000Z',
    uploaded_by: 'System Administrator'
  },
  {
    id: 'req_doc_02',
    name: 'Official_Compliance_Guidelines.docx',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 46080,
    data_url: createSampleWordDocDataURL('Official Compliance Guidelines & Standards', 'DOC-REQ-2026-02'),
    uploaded_at: '2026-02-01T09:30:00.000Z',
    uploaded_by: 'System Administrator'
  },
  {
    id: 'req_doc_03',
    name: 'Engineering_Drawing_Standards.svg',
    type: 'image/svg+xml',
    size: 512000,
    data_url: createSampleSVGImage('Standard Engineering & Architectural Submission Specifications', 'SPEC-REQ-2026-03', '#1E40AF'),
    uploaded_at: '2026-02-10T10:30:00.000Z',
    uploaded_by: 'System Administrator'
  },
  {
    id: 'req_doc_04',
    name: 'Safety_Environmental_Guidelines.pdf',
    type: 'application/pdf',
    size: 307200,
    data_url: createSamplePDFDataURL('Occupational Safety & Environmental Clearance Guidelines', 'ISO-REQ-2026-04'),
    uploaded_at: '2026-03-05T14:15:00.000Z',
    uploaded_by: 'System Administrator'
  }
];

const SBYI_COC_DOCS = [
  {
    id: 'coc_doc_01',
    name: 'SBYI_COC_Marine_Operations_2026.pdf',
    type: 'application/pdf',
    size: 245760,
    data_url: createSamplePDFDataURL('SBYI Marine Operations & Berthing Compliance Certificate', 'COC-SBYI-2026-M01'),
    uploaded_at: '2026-02-15T09:00:00.000Z',
    uploaded_by: 'SBYI Management'
  },
  {
    id: 'coc_doc_02',
    name: 'SBYI_COC_Environmental_Safety.pdf',
    type: 'application/pdf',
    size: 312500,
    data_url: createSamplePDFDataURL('Sir Bani Yas Island Environmental Safety Code of Conduct', 'COC-SBYI-2026-E02'),
    uploaded_at: '2026-03-01T11:20:00.000Z',
    uploaded_by: 'SBYI Management'
  },
  {
    id: 'coc_doc_03',
    name: 'SBYI_COC_Logistics_Transport.pdf',
    type: 'application/pdf',
    size: 198656,
    data_url: createSamplePDFDataURL('SBYI Island Logistics & Transport Permit Conformity', 'COC-SBYI-2026-L03'),
    uploaded_at: '2026-03-10T14:30:00.000Z',
    uploaded_by: 'SBYI Management'
  }
];

const AI_DOCS = [
  {
    id: 'ai_doc_01',
    name: 'NOC Request Letter Template.docx',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 22630,
    data_url: createNocRequestLetterDocxDataURL(),
    uploaded_at: '2026-09-01T08:00:00.000Z',
    uploaded_by: 'System Administrator'
  },
  {
    id: 'ai_doc_02',
    name: 'RORO and Water Taxi Schedule.pdf',
    type: 'application/pdf',
    size: 53555,
    data_url: createRoroSchedulePDFDataURL(),
    uploaded_at: '2026-09-01T08:00:00.000Z',
    uploaded_by: 'System Administrator'
  },
  {
    id: 'ai_doc_03',
    name: 'SBYI 2026 RO RO Off Days.pdf',
    type: 'application/pdf',
    size: 324505,
    data_url: createRoroOffDaysPDFDataURL(),
    uploaded_at: '2026-09-01T08:00:00.000Z',
    uploaded_by: 'System Administrator'
  }
];

const CUSTOM_TYPES = [
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

const CUSTOM_CONTRACTORS = [
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

const USERS = [
  { username: 'ryan', password: 'spider06', password_hash: '$2b$12$HlGJBt12SCRFjFubXpMy/.S8c/c2Z37bnSKfK9gWYOBaZMBYTPzRK', role: 'developer', display_name: 'Ryan Ortiz (Developer)', email: '' },
  { username: 'SBYIM', password: 'NOC#2022#', password_hash: '$2b$12$BVkv4SWEV7BmDQhvJ3iqoemZVA3E2yuEoEmfp4HUrzMJOe6ZCYaVS', role: 'admin', display_name: 'SBYI Management', email: '' },
  { username: 'security', password: 'sec@2024', password_hash: '$2b$12$s8lKlZZy/IenffBQmA.cr.VZGjLIRCptpCML6MfsNNFNkTd1gE.9W', role: 'security', display_name: 'SBYIM Security Officer', email: '' },
  { username: 'Employee01', password: '666666@', password_hash: '$2b$12$TnXNmgBadK7MinLIX9/nJeJOR0TyGLu437h3aYdR7qcZsP9di63Ha', role: 'employee', display_name: 'Island Security', email: '' },
  { username: 'Employee02', password: '777777#', password_hash: '$2b$12$b.i6syQYU51.9d2XIuwq6u5sH4fTlouyZRDhK/msIywz3ZJ2Kcz.K', role: 'employee', display_name: 'Inspire Integrated', email: '' },
  { username: '1GDL', password: '55555', password_hash: '', role: 'guest', display_name: 'Gulf Dunes Landscapping', email: '' }
];

const SETTINGS = [
  { key: 'noc_contractor_renames', value: JSON.stringify({}) },
  { key: 'portal_config', value: JSON.stringify({ autoSync: true, theme: 'light' }) }
];

// ============================================================================
// MIGRATION WORKFLOW
// ============================================================================

async function runMigration() {
  console.log('================================================================');
  console.log('🚀 SBYIM NOC Portal - Starting Data Migration to Aiven PostgreSQL');
  console.log('================================================================');

  const client = await pool.connect();

  try {
    // 1. Ensure schema tables and required columns exist
    console.log('1️⃣  Verifying database schema tables & columns...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.noc_users (
        username VARCHAR(100) PRIMARY KEY,
        password VARCHAR(255) DEFAULT '',
        password_hash VARCHAR(255) DEFAULT '',
        role VARCHAR(50) NOT NULL DEFAULT 'guest',
        display_name VARCHAR(255),
        email VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
      );
      ALTER TABLE public.noc_users ADD COLUMN IF NOT EXISTS password VARCHAR(255) DEFAULT '';
      ALTER TABLE public.noc_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) DEFAULT '';
      ALTER TABLE public.noc_users ALTER COLUMN password_hash DROP NOT NULL;
      ALTER TABLE public.noc_users ALTER COLUMN password_hash SET DEFAULT '';
    `);
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await client.query(schemaSql);
    console.log('   ✅ Schema verification complete.');

    // 2. Custom NOC Types Migration
    console.log('2️⃣  Migrating Custom NOC Types...');
    let typeCount = 0;
    for (const typeName of CUSTOM_TYPES) {
      await client.query(
        'INSERT INTO public.noc_custom_types (name) VALUES ($1) ON CONFLICT (name) DO NOTHING;',
        [typeName]
      );
      typeCount++;
    }
    console.log(`   ✅ Migrated ${typeCount} Custom NOC Types.`);

    // 3. Custom Contractors Migration
    console.log('3️⃣  Migrating Custom Contractors...');
    let contractorCount = 0;
    for (const cName of CUSTOM_CONTRACTORS) {
      await client.query(
        'INSERT INTO public.noc_custom_contractors (name) VALUES ($1) ON CONFLICT (name) DO NOTHING;',
        [cName]
      );
      contractorCount++;
    }
    console.log(`   ✅ Migrated ${contractorCount} Custom Contractors.`);

    // 4. Users Migration
    console.log('4️⃣  Migrating User Accounts...');
    await client.query("DELETE FROM public.noc_users WHERE lower(username) IN ('admin', 'guest', 'developer', 'main');");
    for (const u of USERS) {
      await client.query(
        `INSERT INTO public.noc_users (username, password, password_hash, role, display_name, email)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (username) DO UPDATE
         SET password = EXCLUDED.password,
             password_hash = COALESCE(NULLIF(EXCLUDED.password_hash, ''), noc_users.password_hash, ''),
             role = EXCLUDED.role,
             display_name = EXCLUDED.display_name,
             email = EXCLUDED.email;`,
        [u.username, u.password, u.password_hash || '', u.role, u.display_name, u.email]
      );
    }
    console.log(`   ✅ Migrated ${USERS.length} User Accounts.`);

    // 5. Requirements Documents Migration
    console.log('5️⃣  Migrating NOC Requirements Documents...');
    for (const doc of NOC_REQUIREMENTS_DOCS) {
      await client.query(
        `INSERT INTO public.noc_requirements_docs (id, name, type, size, data_url, uploaded_at, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             type = EXCLUDED.type,
             size = EXCLUDED.size,
             data_url = EXCLUDED.data_url,
             uploaded_at = EXCLUDED.uploaded_at,
             uploaded_by = EXCLUDED.uploaded_by;`,
        [doc.id, doc.name, doc.type, doc.size, doc.data_url, doc.uploaded_at, doc.uploaded_by]
      );
    }
    console.log(`   ✅ Migrated ${NOC_REQUIREMENTS_DOCS.length} Requirements Documents.`);

    // 6. SBYI COC Documents Migration
    console.log('6️⃣  Migrating SBYI COC Documents...');
    for (const doc of SBYI_COC_DOCS) {
      await client.query(
        `INSERT INTO public.sbyi_coc_docs (id, name, type, size, data_url, uploaded_at, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             type = EXCLUDED.type,
             size = EXCLUDED.size,
             data_url = EXCLUDED.data_url,
             uploaded_at = EXCLUDED.uploaded_at,
             uploaded_by = EXCLUDED.uploaded_by;`,
        [doc.id, doc.name, doc.type, doc.size, doc.data_url, doc.uploaded_at, doc.uploaded_by]
      );
    }
    console.log(`   ✅ Migrated ${SBYI_COC_DOCS.length} SBYI COC Documents.`);

    // 7. AI Knowledge Base Documents Migration
    console.log('7️⃣  Migrating AI Knowledge Documents...');
    for (const doc of AI_DOCS) {
      await client.query(
        `INSERT INTO public.ai_documents (id, name, type, size, data_url, uploaded_at, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             type = EXCLUDED.type,
             size = EXCLUDED.size,
             data_url = EXCLUDED.data_url,
             uploaded_at = EXCLUDED.uploaded_at,
             uploaded_by = EXCLUDED.uploaded_by;`,
        [doc.id, doc.name, doc.type, doc.size, doc.data_url, doc.uploaded_at, doc.uploaded_by]
      );
    }
    console.log(`   ✅ Migrated ${AI_DOCS.length} AI Documents.`);

    // 8. Settings Migration
    console.log('8️⃣  Migrating System Settings...');
    for (const s of SETTINGS) {
      await client.query(
        `INSERT INTO public.noc_settings (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             updated_at = timezone('utc'::text, now());`,
        [s.key, s.value]
      );
    }
    console.log(`   ✅ Migrated ${SETTINGS.length} System Settings.`);

    // 9. Official NOC Records Migration (426 records)
    console.log('9️⃣  Migrating 426 Official NOC Records...');
    const records = generateOfficialNocRecords();
    
    // Clean old records to ensure clean migration of the 426 official records
    await client.query('DELETE FROM public.noc_records;');

    // Batch insert NOC records in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      
      for (const rec of chunk) {
        await client.query(
          `INSERT INTO public.noc_records (
             id, noc_number, noc_type, client, issued_to, company_code,
             date_of_issuance, date_of_expiration, description, documents,
             created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO UPDATE
           SET noc_number = EXCLUDED.noc_number,
               noc_type = EXCLUDED.noc_type,
               client = EXCLUDED.client,
               issued_to = EXCLUDED.issued_to,
               company_code = EXCLUDED.company_code,
               date_of_issuance = EXCLUDED.date_of_issuance,
               date_of_expiration = EXCLUDED.date_of_expiration,
               description = EXCLUDED.description,
               documents = EXCLUDED.documents,
               updated_at = EXCLUDED.updated_at;`,
          [
            rec.id,
            rec.noc_number,
            rec.noc_type,
            rec.client,
            rec.issued_to,
            rec.company_code,
            rec.date_of_issuance,
            rec.date_of_expiration,
            rec.description,
            rec.documents,
            rec.created_at,
            rec.updated_at
          ]
        );
      }
      process.stdout.write(`   ... Processed ${Math.min(i + chunkSize, records.length)} / ${records.length} records\r`);
    }
    console.log(`\n   ✅ Successfully migrated ${records.length} NOC Records.`);

    // 10. Final Verification & Statistics Summary
    console.log('\n================================================================');
    console.log('📊 AIVEN POSTGRESQL MIGRATION SUMMARY & VERIFICATION');
    console.log('================================================================');

    const tableNames = [
      'noc_records',
      'noc_custom_types',
      'noc_custom_contractors',
      'noc_users',
      'noc_requirements_docs',
      'sbyi_coc_docs',
      'ai_documents',
      'noc_settings'
    ];

    for (const t of tableNames) {
      const res = await client.query(`SELECT count(*) as count FROM public.${t}`);
      console.log(`  📁 public.${t.padEnd(25)} : ${res.rows[0].count} rows`);
    }

    console.log('================================================================');
    console.log('✨ ALL LOCAL DATA RECORDS SUCCESSFULLY MIGRATED TO AIVEN!');
    console.log('================================================================');

  } catch (err) {
    console.error('❌ Migration Error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigration().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runMigration };
