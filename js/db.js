/**
 * NOC Portal - Unified Supabase / PostgreSQL Database Storage Engine
 * Handles PostgreSQL queries via Supabase JS SDK with resilient local offline fallback.
 */

const LOCAL_DB_NAME = 'NOC_Portal_DB';
const LOCAL_DB_VERSION = 1;
const LOCAL_STORE_NAME = 'noc_records';

class NOCDatabase {
  constructor() {
    this.localDb = null;
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
   * Main database initialization
   */
  async init() {
    await this.initLocalDB();

    // Check if Supabase client is configured and test connection
    if (window.supabaseManager && window.supabaseManager.isConfigured()) {
      try {
        const status = await window.supabaseManager.testConnection();
        if (status.success) {
          console.log('NOCDatabase: Connected to Supabase PostgreSQL database.');
        } else {
          console.warn('NOCDatabase: Supabase credentials found but connection test failed. Using local storage.', status.message);
        }
      } catch (e) {
        console.warn('NOCDatabase: Supabase test connection error:', e);
      }
    } else {
      console.log('NOCDatabase: Supabase not configured yet. Operating in Local Persistent mode.');
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
      issued_to: (rec.issuedTo || '').trim(),
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
      issuedTo: row.issued_to || row.issuedTo || '',
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

  // ==========================================================================
  // CORE NOC RECORD OPERATIONS
  // ==========================================================================

  /**
   * Retrieve all NOC records.
   */
  async getAll() {
    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const { data, error } = await client
          .from('noc_records')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(row => this.mapDbToRecord(row));
      } catch (err) {
        console.warn('Supabase getAll failed, falling back to local DB:', err.message);
      }
    }

    // Local IndexedDB Fallback
    return this._localGetAll();
  }

  /**
   * Retrieve a single NOC record by ID.
   */
  async getById(id) {
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
   * Delete an NOC record.
   */
  async delete(id) {
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
   * Bulk insert/upsert records.
   */
  async bulkInsert(records) {
    if (!records || records.length === 0) return true;

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        const dbRows = records.map(r => this.mapRecordToDb(r));
        const { error } = await client
          .from('noc_records')
          .upsert(dbRows, { onConflict: 'id' });

        if (error) throw error;
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
    return clamped;
  }

  /**
   * Delete a single requirements document by ID
   */
  async deleteRequirementsDoc(id) {
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
    return clamped;
  }

  /**
   * Delete a single SBYI COC document by ID
   */
  async deleteCocDoc(id) {
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
  // CUSTOM NOC TYPES (Supabase & Local)
  // ==========================================================================

  /**
   * Get all custom NOC types
   */
  async getCustomTypes() {
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
    return [];
  }

  /**
   * Save a new custom NOC type
   */
  async saveCustomType(typeName) {
    if (!typeName) return;
    const trimmed = String(typeName).trim();
    if (!trimmed) return;

    if (this.isSupabaseActive()) {
      try {
        const client = this.getSupabaseClient();
        await client
          .from('noc_custom_types')
          .insert({ name: trimmed })
          .select();
      } catch (err) {
        // Ignore duplicate error in Supabase
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

  // ==========================================================================
  // 1-CLICK LOCAL TO SUPABASE SYNCHRONIZATION
  // ==========================================================================

  /**
   * Push all current local data (NOC records, Requirements, Types) directly to Supabase
   */
  async syncLocalToSupabase() {
    if (!this.isSupabaseActive()) {
      throw new Error('Supabase client is not connected. Please configure your Project URL & Anon Key first.');
    }

    const client = this.getSupabaseClient();
    const localRecords = await this._localGetAll();
    const localReqDocs = await this.getRequirementsDocs();
    const localCocDocs = await this.getCocDocs();
    const localTypes = await this.getCustomTypes();

    const stats = {
      recordsSynced: 0,
      reqDocsSynced: 0,
      cocDocsSynced: 0,
      typesSynced: 0
    };

    // 1. Sync NOC Records
    if (localRecords && localRecords.length > 0) {
      const dbRows = localRecords.map(r => this.mapRecordToDb(r));
      const { error: recError } = await client
        .from('noc_records')
        .upsert(dbRows, { onConflict: 'id' });

      if (recError) throw new Error(`Failed syncing NOC records: ${recError.message}`);
      stats.recordsSynced = dbRows.length;
    }

    // 2. Sync Requirement Documents
    if (localReqDocs && localReqDocs.length > 0) {
      const reqRows = localReqDocs.map(d => this.mapReqDocToDb(d));
      const { error: docError } = await client
        .from('noc_requirements_docs')
        .upsert(reqRows, { onConflict: 'id' });

      if (docError) throw new Error(`Failed syncing requirements documents: ${docError.message}`);
      stats.reqDocsSynced = reqRows.length;
    }

    // 3. Sync SBYI COC Documents
    if (localCocDocs && localCocDocs.length > 0) {
      const cocRows = localCocDocs.map(d => this.mapCocDocToDb(d));
      const { error: cocError } = await client
        .from('sbyi_coc_docs')
        .upsert(cocRows, { onConflict: 'id' });

      if (cocError) throw new Error(`Failed syncing SBYI COC documents: ${cocError.message}`);
      stats.cocDocsSynced = cocRows.length;
    }

    // 4. Sync Custom Types
    if (localTypes && localTypes.length > 0) {
      const typeRows = localTypes.map(t => ({ name: t }));
      const { error: typeError } = await client
        .from('noc_custom_types')
        .upsert(typeRows, { onConflict: 'name' });

      if (!typeError) {
        stats.typesSynced = typeRows.length;
      }
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
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([LOCAL_STORE_NAME], 'readonly');
      const store = transaction.objectStore(LOCAL_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result || [];
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

      request.onsuccess = () => resolve(request.result || null);
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

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async _localAdd(record) {
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
}

// Global DB instance
window.nocDB = new NOCDatabase();
