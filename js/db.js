/**
 * NOC Portal - Unified Supabase / PostgreSQL Database Storage Engine
 * Handles PostgreSQL queries via Supabase JS SDK with resilient local offline fallback.
 */

const LOCAL_DB_NAME = 'NOC_Portal_DB';
const LOCAL_DB_VERSION = 2;
const LOCAL_STORE_NAME = 'noc_records';
const LOCAL_DELETED_STORE_NAME = 'noc_deleted_records';

class NOCDatabase {
  constructor() {
    this.localDb = null;
    this._memoryCache = null;
    this.isAivenConnected = false;
    this.isAivenConnecting = true;
    this.apiBaseUrl = (typeof localStorage !== 'undefined' && localStorage.getItem('noc_active_api_url')) || '';
    this.heartbeatTimer = null;
    this.initPromise = this.init();
  }

  /**
   * Initialize local IndexedDB engine for offline / fallback storage
   */
  async initLocalDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported by browser.');
        resolve(null);
        return;
      }

      const request = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(LOCAL_STORE_NAME)) {
          const store = db.createObjectStore(LOCAL_STORE_NAME, { keyPath: 'id' });
          store.createIndex('nocNumber', 'nocNumber', { unique: true });
          store.createIndex('nocType', 'nocType', { unique: false });
          store.createIndex('client', 'client', { unique: false });
          store.createIndex('issuedTo', 'issuedTo', { unique: false });
          store.createIndex('dateOfExpiration', 'dateOfExpiration', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(LOCAL_DELETED_STORE_NAME)) {
          const delStore = db.createObjectStore(LOCAL_DELETED_STORE_NAME, { keyPath: 'id' });
          delStore.createIndex('nocNumber', 'nocNumber', { unique: false });
          delStore.createIndex('deletedAt', 'deletedAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.localDb = event.target.result;
        resolve(this.localDb);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        resolve(null);
      };
    });
  }

  /**
   * Helper to build fully qualified API URL based on active backend host
   */
  getApiUrl(endpoint) {
    const base = this.apiBaseUrl !== undefined ? this.apiBaseUrl : '';
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    return `${base}${cleanEndpoint}`;
  }

  /**
   * Check connection to backend Aiven PostgreSQL API (ultra-fast concurrent probing)
   */
  async checkAivenStatus(forceTest = false) {
    this.isAivenConnecting = true;
    const candidates = [];
    const isHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
    const origin = typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : '';

    // 1. Same origin / relative URL (Highest priority for Vercel / Cloud deployments)
    if (origin && origin.startsWith('http')) {
      if (!candidates.includes('')) candidates.push('');
      if (!candidates.includes(origin)) candidates.push(origin);
    }

    // 2. Cached last working API base URL
    try {
      const cachedActive = localStorage.getItem('noc_active_api_url');
      if (cachedActive && !candidates.includes(cachedActive)) {
        if (!isHttps || cachedActive.startsWith('https:') || cachedActive === '') {
          candidates.push(cachedActive);
        }
      }
    } catch (e) {}

    // 3. Custom API URL if configured
    try {
      const customUrl = this.customApiUrl || localStorage.getItem('noc_custom_api_url');
      if (customUrl && !candidates.includes(customUrl)) {
        if (!isHttps || customUrl.startsWith('https:')) {
          candidates.push(customUrl);
        }
      }
    } catch (e) {}

    // 4. Localhost Node.js backend server (only if on HTTP or file:// protocol to avoid Mixed Content)
    if (!isHttps) {
      if (!candidates.includes('http://localhost:3000')) {
        candidates.push('http://localhost:3000');
      }
      if (!candidates.includes('http://127.0.0.1:3000')) {
        candidates.push('http://127.0.0.1:3000');
      }
    }

    const checkCandidate = async (base) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      try {
        const url = `${base}/api/stats`;
        const res = await fetch(url, {
          cache: 'no-store',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            return { base, data };
          }
        }
      } catch (e) {
        clearTimeout(timeoutId);
      }
      throw new Error(`Candidate ${base} unreachable`);
    };

    try {
      const result = await Promise.any(candidates.map(c => checkCandidate(c)));
      if (result && result.data) {
        const { base, data } = result;
        this.apiBaseUrl = base;
        try {
          localStorage.setItem('noc_active_api_url', base);
        } catch (e) {}

        this.isAivenConnected = true;
        this.isAivenConnecting = false;
        this.aivenHost = data.host || 'pg2026-noc-ryansbyi-noc.f.aivencloud.com';
        this.aivenCounts = data.counts || {};
        this.aivenDatabase = data.database || 'defaultdb';
        this.aivenPort = data.port || 13029;

        console.log(`NOCDatabase: Connected automatically to Aiven PostgreSQL cloud database (${this.aivenHost}:${this.aivenPort}) via ${base || 'current origin'}.`);
        window.dispatchEvent(new CustomEvent('noc:aiven-status-change', {
          detail: { isConnected: true, isConnecting: false, host: this.aivenHost, port: this.aivenPort, database: this.aivenDatabase, counts: data.counts, baseUrl: base }
        }));
        return true;
      }
    } catch (err) {
      // All candidates failed
    }

    this.isAivenConnected = false;
    this.isAivenConnecting = false;
    window.dispatchEvent(new CustomEvent('noc:aiven-status-change', {
      detail: { isConnected: false, isConnecting: false }
    }));
    return false;
  }

  /**
   * Heartbeat background connection keeper & auto-reconnector
   */
  startAivenHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    // Fast 2s auto-reconnect interval when disconnected, 15s check when live
    const interval = this.isAivenConnected ? 15000 : 2000;
    this.heartbeatTimer = setInterval(async () => {
      const wasConnected = this.isAivenConnected;
      const isNowConnected = await this.checkAivenStatus();
      if (!wasConnected && isNowConnected) {
        console.log('NOCDatabase: Aiven Cloud auto-reconnected via heartbeat!');
        if (window.nocApp && window.nocApp.refreshData) {
          window.nocApp.refreshData(true).catch(() => {});
        }
        if (window.nocUI && window.nocUI.renderDatabaseStatus) {
          window.nocUI.renderDatabaseStatus();
        }
        this.startAivenHeartbeat();
      } else if (wasConnected && !isNowConnected) {
        console.warn('NOCDatabase: Aiven Cloud connection lost, entering fast auto-reconnect loop...');
        if (window.nocUI && window.nocUI.renderDatabaseStatus) {
          window.nocUI.renderDatabaseStatus();
        }
        this.startAivenHeartbeat();
      }
    }, interval);

    // Also auto-reconnect when tab regains focus or network comes online
    if (!this._hasAttachedFocusListeners && typeof window !== 'undefined') {
      this._hasAttachedFocusListeners = true;
      window.addEventListener('focus', () => {
        if (!this.isAivenConnected) {
          this.checkAivenStatus().then(connected => {
            if (connected && window.nocApp && window.nocApp.refreshData) {
              window.nocApp.refreshData(true).catch(() => {});
            }
          });
        }
      });
      window.addEventListener('online', () => {
        this.checkAivenStatus().then(connected => {
          if (connected && window.nocApp && window.nocApp.refreshData) {
            window.nocApp.refreshData(true).catch(() => {});
          }
        });
      });
    }
  }

  /**
   * Test latency, connectivity, and database version with Aiven Cloud
   */
  async testAivenConnection() {
    const start = Date.now();
    try {
      // First ensure status check
      await this.checkAivenStatus(true);
      const url = this.getApiUrl('/api/db-test');
      const res = await fetch(url, { cache: 'no-store' });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        const body = await res.json();
        if (body.success) {
          return {
            success: true,
            latencyMs,
            host: body.host || this.aivenHost || 'pg2026-noc-ryansbyi-noc.f.aivencloud.com',
            port: body.port || this.aivenPort || 13029,
            database: body.database || this.aivenDatabase || 'defaultdb',
            version: body.version || 'PostgreSQL 18.6 (Aiven Cloud)',
            counts: this.aivenCounts || {}
          };
        }
      }
      return { success: false, message: 'Server returned an error status.' };
    } catch (err) {
      return { success: false, message: 'Could not connect to backend server at http://localhost:3000.' };
    }
  }

  /**
   * 1-Click Sync all local data (including all PDF attachments) to Aiven Cloud PostgreSQL
   */
  async syncLocalToAiven(onProgress = null) {
    if (!this.isAivenActive()) {
      await this.checkAivenStatus(true);
      if (!this.isAivenActive()) {
        throw new Error('Aiven backend server is not connected at http://localhost:3000.');
      }
    }

    const localRecords = await this._localGetAll();
    const localReqDocs = await this.getRequirementsDocs();
    const localCocDocs = await this.getCocDocs();
    const localAiDocs = await this.getAiDocs();
    const localTypes = await this.getCustomTypes();
    const localContractors = await this.getCustomContractors();
    const localUsers = await this.getUsers();
    const localRenames = await this.getContractorRenames();

    const stats = {
      recordsSynced: 0,
      reqDocsSynced: 0,
      cocDocsSynced: 0,
      aiDocsSynced: 0,
      typesSynced: 0,
      contractorsSynced: 0,
      usersSynced: 0,
      settingsSynced: 0
    };

    // 1. Sync NOC Records with all attached PDF documents in batches
    if (localRecords && localRecords.length > 0) {
      const BATCH_SIZE = 10;
      for (let i = 0; i < localRecords.length; i += BATCH_SIZE) {
        const batch = localRecords.slice(i, i + BATCH_SIZE);
        try {
          const res = await fetch(this.getApiUrl('/api/records/bulk-upsert'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: batch })
          });
          if (res.ok) {
            stats.recordsSynced += batch.length;
          } else {
            // Fallback row by row
            for (const singleRec of batch) {
              await fetch(this.getApiUrl('/api/records'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(singleRec)
              });
              stats.recordsSynced++;
            }
          }
        } catch (batchErr) {
          console.warn('Batch sync note, falling back to row-by-row:', batchErr.message);
          for (const singleRec of batch) {
            try {
              await fetch(this.getApiUrl('/api/records'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(singleRec)
              });
              stats.recordsSynced++;
            } catch (singleErr) {
              console.warn('Single record sync note:', singleErr.message);
            }
          }
        }

        if (typeof onProgress === 'function') {
          onProgress({ stage: 'records', current: stats.recordsSynced, total: localRecords.length });
        }
      }
    }

    // 2. Sync Requirements Documents (PDFs / Docs)
    if (localReqDocs && localReqDocs.length > 0) {
      for (const doc of localReqDocs) {
        try {
          await fetch(this.getApiUrl('/api/requirements-docs'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(doc)
          });
          stats.reqDocsSynced++;
        } catch (e) {
          console.warn('Sync req doc note:', e.message);
        }
      }
    }

    // 3. Sync SBYI COC Documents (PDFs)
    if (localCocDocs && localCocDocs.length > 0) {
      for (const doc of localCocDocs) {
        try {
          await fetch(this.getApiUrl('/api/coc-docs'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(doc)
          });
          stats.cocDocsSynced++;
        } catch (e) {
          console.warn('Sync coc doc note:', e.message);
        }
      }
    }

    // 4. Sync AI Documents (DOC / PDF)
    if (localAiDocs && localAiDocs.length > 0) {
      for (const doc of localAiDocs) {
        try {
          await fetch(this.getApiUrl('/api/ai-docs'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(doc)
          });
          stats.aiDocsSynced++;
        } catch (e) {
          console.warn('Sync ai doc note:', e.message);
        }
      }
    }

    // 5. Sync Custom Types
    if (localTypes && localTypes.length > 0) {
      for (const type of localTypes) {
        try {
          await fetch(this.getApiUrl('/api/custom-types'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: type })
          });
          stats.typesSynced++;
        } catch (e) {}
      }
    }

    // 6. Sync Custom Contractors
    if (localContractors && localContractors.length > 0) {
      for (const c of localContractors) {
        try {
          await fetch(this.getApiUrl('/api/custom-contractors'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: c })
          });
          stats.contractorsSynced++;
        } catch (e) {}
      }
    }

    // 7. Sync Users
    if (localUsers && localUsers.length > 0) {
      for (const u of localUsers) {
        try {
          await fetch(this.getApiUrl('/api/users'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(u)
          });
          stats.usersSynced++;
        } catch (e) {}
      }
    }

    // 8. Sync Settings
    try {
      await fetch(this.getApiUrl('/api/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'noc_contractor_renames', value: localRenames })
      });
      stats.settingsSynced++;
    } catch (e) {}

    await this.checkAivenStatus(true);
    return {
      success: true,
      stats,
      message: `Successfully migrated ${stats.recordsSynced} NOC records with all PDF attachments, ${stats.reqDocsSynced} guidelines, ${stats.cocDocsSynced} COC certs, ${stats.aiDocsSynced} AI docs, ${stats.typesSynced} types, ${stats.contractorsSynced} contractors & ${stats.usersSynced} users to Aiven PostgreSQL Cloud!`
    };
  }

  /**
   * Check if active database is Aiven Cloud PostgreSQL
   */
  isAivenActive() {
    return Boolean(this.isAivenConnected);
  }

  /**
   * Main database initialization
   */
  async init() {
    await this.initLocalDB();
    await this.purgeLegacyDemoData();

    // 1. Auto-connect to Aiven PostgreSQL Cloud database immediately
    const aivenOk = await this.checkAivenStatus();
    if (aivenOk) {
      console.log('NOCDatabase: Aiven Cloud Backend active & connected automatically.');
      this.startAivenHeartbeat();
      return;
    }

    // 2. Fallback: Check if Supabase client is configured and test connection
    if (window.supabaseManager && window.supabaseManager.isConfigured()) {
      try {
        const status = await window.supabaseManager.testConnection();
        if (status.success) {
          console.log('NOCDatabase: Connected to Supabase PostgreSQL database.');
          this.purgeLegacyDemoData().catch(() => {});
        } else {
          console.warn('NOCDatabase: Supabase credentials found but connection test failed. Using local storage.', status.message);
        }
      } catch (e) {
        console.warn('NOCDatabase: Supabase test connection error:', e);
      }
    } else {
      console.log('NOCDatabase: Operating in Local Persistent mode (background Aiven auto-connect active).');
    }

    // Start background auto-reconnection polling
    this.startAivenHeartbeat();
  }

  /**
   * Cleans legacy demo account usernames from localStorage and Supabase if needed
   */
  async purgeLegacyDemoData() {
    const legacyUsernames = ['admin', 'developer', 'main', 'guest'];

    try {
      localStorage.removeItem('noc_users_v1');
      localStorage.removeItem('noc_users_v2');
    } catch (e) {}

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        await client.from('noc_users').delete().in('username', legacyUsernames);
      } catch (e) {
        console.warn('Supabase demo accounts purge note:', e);
      }
    }
  }

  /**
   * Check if active mode is Supabase PostgreSQL
   */
  isSupabaseActive() {
    return Boolean(
      window.supabaseManager && 
      window.supabaseManager.isConfigured() && 
      window.supabaseManager.getClient()
    );
  }

  /**
   * Get active Supabase client instance
   */
  getSupabaseClient() {
    return window.supabaseManager ? window.supabaseManager.getClient() : null;
  }

  // ==========================================================================
  // SCHEMA DATA MAPPERS (PostgreSQL snake_case <-> JavaScript UI camelCase)
  // ==========================================================================

  /**
   * Converts frontend NOC record to PostgreSQL database row
   */
  mapRecordToDb(rec) {
    if (!rec) return null;
    return {
      id: rec.id || 'noc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      noc_number: (rec.nocNumber || '').trim(),
      noc_type: rec.nocType || 'Activity',
      client: (rec.client || '').trim(),
      issued_to: (rec.issuedTo || '').trim().toUpperCase(),
      company_code: (rec.companyCode || '').trim(),
      date_of_issuance: rec.dateOfIssuance,
      date_of_expiration: rec.dateOfExpiration,
      description: rec.description || '',
      documents: Array.isArray(rec.documents) ? rec.documents : [],
      created_at: rec.createdAt || new Date().toISOString(),
      updated_at: rec.updatedAt || new Date().toISOString()
    };
  }

  /**
   * Converts PostgreSQL database row to frontend NOC record
   */
  mapDbToRecord(row) {
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
    }

    return {
      id: String(row.id),
      nocNumber: row.noc_number || row.nocNumber,
      nocType: row.noc_type || row.nocType || 'Activity',
      client: row.client || '',
      issuedTo: (row.issued_to || row.issuedTo || '').trim().toUpperCase(),
      companyCode: row.company_code || row.companyCode || '',
      dateOfIssuance: row.date_of_issuance || row.dateOfIssuance,
      dateOfExpiration: row.date_of_expiration || row.dateOfExpiration,
      description: row.description || '',
      documents: docs,
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt
    };
  }

  /**
   * Maps Requirements Doc frontend model to PostgreSQL row
   */
  mapReqDocToDb(doc) {
    return {
      id: doc.id || 'req_doc_' + Date.now(),
      name: doc.name || 'Untitled Document',
      type: doc.type || 'application/pdf',
      size: Number(doc.size || 0),
      data_url: doc.dataUrl || doc.data_url || '',
      uploaded_at: doc.uploadedAt || doc.uploaded_at || new Date().toISOString(),
      uploaded_by: doc.uploadedBy || doc.uploaded_by || 'System Administrator'
    };
  }

  /**
   * Maps PostgreSQL row to frontend Requirements Doc model
   */
  mapDbToReqDoc(row) {
    return {
      id: String(row.id),
      name: row.name,
      type: row.type,
      size: Number(row.size || 0),
      dataUrl: row.data_url || row.dataUrl,
      uploadedAt: row.uploaded_at || row.uploadedAt,
      uploadedBy: row.uploaded_by || row.uploadedBy || 'System Administrator'
    };
  }

  /**
   * Maps SBYI COC Doc frontend model to PostgreSQL row
   */
  mapCocDocToDb(doc) {
    return {
      id: doc.id || 'coc_doc_' + Date.now(),
      name: doc.name || 'Untitled Document.pdf',
      type: 'application/pdf',
      size: Number(doc.size || 0),
      data_url: doc.dataUrl || doc.data_url || '',
      uploaded_at: doc.uploadedAt || doc.uploaded_at || new Date().toISOString(),
      uploaded_by: doc.uploadedBy || doc.uploaded_by || 'SBYI Management'
    };
  }

  /**
   * Maps PostgreSQL row to frontend SBYI COC Doc model
   */
  mapDbToCocDoc(row) {
    return {
      id: String(row.id),
      name: row.name,
      type: 'application/pdf',
      size: Number(row.size || 0),
      dataUrl: row.data_url || row.dataUrl,
      uploadedAt: row.uploaded_at || row.uploadedAt,
      uploadedBy: row.uploaded_by || row.uploadedBy || 'SBYI Management'
    };
  }

  /**
   * Maps AI Document frontend model to PostgreSQL row
   */
  mapAiDocToDb(doc) {
    return {
      id: doc.id || 'ai_doc_' + Date.now(),
      name: doc.name || 'Untitled Document',
      type: doc.type || 'application/pdf',
      size: Number(doc.size || 0),
      data_url: doc.dataUrl || doc.data_url || '',
      uploaded_at: doc.uploadedAt || doc.uploaded_at || new Date().toISOString(),
      uploaded_by: doc.uploadedBy || doc.uploaded_by || 'System Administrator'
    };
  }

  /**
   * Maps PostgreSQL row to frontend AI Document model
   */
  mapDbToAiDoc(row) {
    return {
      id: String(row.id),
      name: row.name,
      type: row.type || 'application/pdf',
      size: Number(row.size || 0),
      dataUrl: row.data_url || row.dataUrl,
      uploadedAt: row.uploaded_at || row.uploadedAt,
      uploadedBy: row.uploaded_by || row.uploadedBy || 'System Administrator'
    };
  }

  /**
   * Maps User frontend model to PostgreSQL row
   */
  mapUserToDb(user) {
    return {
      username: user.username,
      password: user.password,
      role: user.role || 'guest',
      display_name: user.displayName || user.display_name || user.username,
      email: user.email || ''
    };
  }

  /**
   * Maps PostgreSQL row to frontend User model
   */
  mapDbToUser(row) {
    return {
      username: row.username,
      password: row.password,
      role: row.role || 'guest',
      displayName: row.display_name || row.displayName || row.username,
      email: row.email || ''
    };
  }

  // ==========================================================================
  // CORE NOC RECORD OPERATIONS
  // ==========================================================================

  /**
   * Retrieve all NOC records (Fast cached resolution + silent background sync).
   */
  async getAll(forceRemote = false) {
    // 0. Return in-memory cache instantly (< 0.1ms) if available
    if (!forceRemote && this._memoryCache && Array.isArray(this._memoryCache) && this._memoryCache.length > 0) {
      return this._memoryCache;
    }

    // 1. Check Aiven Cloud Backend (50ms response with lightweight projection)
    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/records?limit=5000'));
        if (res.ok) {
          const body = await res.json();
          if (body.success && Array.isArray(body.data)) {
            this._memoryCache = body.data;
            this._localBulkInsert(body.data).catch(() => {});
            return body.data;
          }
        }
      } catch (err) {
        console.warn('Aiven getAll failed, falling back to local:', err.message);
      }
    }

    // 2. Local IndexedDB Cache (< 5ms)
    const localRecords = await this._localGetAll();
    if (localRecords && localRecords.length > 0) {
      this._memoryCache = localRecords;
      return localRecords;
    }

    // 3. Supabase Cloud Fallback
    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const { data, error } = await client
          .from('noc_records')
          .select('id, noc_number, noc_type, client, issued_to, company_code, date_of_issuance, date_of_expiration, description, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(5000);

        if (error) throw error;

        if (data && data.length > 0) {
          const records = data.map(row => this.mapDbToRecord(row));
          this._memoryCache = records;
          this._localBulkInsert(records).catch(() => {});
          return records;
        }
      } catch (err) {
        console.warn('Supabase getAll failed, falling back to local DB:', err.message);
      }
    }

    // 4. Return local fallback
    return localRecords || [];
  }

  /**
   * Retrieve a single NOC record by ID.
   */
  async getById(id) {
    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/records/' + encodeURIComponent(id)));
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.data) return body.data;
        }
      } catch (err) {
        console.warn('Aiven getById failed, checking local:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const { data, error } = await client
          .from('noc_records')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        if (data) return this.mapDbToRecord(data);
      } catch (err) {
        console.warn('Supabase getById failed, falling back to local DB:', err.message);
      }
    }

    return this._localGetById(id);
  }

  /**
   * Find an NOC record by its NOC Number.
   */
  async getByNocNumber(nocNumber) {
    if (!nocNumber) return null;
    const cleanNum = nocNumber.trim();

    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/records?q=' + encodeURIComponent(cleanNum)));
        if (res.ok) {
          const body = await res.json();
          if (body.success && Array.isArray(body.data)) {
            const found = body.data.find(r => (r.nocNumber || '').toLowerCase() === cleanNum.toLowerCase());
            if (found) return found;
          }
        }
      } catch (err) {
        console.warn('Aiven getByNocNumber failed:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const { data, error } = await client
          .from('noc_records')
          .select('*')
          .ilike('noc_number', cleanNum)
          .maybeSingle();

        if (error) throw error;
        if (data) return this.mapDbToRecord(data);
      } catch (err) {
        console.warn('Supabase getByNocNumber failed, checking local DB:', err.message);
      }
    }

    return this._localGetByNocNumber(cleanNum);
  }

  /**
   * Add a new NOC record into the database.
   */
  async add(record) {
    // Check for duplicate NOC Number
    const existing = await this.getByNocNumber(record.nocNumber);
    if (existing) {
      throw new Error(`An NOC with Number "${record.nocNumber}" already exists.`);
    }

    const newRecord = {
      ...record,
      id: record.id || 'noc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: record.documents || []
    };

    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/records'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRecord)
        });
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.data) {
            await this._localPut(body.data).catch(() => {});
            return body.data;
          }
        }
      } catch (err) {
        console.warn('Aiven add failed, storing in local DB:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const dbPayload = this.mapRecordToDb(newRecord);
        const { data, error } = await client
          .from('noc_records')
          .insert(dbPayload)
          .select()
          .single();

        if (error) throw error;
        
        // Also cache locally for offline continuity
        await this._localPut(newRecord).catch(() => {});
        return this.mapDbToRecord(data);
      } catch (err) {
        console.warn('Supabase add failed, storing in local DB:', err.message);
        throw new Error(`Failed to save to Supabase: ${err.message}`);
      }
    }

    // Local IndexedDB
    await this._localAdd(newRecord);
    return newRecord;
  }

  /**
   * Update an existing NOC record.
   */
  async update(id, updatedFields) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Record with ID ${id} not found.`);
    }

    // Check if new NOC Number conflicts with another record
    if (updatedFields.nocNumber && updatedFields.nocNumber.trim() !== existing.nocNumber.trim()) {
      const duplicate = await this.getByNocNumber(updatedFields.nocNumber);
      if (duplicate && duplicate.id !== id) {
        throw new Error(`NOC Number "${updatedFields.nocNumber}" is already in use by another record.`);
      }
    }

    const mergedRecord = {
      ...existing,
      ...updatedFields,
      id: id,
      updatedAt: new Date().toISOString()
    };

    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/records/' + encodeURIComponent(id)), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mergedRecord)
        });
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.data) {
            await this._localPut(body.data).catch(() => {});
            return body.data;
          }
        }
      } catch (err) {
        console.warn('Aiven update failed:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const dbPayload = this.mapRecordToDb(mergedRecord);
        const { data, error } = await client
          .from('noc_records')
          .update(dbPayload)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        // Cache locally
        await this._localPut(mergedRecord).catch(() => {});
        return this.mapDbToRecord(data);
      } catch (err) {
        console.warn('Supabase update failed:', err.message);
        throw new Error(`Failed to update in Supabase: ${err.message}`);
      }
    }

    // Local IndexedDB
    await this._localPut(mergedRecord);
    return mergedRecord;
  }

  /**
   * Delete an NOC record (archives to Recycle Bin before removing).
   */
  async delete(id) {
    let targetRecord = null;
    try {
      targetRecord = await this.getById(id) || await this._localGetById(id);
    } catch (e) {}

    // 1. Archive to Recycle Bin / Deleted store
    if (targetRecord) {
      const deletedRecord = {
        ...targetRecord,
        deletedAt: new Date().toISOString(),
        deletedBy: (window.nocAuth && window.nocAuth.currentUser && (window.nocAuth.currentUser.displayName || window.nocAuth.currentUser.username)) || 'System Administrator'
      };
      await this._localSaveDeleted(deletedRecord).catch(() => {});

      if (this.isAivenActive()) {
        try {
          await fetch(this.getApiUrl('/api/records/deleted'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deletedRecord)
          });
        } catch (e) {}
      }
    }

    // 2. Delete from Aiven Cloud if active
    if (this.isAivenActive()) {
      try {
        await fetch(this.getApiUrl('/api/records/' + encodeURIComponent(id)), { method: 'DELETE' });
        await this._localDelete(id).catch(() => {});
        return true;
      } catch (err) {
        console.warn('Aiven delete failed:', err.message);
      }
    }

    // 3. Delete from Supabase if active
    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const { error } = await client
          .from('noc_records')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        // Also remove from local store
        await this._localDelete(id).catch(() => {});
        return true;
      } catch (err) {
        console.warn('Supabase delete failed:', err.message);
        throw new Error(`Failed to delete in Supabase: ${err.message}`);
      }
    }

    return this._localDelete(id);
  }

  /**
   * Bulk delete multiple NOC records (archives each to Recycle Bin).
   */
  async bulkDelete(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) return { success: true, count: 0 };

    const deletedBy = (window.nocAuth && window.nocAuth.currentUser && (window.nocAuth.currentUser.displayName || window.nocAuth.currentUser.username)) || 'Developer';
    const deletedAt = new Date().toISOString();

    // 1. Archive each record to local Recycle Bin
    for (const id of ids) {
      try {
        const rec = await this.getById(id) || await this._localGetById(id);
        if (rec) {
          const archived = {
            ...rec,
            deletedAt,
            deletedBy
          };
          await this._localSaveDeleted(archived).catch(() => {});
        }
      } catch (e) {}
    }

    // 2. Delete from Aiven Cloud if active
    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/records/bulk-delete'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, deletedBy })
        });
        if (res.ok) {
          for (const id of ids) {
            await this._localDelete(id).catch(() => {});
          }
          return { success: true, count: ids.length };
        }
      } catch (err) {
        console.warn('Aiven bulk delete failed:', err.message);
      }
    }

    // 3. Delete from Supabase if active
    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const { error } = await client
          .from('noc_records')
          .delete()
          .in('id', ids);

        if (error) throw error;
        for (const id of ids) {
          await this._localDelete(id).catch(() => {});
        }
        return { success: true, count: ids.length };
      } catch (err) {
        console.warn('Supabase bulk delete failed:', err.message);
      }
    }

    // 4. Local IndexedDB fallback bulk delete
    for (const id of ids) {
      await this._localDelete(id).catch(() => {});
    }
    return { success: true, count: ids.length };
  }

  /**
   * Retrieve all deleted records from Recycle Bin.
   */
  async getDeletedRecords() {
    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/records/deleted'), { cache: 'no-store' });
        if (res.ok) {
          const body = await res.json();
          if (body.success && Array.isArray(body.data)) {
            for (const d of body.data) {
              await this._localSaveDeleted(d).catch(() => {});
            }
            return body.data;
          }
        }
      } catch (e) {}
    }
    return this._localGetDeleted();
  }

  /**
   * Restore a single deleted record back into active records.
   */
  async restoreDeletedRecord(id) {
    const deletedList = await this._localGetDeleted();
    const record = deletedList.find(r => r.id === id);
    if (!record) {
      if (this.isAivenActive()) {
        try {
          const res = await fetch(this.getApiUrl(`/api/records/${encodeURIComponent(id)}/restore`), { method: 'POST' });
          if (res.ok) {
            const body = await res.json();
            if (body.success && body.data) {
              await this._localPut(body.data);
              await this._localRemoveDeleted(id);
              return body.data;
            }
          }
        } catch (e) {}
      }
      throw new Error('Deleted record not found in Recycle Bin.');
    }

    const restoredRecord = { ...record };
    delete restoredRecord.deletedAt;
    delete restoredRecord.deletedBy;
    restoredRecord.updatedAt = new Date().toISOString();

    // 1. Add back to active database
    await this.put(restoredRecord);

    // 2. Remove from deleted records store
    await this._localRemoveDeleted(id);

    // 3. Sync to Aiven if active
    if (this.isAivenActive()) {
      try {
        await fetch(this.getApiUrl(`/api/records/${encodeURIComponent(id)}/restore`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(restoredRecord)
        });
      } catch (e) {}
    }

    return restoredRecord;
  }

  /**
   * Restore all deleted records in the Recycle Bin.
   */
  async restoreAllDeletedRecords() {
    const deletedList = await this.getDeletedRecords();
    if (!deletedList || deletedList.length === 0) return 0;

    let restoredCount = 0;
    for (const d of deletedList) {
      try {
        await this.restoreDeletedRecord(d.id);
        restoredCount++;
      } catch (e) {
        console.warn('Error restoring deleted record:', d.id, e.message);
      }
    }
    return restoredCount;
  }

  /**
   * Permanently purge a record from Recycle Bin.
   */
  async permanentlyDeleteRecord(id) {
    await this._localRemoveDeleted(id);
    if (this.isAivenActive()) {
      try {
        await fetch(this.getApiUrl(`/api/records/deleted/${encodeURIComponent(id)}`), { method: 'DELETE' });
      } catch (e) {}
    }
    return true;
  }

  /**
   * Clear all deleted records from Recycle Bin.
   */
  async clearDeletedRecords() {
    await this._localClearDeleted();
    if (this.isAivenActive()) {
      try {
        await fetch(this.getApiUrl('/api/records/deleted'), { method: 'DELETE' });
      } catch (e) {}
    }
    return true;
  }

  /**
   * Get count of deleted records currently in Recycle Bin.
   */
  async getDeletedCount() {
    const records = await this._localGetDeleted();
    return records ? records.length : 0;
  }

  /**
   * Bulk insert/upsert records.
   */
  async bulkInsert(records) {
    if (!records || records.length === 0) return true;

    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/records/bulk'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records })
        });
        if (res.ok) {
          await this._localBulkInsert(records).catch(() => {});
          return records.length;
        }
      } catch (err) {
        console.warn('Aiven bulkInsert failed:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const dbRows = records.map(r => this.mapRecordToDb(r));
        const BATCH_SIZE = 5;
        for (let i = 0; i < dbRows.length; i += BATCH_SIZE) {
          const batch = dbRows.slice(i, i + BATCH_SIZE);
          try {
            const { error } = await client
              .from('noc_records')
              .upsert(batch, { onConflict: 'noc_number' });

            if (error) throw error;
          } catch (batchErr) {
            console.warn(`Supabase bulkInsert batch error (${i}-${i + batch.length}):`, batchErr.message);
          }
        }
        await this._localBulkInsert(records).catch(() => {});
        return records.length;
      } catch (err) {
        console.warn('Supabase bulkInsert failed, writing locally:', err.message);
      }
    }

    // Save locally
    return this._localBulkInsert(records);
  }

  /**
   * Clear all records in the database.
   */
  async clearAll() {
    if (this.isAivenActive()) {
      try {
        await fetch(this.getApiUrl('/api/records/bulk-delete'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: (await this._localGetAll()).map(r => r.id) })
        });
      } catch (err) {
        console.warn('Aiven clearAll note:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const { error } = await client
          .from('noc_records')
          .delete()
          .neq('id', '___none___');

        if (error) throw error;
      } catch (err) {
        console.warn('Supabase clearAll failed:', err.message);
      }
    }

    return this._localClearAll();
  }

  // ==========================================================================
  // NOC REQUIREMENTS DOCUMENTS (Max 5 Documents)
  // ==========================================================================

  /**
   * Get all stored NOC Requirements Documents
   */
  async getRequirementsDocs() {
    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/requirements-docs'), { cache: 'no-store' });
        if (res.ok) {
          const body = await res.json();
          if (body.success && Array.isArray(body.data) && body.data.length > 0) {
            try {
              localStorage.setItem('noc_requirements_documents_v2', JSON.stringify(body.data));
            } catch (e) {}
            return body.data;
          }
        }
      } catch (err) {
        console.warn('Aiven getRequirementsDocs failed, checking local:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const { data, error } = await client
          .from('noc_requirements_docs')
          .select('*')
          .order('uploaded_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        if (data && data.length > 0) {
          return data.map(row => this.mapDbToReqDoc(row));
        }
      } catch (err) {
        console.warn('Supabase getRequirementsDocs failed, reading local:', err.message);
      }
    }

    // Fallback to localStorage or default seed
    try {
      const stored = localStorage.getItem('noc_requirements_documents_v2');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not read requirements from localStorage', e);
    }
    return window.DEFAULT_NOC_REQUIREMENTS_DOCS || [];
  }

  /**
   * Save NOC Requirements Documents list (Enforcing 5 maximum)
   */
  async saveRequirementsDocs(docs) {
    const clamped = (docs || []).slice(0, 5);

    if (this.isAivenActive()) {
      try {
        for (const doc of clamped) {
          await fetch(this.getApiUrl('/api/requirements-docs'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(doc)
          });
        }
      } catch (err) {
        console.warn('Aiven saveRequirementsDocs note:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const dbRows = clamped.map(d => this.mapReqDocToDb(d));
        
        // Clear old and insert new
        await client.from('noc_requirements_docs').delete().neq('id', '___none___');
        if (dbRows.length > 0) {
          const { error } = await client.from('noc_requirements_docs').insert(dbRows);
          if (error) throw error;
        }
      } catch (err) {
        console.warn('Supabase saveRequirementsDocs failed, saving locally:', err.message);
      }
    }

    try {
      localStorage.setItem('noc_requirements_documents_v2', JSON.stringify(clamped));
    } catch (e) {
      console.warn('Could not write requirements to localStorage', e);
    }

    // Auto-sync AI Knowledge Base
    if (window.sbyimKnowledgeBase) {
      window.sbyimKnowledgeBase.syncKnowledgeBase().then(() => {
        if (window.sbyimAIUI) window.sbyimAIUI.updateKnowledgeStatusBadge();
      }).catch(() => {});
    }

    return clamped;
  }

  /**
   * Delete a single requirements document by ID
   */
  async deleteRequirementsDoc(id) {
    if (this.isAivenActive()) {
      try {
        await fetch(this.getApiUrl('/api/requirements-docs/' + encodeURIComponent(id)), { method: 'DELETE' });
      } catch (err) {
        console.warn('Aiven deleteRequirementsDoc note:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        await client.from('noc_requirements_docs').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteRequirementsDoc failed:', err.message);
      }
    }

    const docs = await this.getRequirementsDocs();
    const filtered = docs.filter(d => d.id !== id);
    return await this.saveRequirementsDocs(filtered);
  }

  // ==========================================================================
  // SBYI COC (CODE OF CONDUCT) DOCUMENTS (Max 8 PDF Documents)
  // ==========================================================================

  /**
   * Get all stored SBYI COC Documents (PDF only, max 8)
   */
  async getCocDocs() {
    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/coc-docs'), { cache: 'no-store' });
        if (res.ok) {
          const body = await res.json();
          if (body.success && Array.isArray(body.data) && body.data.length > 0) {
            try {
              localStorage.setItem('sbyi_coc_documents_v1', JSON.stringify(body.data));
            } catch (e) {}
            return body.data;
          }
        }
      } catch (err) {
        console.warn('Aiven getCocDocs failed, checking local:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const { data, error } = await client
          .from('sbyi_coc_docs')
          .select('*')
          .order('uploaded_at', { ascending: false })
          .limit(8);

        if (error) throw error;
        if (data && data.length > 0) {
          return data.map(row => this.mapDbToCocDoc(row));
        }
      } catch (err) {
        console.warn('Supabase getCocDocs failed, reading local:', err.message);
      }
    }

    // Fallback to localStorage or default seed
    try {
      const stored = localStorage.getItem('sbyi_coc_documents_v1');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not read COC docs from localStorage', e);
    }
    return window.DEFAULT_SBYI_COC_DOCS || [];
  }

  /**
   * Save SBYI COC Documents list (Enforcing 8 maximum PDF files)
   */
  async saveCocDocs(docs) {
    const clamped = (docs || [])
      .filter(d => d.type === 'application/pdf' || (d.name && d.name.toLowerCase().endsWith('.pdf')))
      .slice(0, 8);

    if (this.isAivenActive()) {
      try {
        for (const doc of clamped) {
          await fetch(this.getApiUrl('/api/coc-docs'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(doc)
          });
        }
      } catch (err) {
        console.warn('Aiven saveCocDocs note:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const dbRows = clamped.map(d => this.mapCocDocToDb(d));
        
        // Clear old and insert new
        await client.from('sbyi_coc_docs').delete().neq('id', '___none___');
        if (dbRows.length > 0) {
          const { error } = await client.from('sbyi_coc_docs').insert(dbRows);
          if (error) throw error;
        }
      } catch (err) {
        console.warn('Supabase saveCocDocs failed, saving locally:', err.message);
      }
    }

    try {
      localStorage.setItem('sbyi_coc_documents_v1', JSON.stringify(clamped));
    } catch (e) {
      console.warn('Could not write COC docs to localStorage', e);
    }

    // Auto-sync AI Knowledge Base
    if (window.sbyimKnowledgeBase) {
      window.sbyimKnowledgeBase.syncKnowledgeBase().then(() => {
        if (window.sbyimAIUI) window.sbyimAIUI.updateKnowledgeStatusBadge();
      }).catch(() => {});
    }

    return clamped;
  }

  /**
   * Delete a single SBYI COC document by ID
   */
  async deleteCocDoc(id) {
    if (this.isAivenActive()) {
      try {
        await fetch(this.getApiUrl('/api/coc-docs/' + encodeURIComponent(id)), { method: 'DELETE' });
      } catch (err) {
        console.warn('Aiven deleteCocDoc note:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        await client.from('sbyi_coc_docs').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteCocDoc failed:', err.message);
      }
    }

    const docs = await this.getCocDocs();
    const filtered = docs.filter(d => d.id !== id);
    return await this.saveCocDocs(filtered);
  }

  // ==========================================================================
  // AI DOCUMENTS REPOSITORY (DOC, DOCX, or PDF Files Only)
  // ==========================================================================

  /**
   * Get all stored AI Knowledge Base Documents (DOC, DOCX, or PDF)
   */
  async getAiDocs() {
    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/ai-docs'), { cache: 'no-store' });
        if (res.ok) {
          const body = await res.json();
          if (body.success && Array.isArray(body.data) && body.data.length > 0) {
            try {
              localStorage.setItem('ai_documents_v2', JSON.stringify(body.data));
              localStorage.removeItem('ai_documents_v1');
            } catch (e) {}
            return body.data;
          }
        }
      } catch (err) {
        console.warn('Aiven getAiDocs failed, checking local:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const { data, error } = await client
          .from('ai_documents')
          .select('*')
          .order('uploaded_at', { ascending: false });

        if (error) throw error;
        if (data && data.length > 0) {
          const docs = data.map(row => this.mapDbToAiDoc(row));
          try {
            localStorage.setItem('ai_documents_v2', JSON.stringify(docs));
            localStorage.removeItem('ai_documents_v1');
          } catch (e) {}
          return docs;
        }
      } catch (err) {
        console.warn('Supabase getAiDocs failed, reading local:', err.message);
      }
    }

    // Fallback to localStorage or default seed
    try {
      const stored = localStorage.getItem('ai_documents_v2') || localStorage.getItem('ai_documents_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read AI docs from localStorage', e);
    }
    
    const defaults = window.DEFAULT_AI_DOCS || [];
    try {
      localStorage.setItem('ai_documents_v2', JSON.stringify(defaults));
      localStorage.removeItem('ai_documents_v1');
    } catch (e) {}
    return defaults;
  }

  /**
   * Save AI Documents list (Enforcing DOC, DOCX, or PDF files)
   */
  async saveAiDocs(docs) {
    const validDocs = (docs || []).filter(d => {
      const name = (d.name || '').toLowerCase();
      const type = (d.type || '').toLowerCase();
      return name.endsWith('.pdf') || name.endsWith('.docx') || name.endsWith('.doc') ||
             type.includes('pdf') || type.includes('wordprocessingml') || type.includes('msword');
    });

    if (this.isAivenActive()) {
      try {
        for (const doc of validDocs) {
          await fetch(this.getApiUrl('/api/ai-docs'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(doc)
          });
        }
      } catch (err) {
        console.warn('Aiven saveAiDocs note:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const dbRows = validDocs.map(d => this.mapAiDocToDb(d));
        
        // Clear old and insert new
        await client.from('ai_documents').delete().neq('id', '___none___');
        if (dbRows.length > 0) {
          const { error } = await client.from('ai_documents').insert(dbRows);
          if (error) throw error;
        }
      } catch (err) {
        console.warn('Supabase saveAiDocs failed, saving locally:', err.message);
      }
    }

    try {
      localStorage.setItem('ai_documents_v2', JSON.stringify(validDocs));
      localStorage.removeItem('ai_documents_v1');
    } catch (e) {
      console.warn('Could not write AI docs to localStorage', e);
    }

    // Auto-sync AI Knowledge Base
    if (window.sbyimKnowledgeBase) {
      window.sbyimKnowledgeBase.syncKnowledgeBase().then(() => {
        if (window.sbyimAIUI) window.sbyimAIUI.updateKnowledgeStatusBadge();
      }).catch(() => {});
    }

    return validDocs;
  }

  /**
   * Delete a single AI document by ID
   */
  async deleteAiDoc(id) {
    if (this.isAivenActive()) {
      try {
        await fetch(this.getApiUrl('/api/ai-docs/' + encodeURIComponent(id)), { method: 'DELETE' });
      } catch (err) {
        console.warn('Aiven deleteAiDoc note:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        await client.from('ai_documents').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteAiDoc failed:', err.message);
      }
    }

    const docs = await this.getAiDocs();
    const filtered = docs.filter(d => d.id !== id);
    return await this.saveAiDocs(filtered);
  }

  // ==========================================================================
  // CUSTOM NOC TYPES (Aiven, Supabase & Local)
  // ==========================================================================

  /**
   * Get all custom NOC types
   */
  async getCustomTypes() {
    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/custom-types'), { cache: 'no-store' });
        if (res.ok) {
          const body = await res.json();
          if (body.success && Array.isArray(body.data) && body.data.length > 0) {
            try {
              localStorage.setItem('noc_custom_types', JSON.stringify(body.data));
            } catch (e) {}
            return body.data;
          }
        }
      } catch (err) {
        console.warn('Aiven getCustomTypes failed:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const { data, error } = await client
          .from('noc_custom_types')
          .select('name')
          .order('name', { ascending: true });

        if (error) throw error;
        if (data && data.length > 0) {
          return data.map(r => r.name);
        }
      } catch (err) {
        console.warn('Supabase getCustomTypes failed, reading local:', err.message);
      }
    }

    try {
      const stored = localStorage.getItem('noc_custom_types');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Could not read custom types from localStorage', e);
    }
    return window.DEFAULT_CUSTOM_TYPES || [];
  }

  /**
   * Save a new custom NOC type
   */
  async saveCustomType(typeName) {
    if (!typeName) return;
    const trimmed = String(typeName).trim();
    if (!trimmed) return;

    if (this.isAivenActive()) {
      try {
        await fetch(this.getApiUrl('/api/custom-types'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed })
        });
      } catch (err) {
        console.warn('Aiven custom type insert note:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        await client
          .from('noc_custom_types')
          .insert({ name: trimmed })
          .select();
      } catch (err) {
        console.log('Supabase custom type insert note:', err.message);
      }
    }

    // Save in local storage
    try {
      let customTypes = await this.getCustomTypes();
      if (!customTypes.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
        customTypes.push(trimmed);
        localStorage.setItem('noc_custom_types', JSON.stringify(customTypes));
      }
    } catch (e) {
      console.warn('Could not save custom type to localStorage', e);
    }
  }

  /**
   * Get all custom Contractors / Companies
   */
  async getCustomContractors() {
    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/custom-contractors'), { cache: 'no-store' });
        if (res.ok) {
          const body = await res.json();
          if (body.success && Array.isArray(body.data) && body.data.length > 0) {
            try {
              localStorage.setItem('noc_custom_contractors', JSON.stringify(body.data));
            } catch (e) {}
            return body.data;
          }
        }
      } catch (err) {
        console.warn('Aiven getCustomContractors failed:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const { data, error } = await client
          .from('noc_custom_contractors')
          .select('name')
          .order('name', { ascending: true });

        if (error) throw error;
        if (data && data.length > 0) {
          return data.map(r => (r.name || '').trim().toUpperCase()).filter(Boolean);
        }
      } catch (err) {
        console.warn('Supabase getCustomContractors failed, reading local:', err.message);
      }
    }

    try {
      const stored = localStorage.getItem('noc_custom_contractors');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed.map(c => String(c).trim().toUpperCase()).filter(Boolean);
      }
    } catch (e) {
      console.warn('Could not read custom contractors from localStorage', e);
    }
    return [];
  }

  /**
   * Save a new custom Contractor / Company
   */
  async saveCustomContractor(contractorName) {
    if (!contractorName) return;
    const trimmed = String(contractorName).trim().toUpperCase();
    if (!trimmed) return;

    if (this.isAivenActive()) {
      try {
        await fetch(this.getApiUrl('/api/custom-contractors'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed })
        });
      } catch (err) {
        console.warn('Aiven custom contractor insert note:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        await client
          .from('noc_custom_contractors')
          .insert({ name: trimmed })
          .select();
      } catch (err) {
        console.log('Supabase custom contractor insert note:', err.message);
      }
    }

    // Save in local storage
    try {
      let customContractors = await this.getCustomContractors();
      if (!customContractors.some(t => t.toUpperCase() === trimmed.toUpperCase())) {
        customContractors.push(trimmed);
        localStorage.setItem('noc_custom_contractors', JSON.stringify(customContractors));
      }
    } catch (e) {
      console.warn('Could not save custom contractor to localStorage', e);
    }
  }

  /**
   * Update / Rename an existing Contractor / Company
   */
  async updateCustomContractor(oldName, newName) {
    if (!oldName || !newName) return;
    const oldTrimmed = String(oldName).trim().toUpperCase();
    const newTrimmed = String(newName).trim().toUpperCase();
    if (!oldTrimmed || !newTrimmed || oldTrimmed === newTrimmed) return;

    if (this.isAivenActive()) {
      try {
        await fetch(this.getApiUrl('/api/custom-contractors/' + encodeURIComponent(oldTrimmed)), { method: 'DELETE' });
        await fetch(this.getApiUrl('/api/custom-contractors'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newTrimmed })
        });
      } catch (err) {
        console.warn('Aiven contractor rename note:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        await client
          .from('noc_custom_contractors')
          .update({ name: newTrimmed })
          .eq('name', oldTrimmed);

        await client
          .from('noc_records')
          .update({ issued_to: newTrimmed })
          .eq('issued_to', oldTrimmed);
      } catch (err) {
        console.warn('Supabase contractor update note:', err.message);
      }
    }

    // Save rename map in localStorage so renames persist across reloads
    try {
      const storedRenames = localStorage.getItem('noc_contractor_renames');
      let renames = storedRenames ? JSON.parse(storedRenames) : {};
      renames[oldTrimmed] = newTrimmed;
      localStorage.setItem('noc_contractor_renames', JSON.stringify(renames));

      let customContractors = await this.getCustomContractors();
      const idx = customContractors.findIndex(c => c.toUpperCase() === oldTrimmed);
      if (idx !== -1) {
        customContractors[idx] = newTrimmed;
      } else if (!customContractors.some(c => c.toUpperCase() === newTrimmed)) {
        customContractors.push(newTrimmed);
      }
      localStorage.setItem('noc_custom_contractors', JSON.stringify(customContractors));
    } catch (e) {
      console.warn('Could not update contractor in localStorage', e);
    }
  }

  /**
   * Retrieve all saved contractor rename mappings (from Aiven, Supabase or localStorage)
   */
  async getContractorRenames() {
    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/settings/noc_contractor_renames'), { cache: 'no-store' });
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.data) return body.data;
        }
      } catch (err) {}
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const { data, error } = await client
          .from('noc_settings')
          .select('value')
          .eq('key', 'noc_contractor_renames')
          .maybeSingle();

        if (!error && data && data.value) {
          try {
            localStorage.setItem('noc_contractor_renames', JSON.stringify(data.value));
          } catch (e) {}
          return data.value;
        }
      } catch (err) {
        console.warn('Supabase getContractorRenames failed, reading local:', err.message);
      }
    }

    try {
      const stored = localStorage.getItem('noc_contractor_renames');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return {};
  }

  /**
   * Generic setting getter (Aiven + Supabase + localStorage fallback)
   */
  async getSetting(key, defaultValue = null) {
    if (!key) return defaultValue;

    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/settings/' + encodeURIComponent(key)), { cache: 'no-store' });
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.data !== null && body.data !== undefined) return body.data;
        }
      } catch (err) {}
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const { data, error } = await client
          .from('noc_settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();

        if (!error && data && data.value !== undefined) {
          return data.value;
        }
      } catch (e) {
        console.warn(`Supabase getSetting(${key}) failed:`, e.message);
      }
    }

    try {
      const stored = localStorage.getItem(`noc_setting_${key}`);
      if (stored !== null) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return defaultValue;
  }

  /**
   * Generic setting setter (Aiven + Supabase + localStorage)
   */
  async saveSetting(key, value) {
    if (!key) return;

    if (this.isAivenActive()) {
      try {
        await fetch(this.getApiUrl('/api/settings'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value })
        });
      } catch (err) {}
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        await client.from('noc_settings').upsert({
          key: key,
          value: value,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      } catch (e) {
        console.warn(`Supabase saveSetting(${key}) failed:`, e.message);
      }
    }

    try {
      localStorage.setItem(`noc_setting_${key}`, JSON.stringify(value));
    } catch (e) {}
  }

  // ==========================================================================
  // USER DATABASE MANAGEMENT (Aiven, Supabase & Local)
  // ==========================================================================

  /**
   * Default fallback system accounts
   */
  getDefaultUsers() {
    return [
      {
        username: 'ryan',
        password: 'spider06',
        role: 'developer',
        displayName: 'Ryan Ortiz (Developer)',
        email: ''
      },
      {
        username: 'SBYIM',
        password: 'NOC#2022#',
        role: 'admin',
        displayName: 'SBYI Management',
        email: ''
      },
      {
        username: 'security',
        password: 'sec@2024',
        role: 'security',
        displayName: 'SBYIM Security Officer',
        email: ''
      },
      {
        username: 'Employee01',
        password: '666666@',
        role: 'employee',
        displayName: 'Island Security',
        email: ''
      },
      {
        username: 'Employee02',
        password: '777777#',
        role: 'employee',
        displayName: 'Inspire Integrated',
        email: ''
      },
      {
        username: '1GDL',
        password: '55555',
        role: 'guest',
        displayName: 'Gulf Dunes Landscapping',
        email: ''
      }
    ];
  }

  /**
   * Get all user records from Aiven / Supabase / localStorage
   */
  async getUsers() {
    if (this.isAivenActive()) {
      try {
        const res = await fetch(this.getApiUrl('/api/users'), { cache: 'no-store' });
        if (res.ok) {
          const body = await res.json();
          if (body.success && Array.isArray(body.data) && body.data.length > 0) {
            try {
              localStorage.setItem('noc_users_v3', JSON.stringify(body.data));
            } catch (e) {}
            return body.data;
          }
        }
      } catch (err) {
        console.warn('Aiven getUsers failed:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const { data, error } = await client
          .from('noc_users')
          .select('*')
          .order('username', { ascending: true });

        if (error) throw error;
        if (data && data.length > 0) {
          const filteredData = data.filter(r => !['admin', 'developer', 'main', 'guest'].includes((r.username || '').toLowerCase()));
          const users = filteredData.map(r => this.mapDbToUser(r));
          try {
            localStorage.setItem('noc_users_v3', JSON.stringify(users));
            localStorage.removeItem('noc_users_v2');
            localStorage.removeItem('noc_users_v1');
          } catch (e) {}
          return users;
        }
      } catch (err) {
        console.warn('Supabase getUsers failed, reading local:', err.message);
      }
    }

    try {
      const stored = localStorage.getItem('noc_users_v3') || localStorage.getItem('noc_users_v2') || localStorage.getItem('noc_users_v1');
      if (stored) {
        let parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read users from localStorage', e);
    }

    return this.getDefaultUsers();
  }

  /**
   * Save (create or update) a user record in Aiven, Supabase & localStorage
   */
  async saveUser(userData, origUsername = null) {
    if (!userData || !userData.username || !userData.password) {
      throw new Error('Username and Password are required.');
    }

    const userObj = {
      username: String(userData.username).trim(),
      password: String(userData.password).trim(),
      role: ['admin', 'developer', 'security', 'employee', 'main', 'guest'].includes(userData.role) ? userData.role : 'guest',
      displayName: (userData.displayName || userData.username).trim(),
      email: (userData.email || '').trim()
    };

    const isRenaming = origUsername && String(origUsername).trim().toLowerCase() !== userObj.username.toLowerCase();

    if (this.isAivenActive()) {
      try {
        if (isRenaming) {
          await fetch(this.getApiUrl('/api/users/' + encodeURIComponent(origUsername)), { method: 'DELETE' });
        }
        await fetch(this.getApiUrl('/api/users'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userObj)
        });
      } catch (err) {
        console.warn('Aiven saveUser note:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        if (isRenaming) {
          await client
            .from('noc_users')
            .delete()
            .ilike('username', String(origUsername).trim());
        }
        const dbRow = this.mapUserToDb(userObj);
        const { error } = await client
          .from('noc_users')
          .upsert(dbRow, { onConflict: 'username' });
        if (error) throw error;
      } catch (err) {
        console.warn('Supabase saveUser failed, saving locally:', err.message);
      }
    }

    const users = await this.getUsers();
    let targetIdx = -1;
    if (isRenaming) {
      targetIdx = users.findIndex(u => u.username.toLowerCase() === String(origUsername).trim().toLowerCase());
    } else {
      targetIdx = users.findIndex(u => u.username.toLowerCase() === userObj.username.toLowerCase());
    }

    if (targetIdx >= 0) {
      users[targetIdx] = userObj;
    } else {
      users.push(userObj);
    }

    try {
      localStorage.setItem('noc_users_v3', JSON.stringify(users));
    } catch (e) {}

    // Refresh auth user cache
    if (window.nocAuth && window.nocAuth.refreshUsers) {
      await window.nocAuth.refreshUsers();
    }

    return userObj;
  }

  /**
   * Delete a user by username
   */
  async deleteUser(username) {
    if (!username) return false;
    const cleanUsername = String(username).trim();

    if (cleanUsername.toLowerCase() === 'ryan') {
      throw new Error('Cannot delete the primary Developer account.');
    }

    if (this.isAivenActive()) {
      try {
        await fetch(this.getApiUrl('/api/users/' + encodeURIComponent(cleanUsername)), { method: 'DELETE' });
      } catch (err) {
        console.warn('Aiven deleteUser note:', err.message);
      }
    }

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        await client
          .from('noc_users')
          .delete()
          .ilike('username', cleanUsername);
      } catch (err) {
        console.warn('Supabase deleteUser failed:', err.message);
      }
    }

    const users = await this.getUsers();
    const filtered = users.filter(u => u.username.toLowerCase() !== cleanUsername.toLowerCase());
    try {
      localStorage.setItem('noc_users_v3', JSON.stringify(filtered));
    } catch (e) {}

    if (window.nocAuth && window.nocAuth.refreshUsers) {
      await window.nocAuth.refreshUsers();
    }

    return true;
  }


  // ==========================================================================
  // 1-CLICK LOCAL TO SUPABASE SYNCHRONIZATION
  // ==========================================================================

  /**
   * Push all current local data directly to Supabase
   */
  async syncLocalToSupabase(onProgress = null) {
    if (!this.isSupabaseActive()) {
      throw new Error('Supabase client is not connected. Please configure your Project URL & Anon Key first.');
    }

    const client = this.getSupabaseClient();
    const localRecords = await this._localGetAll();
    const localReqDocs = await this.getRequirementsDocs();
    const localCocDocs = await this.getCocDocs();
    const localAiDocs = await this.getAiDocs();
    const localTypes = await this.getCustomTypes();
    const localContractors = await this.getCustomContractors();
    const localUsers = await this.getUsers();
    const localRenames = await this.getContractorRenames();

    const stats = {
      recordsSynced: 0,
      reqDocsSynced: 0,
      cocDocsSynced: 0,
      aiDocsSynced: 0,
      typesSynced: 0,
      contractorsSynced: 0,
      usersSynced: 0,
      settingsSynced: 0
    };

    // 1. Sync NOC Records in micro-batches of 5 with automatic single-row fallback
    if (localRecords && localRecords.length > 0) {
      const dbRows = localRecords.map(r => this.mapRecordToDb(r));
      const BATCH_SIZE = 5;
      for (let i = 0; i < dbRows.length; i += BATCH_SIZE) {
        const batch = dbRows.slice(i, i + BATCH_SIZE);
        try {
          const { error: recError } = await client
            .from('noc_records')
            .upsert(batch, { onConflict: 'id' });

          if (recError) throw recError;
          stats.recordsSynced += batch.length;
        } catch (batchErr) {
          console.warn(`Batch (${i + 1}-${i + batch.length}) timeout/error, syncing row-by-row...`, batchErr.message);
          for (let j = 0; j < batch.length; j++) {
            const singleRow = batch[j];
            try {
              const { error: singleError } = await client
                .from('noc_records')
                .upsert(singleRow, { onConflict: 'id' });
              if (singleError) throw singleError;
              stats.recordsSynced++;
            } catch (rowErr) {
              console.warn(`Row ${singleRow.noc_number || (i + j + 1)} insert note:`, rowErr.message);
              // Retry once
              try {
                await client.from('noc_records').upsert(singleRow, { onConflict: 'id' });
                stats.recordsSynced++;
              } catch (retryErr) {
                console.error(`Final failed row ${singleRow.noc_number}:`, retryErr.message);
              }
            }
          }
        }

        if (typeof onProgress === 'function') {
          onProgress({ stage: 'records', current: stats.recordsSynced, total: dbRows.length });
        }
      }
    }

    // 2. Sync Requirement Documents (Item-by-item to prevent statement timeout on large data URLs)
    if (localReqDocs && localReqDocs.length > 0) {
      const reqRows = localReqDocs.map(d => this.mapReqDocToDb(d));
      for (const row of reqRows) {
        try {
          const { error: docError } = await client
            .from('noc_requirements_docs')
            .upsert(row, { onConflict: 'id' });
          if (!docError) stats.reqDocsSynced++;
        } catch (e) {
          console.warn('Sync req doc note:', e);
        }
      }
    }

    // 3. Sync SBYI COC Documents (Item-by-item)
    if (localCocDocs && localCocDocs.length > 0) {
      const cocRows = localCocDocs.map(d => this.mapCocDocToDb(d));
      for (const row of cocRows) {
        try {
          const { error: cocError } = await client
            .from('sbyi_coc_docs')
            .upsert(row, { onConflict: 'id' });
          if (!cocError) stats.cocDocsSynced++;
        } catch (e) {
          console.warn('Sync coc doc note:', e);
        }
      }
    }

    // 4. Sync AI Documents (Item-by-item)
    if (localAiDocs && localAiDocs.length > 0) {
      const aiRows = localAiDocs.map(d => this.mapAiDocToDb(d));
      for (const row of aiRows) {
        try {
          const { error: aiError } = await client
            .from('ai_documents')
            .upsert(row, { onConflict: 'id' });
          if (!aiError) stats.aiDocsSynced++;
        } catch (e) {
          console.warn('Sync ai doc note:', e);
        }
      }
    }

    // 5. Sync Custom Types
    if (localTypes && localTypes.length > 0) {
      const typeRows = localTypes.map(t => ({ name: t }));
      const { error: typeError } = await client
        .from('noc_custom_types')
        .upsert(typeRows, { onConflict: 'name' });

      if (!typeError) {
        stats.typesSynced = typeRows.length;
      }
    }

    // 6. Sync Custom Contractors
    if (localContractors && localContractors.length > 0) {
      const contractorRows = localContractors.map(c => ({ name: c }));
      const { error: contractorError } = await client
        .from('noc_custom_contractors')
        .upsert(contractorRows, { onConflict: 'name' });

      if (!contractorError) {
        stats.contractorsSynced = contractorRows.length;
      }
    }

    // 7. Sync Users
    if (localUsers && localUsers.length > 0) {
      const userRows = localUsers.map(u => this.mapUserToDb(u));
      const { error: userError } = await client
        .from('noc_users')
        .upsert(userRows, { onConflict: 'username' });

      if (!userError) {
        stats.usersSynced = userRows.length;
      }
    }

    // 8. Sync General Settings & Contractor Renames
    try {
      const settingsPayload = [
        { key: 'noc_contractor_renames', value: localRenames },
        { key: 'noc_custom_types', value: localTypes },
        { key: 'noc_custom_contractors', value: localContractors }
      ];
      const { error: settingsError } = await client
        .from('noc_settings')
        .upsert(settingsPayload, { onConflict: 'key' });

      if (!settingsError) {
        stats.settingsSynced = settingsPayload.length;
      }
    } catch (e) {
      console.warn('Sync settings note:', e);
    }

    return stats;
  }

  // ==========================================================================
  // UTILITIES & SUMMARY STATS
  // ==========================================================================

  /**
   * Compute NOC status based on expiration date.
   */
  getStatus(dateOfExpiration) {
    if (!dateOfExpiration) return 'active';
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expDate = new Date(dateOfExpiration);
    expDate.setHours(0, 0, 0, 0);

    const diffTime = expDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'expired';
    } else if (diffDays <= 30) {
      return 'expiring';
    } else {
      return 'active';
    }
  }

  /**
   * Get summary statistics for dashboard counters.
   */
  async getStatistics() {
    const records = await this.getAll();
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let totalDocs = 0;

    records.forEach((rec) => {
      const status = this.getStatus(rec.dateOfExpiration);
      if (status === 'active') active++;
      else if (status === 'expiring') expiring++;
      else if (status === 'expired') expired++;

      if (rec.documents && Array.isArray(rec.documents)) {
        totalDocs += rec.documents.length;
      }
    });

    return {
      total: records.length,
      active,
      expiring,
      expired,
      totalDocs
    };
  }

  /**
   * Export all database data to a JSON string.
   */
  async exportJSON() {
    const records = await this.getAll();
    return JSON.stringify(records, null, 2);
  }

  /**
   * Import data from JSON string.
   */
  async importJSON(jsonStr) {
    try {
      const records = JSON.parse(jsonStr);
      if (!Array.isArray(records)) {
        throw new Error('Invalid JSON format. Expected an array of NOC records.');
      }
      await this.bulkInsert(records);
    } catch (err) {
      throw new Error('Import failed: ' + err.message);
    }
  }

  // ==========================================================================
  // INTERNAL LOCAL INDEXEDDB DRIVER IMPLEMENTATION
  // ==========================================================================

  async _getLocalDB() {
    if (!this.localDb) {
      await this.initPromise;
    }
    return this.localDb;
  }

  async _localGetAll() {
    const db = await this._getLocalDB();
    if (!db) {
      return (window.INITIAL_NOC_SEED_DATA && window.INITIAL_NOC_SEED_DATA.length > 0)
        ? window.INITIAL_NOC_SEED_DATA
        : [];
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOCAL_STORE_NAME], 'readonly');
      const store = transaction.objectStore(LOCAL_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let records = request.result || [];

        // If local storage/IndexedDB has no valid records, load from window.INITIAL_NOC_SEED_DATA
        if (records.length === 0 && window.INITIAL_NOC_SEED_DATA && window.INITIAL_NOC_SEED_DATA.length > 0) {
          console.log(`IndexedDB store empty. Populating ${window.INITIAL_NOC_SEED_DATA.length} default NOC records...`);
          records = [...window.INITIAL_NOC_SEED_DATA];
          // Write to IndexedDB in background
          this._localBulkInsert(records).catch(() => {});
          try {
            localStorage.setItem('noc_records_v2', JSON.stringify(records));
            localStorage.removeItem('noc_records_v1');
          } catch (e) {}
        }

        records = records.map(r => {
          if (r && r.issuedTo) {
            r.issuedTo = String(r.issuedTo).trim().toUpperCase();
          }
          return r;
        });
        records.sort((a, b) => new Date(b.createdAt || b.dateOfIssuance) - new Date(a.createdAt || a.dateOfIssuance));
        resolve(records);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async _localGetById(id) {
    const db = await this._getLocalDB();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOCAL_STORE_NAME], 'readonly');
      const store = transaction.objectStore(LOCAL_STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const r = request.result || null;
        if (r && r.issuedTo) r.issuedTo = String(r.issuedTo).trim().toUpperCase();
        resolve(r);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async _localGetByNocNumber(nocNumber) {
    const db = await this._getLocalDB();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOCAL_STORE_NAME], 'readonly');
      const store = transaction.objectStore(LOCAL_STORE_NAME);
      const index = store.index('nocNumber');
      const request = index.get(nocNumber);

      request.onsuccess = () => {
        const r = request.result || null;
        if (r && r.issuedTo) r.issuedTo = String(r.issuedTo).trim().toUpperCase();
        resolve(r);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async _localAdd(record) {
    if (record && record.issuedTo) {
      record.issuedTo = String(record.issuedTo).trim().toUpperCase();
    }
    const db = await this._getLocalDB();
    if (!db) return record;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOCAL_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(LOCAL_STORE_NAME);
      const request = store.add(record);

      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(request.error);
    });
  }

  async _localPut(record) {
    if (record && record.issuedTo) {
      record.issuedTo = String(record.issuedTo).trim().toUpperCase();
    }
    const db = await this._getLocalDB();
    if (!db) return record;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOCAL_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(LOCAL_STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(request.error);
    });
  }

  async _localDelete(id) {
    const db = await this._getLocalDB();
    if (!db) return true;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOCAL_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(LOCAL_STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async _localBulkInsert(records) {
    const db = await this._getLocalDB();
    if (!db) return true;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOCAL_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(LOCAL_STORE_NAME);

      records.forEach((record) => {
        if (record && record.issuedTo) {
          record.issuedTo = String(record.issuedTo).trim().toUpperCase();
        }
        store.put(record);
      });

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async _localClearAll() {
    const db = await this._getLocalDB();
    if (!db) return true;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOCAL_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(LOCAL_STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async _localSaveDeleted(record) {
    if (!record || !record.id) return;
    const db = await this._getLocalDB();
    if (db && db.objectStoreNames && db.objectStoreNames.contains(LOCAL_DELETED_STORE_NAME)) {
      await new Promise((resolve) => {
        try {
          const transaction = db.transaction([LOCAL_DELETED_STORE_NAME], 'readwrite');
          const store = transaction.objectStore(LOCAL_DELETED_STORE_NAME);
          store.put(record);
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    }
    // Also backup in localStorage
    try {
      let list = JSON.parse(localStorage.getItem('noc_deleted_records_v1') || '[]');
      list = list.filter(r => r.id !== record.id);
      list.unshift(record);
      localStorage.setItem('noc_deleted_records_v1', JSON.stringify(list));
    } catch (e) {}
  }

  async _localGetDeleted() {
    const db = await this._getLocalDB();
    if (db && db.objectStoreNames && db.objectStoreNames.contains(LOCAL_DELETED_STORE_NAME)) {
      try {
        const records = await new Promise((resolve) => {
          const transaction = db.transaction([LOCAL_DELETED_STORE_NAME], 'readonly');
          const store = transaction.objectStore(LOCAL_DELETED_STORE_NAME);
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => resolve([]);
        });
        if (records && records.length > 0) {
          records.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
          return records;
        }
      } catch (e) {}
    }
    try {
      const list = JSON.parse(localStorage.getItem('noc_deleted_records_v1') || '[]');
      list.sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
      return list;
    } catch (e) {
      return [];
    }
  }

  async _localRemoveDeleted(id) {
    const db = await this._getLocalDB();
    if (db && db.objectStoreNames && db.objectStoreNames.contains(LOCAL_DELETED_STORE_NAME)) {
      try {
        await new Promise((resolve) => {
          const transaction = db.transaction([LOCAL_DELETED_STORE_NAME], 'readwrite');
          const store = transaction.objectStore(LOCAL_DELETED_STORE_NAME);
          store.delete(id);
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = () => resolve(false);
        });
      } catch (e) {}
    }
    try {
      let list = JSON.parse(localStorage.getItem('noc_deleted_records_v1') || '[]');
      list = list.filter(r => r.id !== id);
      localStorage.setItem('noc_deleted_records_v1', JSON.stringify(list));
    } catch (e) {}
  }

  async _localClearDeleted() {
    const db = await this._getLocalDB();
    if (db && db.objectStoreNames && db.objectStoreNames.contains(LOCAL_DELETED_STORE_NAME)) {
      try {
        await new Promise((resolve) => {
          const transaction = db.transaction([LOCAL_DELETED_STORE_NAME], 'readwrite');
          const store = transaction.objectStore(LOCAL_DELETED_STORE_NAME);
          store.clear();
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = () => resolve(false);
        });
      } catch (e) {}
    }
    try {
      localStorage.removeItem('noc_deleted_records_v1');
    } catch (e) {}
  }
}

// Global DB instance
window.nocDB = new NOCDatabase();
