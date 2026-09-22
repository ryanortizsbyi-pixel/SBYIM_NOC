require('dotenv').config();

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable HTTP GZIP response compression for lightning-fast JSON delivery
app.use(compression());

// Middleware with extended payload limit for document attachments
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files (HTML, CSS, JS, Assets)
app.use(express.static(path.join(__dirname)));

// PostgreSQL Connection Pool using Aiven DATABASE_URL with CA certificate
const DEFAULT_AIVEN_URL = 'postgres://avnadmin:AVNS_53oqyZFiE6ccpAivNKu@pg2026-noc-ryansbyi-noc.f.aivencloud.com:13029/defaultdb?sslmode=require';
const rawUrl = process.env.DATABASE_URL || DEFAULT_AIVEN_URL;

let dbUrl;
try {
  dbUrl = new URL(rawUrl);
} catch (e) {
  dbUrl = new URL(DEFAULT_AIVEN_URL);
}

const dbHost = dbUrl.hostname || 'pg2026-noc-ryansbyi-noc.f.aivencloud.com';
const dbPort = parseInt(dbUrl.port, 10) || 13029;
const dbUser = decodeURIComponent(dbUrl.username || 'avnadmin');
const dbPass = decodeURIComponent(dbUrl.password || '');
const dbName = (dbUrl.pathname || '/defaultdb').replace(/^\//, '') || 'defaultdb';

console.log('Database host:', dbHost);
console.log('Database port:', dbPort);
console.log('Database name:', dbName);

// Load Aiven CA Certificate with embedded fallback for serverless hosting (Vercel)
const caCertPath = path.join(__dirname, 'certs', 'ca.pem');
const EMBEDDED_AIVEN_CA = `-----BEGIN CERTIFICATE-----
MIIERDCCAqygAwIBAgIUTzK4Z0nK/H9refLyVuiT9WMf8C8wDQYJKoZIhvcNAQEM
BQAwOjE4MDYGA1UEAwwvYTQzYmM2YWEtZjg4Mi00ZWIzLTg5MTAtOGZjNzQzODVj
MGIwIFByb2plY3QgQ0EwHhcNMjYwOTE3MDYxMTM1WhcNMzYwOTE0MDYxMTM1WjA6
MTgwNgYDVQQDDC9hNDNiYzZhYS1mODgyLTRlYjMtODkxMC04ZmM3NDM4NWMwYjAg
UHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBANKU0wF6
0Jv1f5yf0Gki17IBQPfD6/5Oxh2al1WPeXW6HgZ6eTG4dPtPamEcmUMk2y7yDNo6
MhuIILvgI/bmDE8QDOvldYILnyqQEwJPeMsIIxcyO9q6/PzXb1Ryqd4IBoNL53Ex
zr6aK0yrLPayr2wXa0ZFgKAlX9Tcs8VsFYtTamZgHurlYzIrZCQK/zr43s3F5mtw
U1XJZFYn4Nm2hwLUuV0r2atOGiY+KgCoWBmWWrfKMZspib8lq77YMawmNkN9QXLG
0Lid0Fd2BL/sHi9bg3TYNMMvbm7L72m9oc21sVSyWEnBmifwkgEwFK6A5CWrxgoh
4nsonwkJEij1Tp7Qrin2C51imvsLk0fXih3J5oId6/sGefVzgoOqW45H+H6hS/Uj
Rlz+LjR+Z8C1sVR1bv10vvgDoCz9dprz6+fguDwMIGrwrpWR1Ouc/ryrJyAuhZue
VAk8B3PV8RfHsT07i7QxGoikPTdQiDaSwgTN0SAFYPz/RwAVWsddgey7YwIDAQAB
o0IwQDAdBgNVHQ4EFgQU1tNr0sDyq/2mzth2bX/4vAN4iNYwEgYDVR0TAQH/BAgw
BgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGBABb4mbVjz92c
CziGUg9i5xlqLcESfBar0lnVKKoPu8b5iqtu5wyh+L/ssVf9FHWyUC4VTs9u4qj+
vqauRcooQuYaQukdFih1VpWknZQmOlJtt/QHw5c2e0NGP0HiICYC0URVkbya6NTe
Y3LualLFlEZcB/Jvfd9ZkIN+xMiMQEBw2qMocwU1f5pjVi4MCZCriiWcbhwnYRk7
vTiv0PYEgoKUzZZ0Gb2KCWmiSqcd+937axWkASx3Ata8xODHoDdS4CPvw0AuTao4
LQZtKnqoqC12sSGrQdozEXrSKsmU49q6oWhKXftGE3DfNtKOgWrlvYfmaRdA07W1
LsbuJdP8QQczX3UFmRGSEDabUXL3Nke/CShkbk0E2mDJplxPETK22A9O+f98fMuo
iNTN48t2PqJi1v2QpC4OYmS7KE30535+mqJZ34rd6bSV41KAYNoi/tNGL1AcOJat
5PuE01iABQNP4dRc3T1lGDfleXe/fkbDX8RqfJR/rgY0x4Z3KxoNcA==
-----END CERTIFICATE-----`;

let caCert = EMBEDDED_AIVEN_CA;
try {
  if (fs.existsSync(caCertPath)) {
    caCert = fs.readFileSync(caCertPath, 'utf-8');
  }
} catch (e) {
  caCert = EMBEDDED_AIVEN_CA;
}

const pool = new Pool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPass,
  database: dbName,
  ssl: {
    ca: caCert,
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  allowExitOnIdle: true
});

// Periodic TCP Keep-Alive query to maintain active SSL connection with Aiven Cloud
const aivenKeepAliveInterval = setInterval(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.warn('[Aiven Keep-Alive Warning]:', err.message);
  }
}, 25000);
if (aivenKeepAliveInterval.unref) aivenKeepAliveInterval.unref();

// Helper function to log database errors
function logDatabaseError(contextLabel, error) {
  console.error(`=== [Database Error: ${contextLabel}] ===`);
  if (!error) {
    console.error('Unknown or empty error object received.');
    return {};
  }
  const errorInfo = {
    message: error.message,
    code: error.code,
    name: error.name,
    detail: error.detail,
    hint: error.hint
  };
  if (error.message) console.error('  Message:', error.message);
  if (error.code) console.error('  Code:', error.code);
  return errorInfo;
}

// Event listener for pool errors
pool.on('error', (err) => {
  logDatabaseError('Idle Pool Client', err);
});

// Automatically ensure required PostgreSQL tables exist
async function initTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.noc_deleted_records (
        id TEXT PRIMARY KEY,
        noc_number VARCHAR(100) NOT NULL,
        noc_type VARCHAR(100) NOT NULL DEFAULT 'Activity',
        client VARCHAR(255) NOT NULL,
        issued_to VARCHAR(255) NOT NULL,
        company_code VARCHAR(100),
        date_of_issuance DATE,
        date_of_expiration DATE,
        description TEXT,
        documents JSONB NOT NULL DEFAULT '[]'::jsonb,
        deleted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
        deleted_by VARCHAR(255) DEFAULT 'System Administrator',
        created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
      );
      CREATE INDEX IF NOT EXISTS idx_noc_deleted_noc_number ON public.noc_deleted_records (noc_number);
      CREATE INDEX IF NOT EXISTS idx_noc_deleted_at ON public.noc_deleted_records (deleted_at DESC);
    `);
    console.log('PostgreSQL noc_deleted_records table verified/ready.');
  } catch (err) {
    console.warn('Table initialization note:', err.message);
  }
}
// ============================================================================
// IN-MEMORY CACHE & LIGHTWEIGHT RECORDS PROJECTION
// ============================================================================

let cachedLightweightRecords = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 60s background refresh TTL

async function loadLightweightRecordsFromDb() {
  const query = `
    SELECT 
      id, noc_number, noc_type, client, issued_to, company_code,
      date_of_issuance, date_of_expiration, description, created_at, updated_at,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', d->>'id',
            'name', d->>'name',
            'type', d->>'type',
            'size', d->>'size',
            'uploadedAt', d->>'uploadedAt',
            'uploadedBy', d->>'uploadedBy'
          )
        )
        FROM jsonb_array_elements(
          CASE 
            WHEN jsonb_typeof(documents::jsonb) = 'array' THEN documents::jsonb 
            ELSE '[]'::jsonb 
          END
        ) AS d
      ), '[]'::jsonb) AS documents
    FROM public.noc_records
    ORDER BY created_at DESC
    LIMIT 5000;
  `;
  try {
    const result = await pool.query(query);
    cachedLightweightRecords = result.rows.map(row => mapDbToRecord(row));
    cacheTimestamp = Date.now();
    return cachedLightweightRecords;
  } catch (err) {
    console.error('Error loading lightweight records cache from DB:', err.message);
    if (!cachedLightweightRecords) cachedLightweightRecords = [];
    return cachedLightweightRecords;
  }
}

function invalidateRecordsCache() {
  cachedLightweightRecords = null;
  cacheTimestamp = 0;
}

// Warm cache in background on server boot
initTables().then(() => {
  loadLightweightRecordsFromDb().catch(() => {});
});

// ============================================================================
// DATA MAPPERS (PostgreSQL snake_case <-> Frontend camelCase)
// ============================================================================

function mapDbToRecord(row) {
  if (!row) return null;
  let docs = [];
  if (Array.isArray(row.documents)) {
    docs = row.documents;
  } else if (typeof row.documents === 'string') {
    try {
      docs = JSON.parse(row.documents || '[]');
    } catch (e) {
      docs = [];
    }
  } else if (typeof row.documents === 'object' && row.documents !== null) {
    docs = Array.isArray(row.documents) ? row.documents : [row.documents];
  }

  return {
    id: String(row.id),
    nocNumber: row.noc_number,
    nocType: row.noc_type || 'Activity',
    client: row.client || '',
    issuedTo: (row.issued_to || '').trim().toUpperCase(),
    companyCode: row.company_code || '',
    dateOfIssuance: row.date_of_issuance ? (typeof row.date_of_issuance === 'object' ? row.date_of_issuance.toISOString().split('T')[0] : String(row.date_of_issuance)) : '',
    dateOfExpiration: row.date_of_expiration ? (typeof row.date_of_expiration === 'object' ? row.date_of_expiration.toISOString().split('T')[0] : String(row.date_of_expiration)) : '',
    description: row.description || '',
    documents: docs,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

function mapRecordToDb(rec) {
  if (!rec) return null;
  let docs = [];
  if (Array.isArray(rec.documents)) {
    docs = rec.documents;
  } else if (typeof rec.documents === 'string') {
    try {
      docs = JSON.parse(rec.documents);
      if (!Array.isArray(docs)) docs = [docs];
    } catch (e) {
      docs = [];
    }
  } else if (rec.documents && typeof rec.documents === 'object') {
    docs = [rec.documents];
  }

  const rawIssuance = rec.dateOfIssuance || rec.date_of_issuance;
  const rawExpiration = rec.dateOfExpiration || rec.date_of_expiration;

  return {
    id: rec.id || 'noc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    noc_number: (rec.nocNumber || rec.noc_number || '').trim(),
    noc_type: rec.nocType || rec.noc_type || 'Activity',
    client: (rec.client || '').trim(),
    issued_to: (rec.issuedTo || rec.issued_to || '').trim().toUpperCase(),
    company_code: (rec.companyCode || rec.company_code || '').trim(),
    date_of_issuance: (rawIssuance && String(rawIssuance).trim() !== '') ? String(rawIssuance).trim() : null,
    date_of_expiration: (rawExpiration && String(rawExpiration).trim() !== '') ? String(rawExpiration).trim() : null,
    description: rec.description || '',
    documents: JSON.stringify(docs),
    created_at: rec.createdAt || rec.created_at || new Date().toISOString(),
    updated_at: rec.updatedAt || rec.updated_at || new Date().toISOString()
  };
}

// ============================================================================
// REST API ENDPOINTS
// ============================================================================

// 0. Super-fast microsecond Health Ping Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    success: true,
    connected: true,
    host: dbHost,
    port: dbPort,
    database: dbName,
    ssl: true,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/ping', (req, res) => {
  res.send('pong');
});

// 1. Health check and connection status
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT version();');
    res.status(200).json({
      success: true,
      message: 'Aiven database connected successfully',
      host: dbHost,
      port: dbPort,
      database: dbName,
      ssl: true,
      version: result.rows[0].version
    });
  } catch (error) {
    const errorDetails = logDatabaseError('/api/db-test Endpoint', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect to database',
      details: errorDetails
    });
  }
});

// 2. Database Stats Endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const tables = [
      'noc_records',
      'noc_custom_types',
      'noc_custom_contractors',
      'noc_users',
      'noc_requirements_docs',
      'sbyi_coc_docs',
      'ai_documents',
      'noc_settings'
    ];
    const counts = {};
    for (const t of tables) {
      try {
        const q = await pool.query(`SELECT count(*) as count FROM public.${t}`);
        counts[t] = parseInt(q.rows[0].count, 10);
      } catch (tableErr) {
        counts[t] = 0;
      }
    }
    res.json({
      success: true,
      host: dbHost,
      port: dbPort,
      database: dbName,
      ssl: true,
      counts
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. NOC Records CRUD & Bulk Operations

// GET all deleted records (Recycle Bin) - MUST BE BEFORE /:id
app.get('/api/records/deleted', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.noc_deleted_records ORDER BY deleted_at DESC LIMIT 500');
    const records = result.rows.map(row => {
      const r = mapDbToRecord(row);
      return {
        ...r,
        deletedAt: row.deleted_at ? (typeof row.deleted_at === 'object' ? row.deleted_at.toISOString() : String(row.deleted_at)) : new Date().toISOString(),
        deletedBy: row.deleted_by || 'System Administrator'
      };
    });
    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST to archive a deleted record
app.post('/api/records/deleted', async (req, res) => {
  try {
    const rec = req.body;
    const r = mapRecordToDb(rec);
    await pool.query(`
      INSERT INTO public.noc_deleted_records (
        id, noc_number, noc_type, client, issued_to, company_code,
        date_of_issuance, date_of_expiration, description, documents,
        deleted_at, deleted_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
          deleted_at = EXCLUDED.deleted_at,
          deleted_by = EXCLUDED.deleted_by;
    `, [
      r.id, r.noc_number, r.noc_type, r.client, r.issued_to, r.company_code,
      r.date_of_issuance, r.date_of_expiration, r.description, r.documents,
      rec.deletedAt || new Date().toISOString(), rec.deletedBy || 'System Administrator', r.created_at
    ]);
    res.status(201).json({ success: true, message: 'Record archived in Recycle Bin' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Empty Recycle Bin
app.delete('/api/records/deleted', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM public.noc_deleted_records');
    res.json({ success: true, cleared: result.rowCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Permanently delete a record from Recycle Bin
app.delete('/api/records/deleted/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM public.noc_deleted_records WHERE id = $1', [req.params.id]);
    res.json({ success: true, permanentlyDeletedId: req.params.id, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Restore a deleted record back to active records
app.post('/api/records/:id/restore', async (req, res) => {
  try {
    const id = req.params.id;
    let rec = req.body && req.body.nocNumber ? req.body : null;

    if (!rec) {
      const delQuery = await pool.query('SELECT * FROM public.noc_deleted_records WHERE id = $1', [id]);
      if (delQuery.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Deleted record not found in Recycle Bin' });
      }
      rec = mapDbToRecord(delQuery.rows[0]);
    }

    const r = mapRecordToDb(rec);

    // 1. Insert/update into active noc_records
    const insertResult = await pool.query(`
      INSERT INTO public.noc_records (
        id, noc_number, noc_type, client, issued_to, company_code,
        date_of_issuance, date_of_expiration, description, documents,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, timezone('utc'::text, now()))
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
          updated_at = timezone('utc'::text, now())
      RETURNING *;
    `, [
      r.id, r.noc_number, r.noc_type, r.client, r.issued_to, r.company_code,
      r.date_of_issuance, r.date_of_expiration, r.description, r.documents,
      r.created_at
    ]);

    // 2. Remove from noc_deleted_records
    await pool.query('DELETE FROM public.noc_deleted_records WHERE id = $1', [id]);

    res.json({ success: true, message: 'Record restored successfully', data: mapDbToRecord(insertResult.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bulk upsert NOC Records with PDF attachments
app.post('/api/records/bulk-upsert', async (req, res) => {
  try {
    const rawRecords = Array.isArray(req.body.records) ? req.body.records : (Array.isArray(req.body) ? req.body : []);
    if (rawRecords.length === 0) {
      return res.json({ success: true, count: 0, message: 'No records provided' });
    }

    let upsertedCount = 0;
    for (const rec of rawRecords) {
      const r = mapRecordToDb(rec);
      const query = `
        INSERT INTO public.noc_records (
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
            updated_at = EXCLUDED.updated_at;
      `;
      await pool.query(query, [
        r.id, r.noc_number, r.noc_type, r.client, r.issued_to, r.company_code,
        r.date_of_issuance, r.date_of_expiration, r.description, r.documents,
        r.created_at, r.updated_at
      ]);
      upsertedCount++;
    }

    res.json({ success: true, count: upsertedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/records/bulk', async (req, res) => {
  const records = req.body.records || [];
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, error: 'Records array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const raw of records) {
      const r = mapRecordToDb(raw);
      await client.query(`
        INSERT INTO public.noc_records (
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
            updated_at = EXCLUDED.updated_at;
      `, [
        r.id, r.noc_number, r.noc_type, r.client, r.issued_to, r.company_code,
        r.date_of_issuance, r.date_of_expiration, r.description, r.documents,
        r.created_at, r.updated_at
      ]);
    }
    await client.query('COMMIT');
    res.json({ success: true, inserted: records.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/records/bulk-delete', async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : [];
  const deletedBy = req.body.deletedBy || 'System Administrator';
  if (ids.length === 0) {
    return res.status(400).json({ success: false, error: 'IDs array required' });
  }
  try {
    // 1. Direct atomic copy of all records into noc_deleted_records
    await pool.query(`
      INSERT INTO public.noc_deleted_records (
        id, noc_number, noc_type, client, issued_to, company_code,
        date_of_issuance, date_of_expiration, description, documents,
        deleted_at, deleted_by, created_at
      )
      SELECT 
        id, noc_number, noc_type, client, issued_to, company_code,
        date_of_issuance, date_of_expiration, description, documents,
        timezone('utc'::text, now()), $2, created_at
      FROM public.noc_records
      WHERE id::text = ANY($1::text[])
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
          deleted_at = timezone('utc'::text, now()),
          deleted_by = EXCLUDED.deleted_by;
    `, [ids, deletedBy]);

    // 2. Delete from active noc_records
    const result = await pool.query('DELETE FROM public.noc_records WHERE id::text = ANY($1::text[])', [ids]);
    invalidateRecordsCache();
    loadLightweightRecordsFromDb().catch(() => {});
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    const errorDetails = logDatabaseError('POST /api/records/bulk-delete', err);
    res.status(500).json({ success: false, error: err.message, details: errorDetails });
  }
});

// GET all active NOC records (Fast in-memory cache + lightweight documents projection)
app.get('/api/records', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5000;
    const search = req.query.q ? req.query.q.trim().toLowerCase() : '';

    if (!cachedLightweightRecords || (Date.now() - cacheTimestamp > CACHE_TTL_MS)) {
      await loadLightweightRecordsFromDb();
    }

    let records = cachedLightweightRecords || [];
    if (search) {
      records = records.filter(r => 
        (r.nocNumber && r.nocNumber.toLowerCase().includes(search)) ||
        (r.client && r.client.toLowerCase().includes(search)) ||
        (r.issuedTo && r.issuedTo.toLowerCase().includes(search)) ||
        (r.companyCode && r.companyCode.toLowerCase().includes(search)) ||
        (r.nocType && r.nocType.toLowerCase().includes(search)) ||
        (r.description && r.description.toLowerCase().includes(search))
      );
    }

    if (limit && records.length > limit) {
      records = records.slice(0, limit);
    }

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Single NOC Record by ID (Includes full document attachments & base64 data)
app.get('/api/records/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.noc_records WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    res.json({ success: true, data: mapDbToRecord(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/records', async (req, res) => {
  try {
    const r = mapRecordToDb(req.body);
    const query = `
      INSERT INTO public.noc_records (
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
          updated_at = EXCLUDED.updated_at
      RETURNING *;
    `;
    const result = await pool.query(query, [
      r.id, r.noc_number, r.noc_type, r.client, r.issued_to, r.company_code,
      r.date_of_issuance, r.date_of_expiration, r.description, r.documents,
      r.created_at, r.updated_at
    ]);
    invalidateRecordsCache();
    loadLightweightRecordsFromDb().catch(() => {});
    res.status(201).json({ success: true, data: mapDbToRecord(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/records/:id', async (req, res) => {
  try {
    const r = mapRecordToDb({ ...req.body, id: req.params.id, updatedAt: new Date().toISOString() });
    const query = `
      UPDATE public.noc_records
      SET noc_number = $2,
          noc_type = $3,
          client = $4,
          issued_to = $5,
          company_code = $6,
          date_of_issuance = $7,
          date_of_expiration = $8,
          description = $9,
          documents = $10,
          updated_at = timezone('utc'::text, now())
      WHERE id = $1
      RETURNING *;
    `;
    const result = await pool.query(query, [
      r.id, r.noc_number, r.noc_type, r.client, r.issued_to, r.company_code,
      r.date_of_issuance, r.date_of_expiration, r.description, r.documents
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    invalidateRecordsCache();
    loadLightweightRecordsFromDb().catch(() => {});
    res.json({ success: true, data: mapDbToRecord(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete an NOC record (archives to noc_deleted_records before removing)
app.delete('/api/records/:id', async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    const deletedBy = (req.body && req.body.deletedBy) || 'System Administrator';
    const existing = await pool.query('SELECT * FROM public.noc_records WHERE id = $1', [id]);
    if (existing.rows.length > 0) {
      const rec = existing.rows[0];
      let docsJson = '[]';
      if (rec.documents) {
        docsJson = typeof rec.documents === 'string' ? rec.documents : JSON.stringify(rec.documents);
      }
      await pool.query(`
        INSERT INTO public.noc_deleted_records (
          id, noc_number, noc_type, client, issued_to, company_code,
          date_of_issuance, date_of_expiration, description, documents,
          deleted_at, deleted_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, timezone('utc'::text, now()), $11, $12)
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
            deleted_at = timezone('utc'::text, now()),
            deleted_by = EXCLUDED.deleted_by;
      `, [
        rec.id, rec.noc_number, rec.noc_type, rec.client, rec.issued_to, rec.company_code,
        rec.date_of_issuance, rec.date_of_expiration, rec.description, docsJson,
        deletedBy, rec.created_at
      ]).catch(err => console.warn('Archive to deleted records warning:', err.message));
    }

    const result = await pool.query('DELETE FROM public.noc_records WHERE id = $1 RETURNING id', [id]);
    invalidateRecordsCache();
    await loadLightweightRecordsFromDb().catch(() => {});
    res.json({ success: true, deletedId: id, count: result.rowCount });
  } catch (err) {
    const errorDetails = logDatabaseError('DELETE /api/records/:id', err);
    res.status(500).json({ success: false, error: err.message, details: errorDetails });
  }
});

// Bulk upsert NOC Records with PDF attachments
app.post('/api/records/bulk-upsert', async (req, res) => {
  try {
    const rawRecords = Array.isArray(req.body.records) ? req.body.records : (Array.isArray(req.body) ? req.body : []);
    if (rawRecords.length === 0) {
      return res.json({ success: true, count: 0, message: 'No records provided' });
    }

    let upsertedCount = 0;
    for (const rec of rawRecords) {
      const r = mapRecordToDb(rec);
      const query = `
        INSERT INTO public.noc_records (
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
            updated_at = EXCLUDED.updated_at;
      `;
      await pool.query(query, [
        r.id, r.noc_number, r.noc_type, r.client, r.issued_to, r.company_code,
        r.date_of_issuance, r.date_of_expiration, r.description, r.documents,
        r.created_at, r.updated_at
      ]);
      upsertedCount++;
    }

    invalidateRecordsCache();
    loadLightweightRecordsFromDb().catch(() => {});
    res.json({ success: true, count: upsertedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/records/bulk', async (req, res) => {
  const records = req.body.records || [];
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, error: 'Records array is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const raw of records) {
      const r = mapRecordToDb(raw);
      await client.query(`
        INSERT INTO public.noc_records (
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
            updated_at = EXCLUDED.updated_at;
      `, [
        r.id, r.noc_number, r.noc_type, r.client, r.issued_to, r.company_code,
        r.date_of_issuance, r.date_of_expiration, r.description, r.documents,
        r.created_at, r.updated_at
      ]);
    }
    await client.query('COMMIT');
    invalidateRecordsCache();
    loadLightweightRecordsFromDb().catch(() => {});
    res.json({ success: true, inserted: records.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/records/bulk-delete', async (req, res) => {
  const ids = req.body.ids || [];
  const deletedBy = req.body.deletedBy || 'Developer';
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: 'IDs array required' });
  }
  try {
    const fetchRes = await pool.query('SELECT * FROM public.noc_records WHERE id = ANY($1)', [ids]);
    for (const r of fetchRes.rows) {
      await pool.query(`
        INSERT INTO public.noc_deleted_records (
          id, noc_number, noc_type, client, issued_to, company_code,
          date_of_issuance, date_of_expiration, description, documents,
          deleted_at, deleted_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
            deleted_at = EXCLUDED.deleted_at,
            deleted_by = EXCLUDED.deleted_by;
      `, [
        r.id, r.noc_number, r.noc_type, r.client, r.issued_to, r.company_code,
        r.date_of_issuance, r.date_of_expiration, r.description, r.documents,
        new Date().toISOString(), deletedBy, r.created_at
      ]);
    }
    const result = await pool.query('DELETE FROM public.noc_records WHERE id = ANY($1)', [ids]);
    invalidateRecordsCache();
    loadLightweightRecordsFromDb().catch(() => {});
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Requirements Documents API
app.get('/api/requirements-docs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.noc_requirements_docs ORDER BY uploaded_at DESC');
    const docs = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      size: Number(r.size || 0),
      dataUrl: r.data_url,
      uploadedAt: r.uploaded_at,
      uploadedBy: r.uploaded_by
    }));
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/requirements-docs', async (req, res) => {
  try {
    const doc = req.body;
    const id = doc.id || 'req_doc_' + Date.now();
    const query = `
      INSERT INTO public.noc_requirements_docs (id, name, type, size, data_url, uploaded_at, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          type = EXCLUDED.type,
          size = EXCLUDED.size,
          data_url = EXCLUDED.data_url,
          uploaded_at = EXCLUDED.uploaded_at,
          uploaded_by = EXCLUDED.uploaded_by
      RETURNING *;
    `;
    const result = await pool.query(query, [
      id,
      doc.name || 'Untitled Document',
      doc.type || 'application/pdf',
      Number(doc.size || 0),
      doc.dataUrl || doc.data_url || '',
      doc.uploadedAt || doc.uploaded_at || new Date().toISOString(),
      doc.uploadedBy || doc.uploaded_by || 'System Administrator'
    ]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/requirements-docs/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM public.noc_requirements_docs WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. SBYI COC Documents API
app.get('/api/coc-docs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.sbyi_coc_docs ORDER BY uploaded_at DESC');
    const docs = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type || 'application/pdf',
      size: Number(r.size || 0),
      dataUrl: r.data_url,
      uploadedAt: r.uploaded_at,
      uploadedBy: r.uploaded_by
    }));
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/coc-docs', async (req, res) => {
  try {
    const doc = req.body;
    const id = doc.id || 'coc_doc_' + Date.now();
    const query = `
      INSERT INTO public.sbyi_coc_docs (id, name, type, size, data_url, uploaded_at, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          type = EXCLUDED.type,
          size = EXCLUDED.size,
          data_url = EXCLUDED.data_url,
          uploaded_at = EXCLUDED.uploaded_at,
          uploaded_by = EXCLUDED.uploaded_by
      RETURNING *;
    `;
    const result = await pool.query(query, [
      id,
      doc.name || 'Untitled Document.pdf',
      doc.type || 'application/pdf',
      Number(doc.size || 0),
      doc.dataUrl || doc.data_url || '',
      doc.uploadedAt || doc.uploaded_at || new Date().toISOString(),
      doc.uploadedBy || doc.uploaded_by || 'SBYI Management'
    ]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/coc-docs/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM public.sbyi_coc_docs WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. AI Documents API
app.get('/api/ai-docs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.ai_documents ORDER BY uploaded_at DESC');
    const docs = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type || 'application/pdf',
      size: Number(r.size || 0),
      dataUrl: r.data_url,
      uploadedAt: r.uploaded_at,
      uploadedBy: r.uploaded_by
    }));
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/ai-docs', async (req, res) => {
  try {
    const doc = req.body;
    const id = doc.id || 'ai_doc_' + Date.now();
    const query = `
      INSERT INTO public.ai_documents (id, name, type, size, data_url, uploaded_at, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          type = EXCLUDED.type,
          size = EXCLUDED.size,
          data_url = EXCLUDED.data_url,
          uploaded_at = EXCLUDED.uploaded_at,
          uploaded_by = EXCLUDED.uploaded_by
      RETURNING *;
    `;
    const result = await pool.query(query, [
      id,
      doc.name || 'Untitled Document',
      doc.type || 'application/pdf',
      Number(doc.size || 0),
      doc.dataUrl || doc.data_url || '',
      doc.uploadedAt || doc.uploaded_at || new Date().toISOString(),
      doc.uploadedBy || doc.uploaded_by || 'System Administrator'
    ]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/ai-docs/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM public.ai_documents WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Custom Types API
app.get('/api/custom-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM public.noc_custom_types ORDER BY name ASC');
    res.json({ success: true, data: result.rows.map(r => r.name) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/custom-types', async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
  try {
    await pool.query('INSERT INTO public.noc_custom_types (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
    res.json({ success: true, name });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/custom-types/:name', async (req, res) => {
  try {
    await pool.query('DELETE FROM public.noc_custom_types WHERE name = $1', [req.params.name]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Custom Contractors API
app.get('/api/custom-contractors', async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM public.noc_custom_contractors ORDER BY name ASC');
    res.json({ success: true, data: result.rows.map(r => r.name) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/custom-contractors', async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
  try {
    await pool.query('INSERT INTO public.noc_custom_contractors (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
    res.json({ success: true, name });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/custom-contractors/:name', async (req, res) => {
  try {
    await pool.query('DELETE FROM public.noc_custom_contractors WHERE name = $1', [req.params.name]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. System Settings API
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM public.noc_settings');
    const settings = {};
    result.rows.forEach(r => {
      settings[r.key] = r.value;
    });
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/settings/:key', async (req, res) => {
  try {
    const result = await pool.query('SELECT value FROM public.noc_settings WHERE key = $1', [req.params.key]);
    if (result.rows.length === 0) return res.json({ success: true, data: null });
    res.json({ success: true, data: result.rows[0].value });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ success: false, error: 'Setting key is required' });
  try {
    const valObj = typeof value === 'string' ? JSON.parse(value) : value;
    await pool.query(`
      INSERT INTO public.noc_settings (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = timezone('utc'::text, now());
    `, [key, JSON.stringify(valObj || {})]);
    res.json({ success: true, key, value: valObj });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Users & Authentication API
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT username, password, password_hash, role, display_name, email, created_at, updated_at FROM public.noc_users ORDER BY username ASC');
    const users = result.rows.map(r => ({
      username: r.username,
      password: r.password || '',
      role: r.role || 'guest',
      displayName: r.display_name || r.username,
      email: r.email || ''
    }));
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const u = req.body;
  if (!u.username || !u.password) {
    return res.status(400).json({ success: false, error: 'Username and password are required' });
  }
  try {
    const query = `
      INSERT INTO public.noc_users (username, password, role, display_name, email)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) DO UPDATE
      SET password = EXCLUDED.password,
          role = EXCLUDED.role,
          display_name = EXCLUDED.display_name,
          email = EXCLUDED.email,
          updated_at = timezone('utc'::text, now())
      RETURNING username, role, display_name, email;
    `;
    const result = await pool.query(query, [
      u.username.trim(),
      u.password,
      u.role || 'guest',
      u.displayName || u.display_name || u.username,
      u.email || ''
    ]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/users/:username', async (req, res) => {
  try {
    await pool.query('DELETE FROM public.noc_users WHERE lower(username) = lower($1)', [req.params.username]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Run Migration on Demand Endpoint
app.post('/api/migrate', async (req, res) => {
  try {
    const { runMigration } = require('./database/migrate_to_aiven');
    await runMigration();
    res.json({ success: true, message: 'All local data records migrated to Aiven successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Root fallback to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Express Server when run locally
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 NOC Backend Server running on port ${PORT}`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🧪 Test Endpoint: http://localhost:${PORT}/api/db-test`);
    console.log(`📊 Stats Endpoint: http://localhost:${PORT}/api/stats`);
    console.log(`=========================================`);
  });
}

module.exports = app;
