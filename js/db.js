/**
 * NOC Portal - IndexedDB Storage Engine
 * Handles persistent client-side database storage for NOC records and document binaries.
 */

const DB_NAME = 'NOC_Portal_DB';
const DB_VERSION = 1;
const STORE_NAME = 'noc_records';

class NOCDatabase {
  constructor() {
    this.db = null;
    this.initPromise = this.init();
  }

  /**
   * Initializes the IndexedDB instance and creates necessary object stores and indexes.
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('nocNumber', 'nocNumber', { unique: true });
          store.createIndex('nocType', 'nocType', { unique: false });
          store.createIndex('client', 'client', { unique: false });
          store.createIndex('issuedTo', 'issuedTo', { unique: false });
          store.createIndex('dateOfExpiration', 'dateOfExpiration', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Ensure database connection is ready before executing queries.
   */
  async getDB() {
    if (!this.db) {
      await this.initPromise;
    }
    return this.db;
  }

  /**
   * Retrieve all NOC records.
   */
  async getAll() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result || [];
        // Sort descending by dateOfIssuance or createdAt
        records.sort((a, b) => new Date(b.createdAt || b.dateOfIssuance) - new Date(a.createdAt || a.dateOfIssuance));
        resolve(records);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieve a single NOC record by its unique ID.
   */
  async getById(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Find an NOC record by its NOC Number.
   */
  async getByNocNumber(nocNumber) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('nocNumber');
      const request = index.get(nocNumber);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Add a new NOC record into the database.
   */
  async add(record) {
    const db = await this.getDB();
    
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

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(newRecord);

      request.onsuccess = () => resolve(newRecord);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update an existing NOC record.
   */
  async update(id, updatedFields) {
    const db = await this.getDB();
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Record with ID ${id} not found.`);
    }

    // Check if new NOC Number conflicts with another record
    if (updatedFields.nocNumber && updatedFields.nocNumber !== existing.nocNumber) {
      const duplicate = await this.getByNocNumber(updatedFields.nocNumber);
      if (duplicate && duplicate.id !== id) {
        throw new Error(`NOC Number "${updatedFields.nocNumber}" is already in use by another record.`);
      }
    }

    const updatedRecord = {
      ...existing,
      ...updatedFields,
      id: id, // preserve key
      updatedAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(updatedRecord);

      request.onsuccess = () => resolve(updatedRecord);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete an NOC record.
   */
  async delete(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Bulk insert records (used for seeding initial demo data).
   */
  async bulkInsert(records) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      records.forEach((record) => {
        store.put(record);
      });

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Clear all records in the database.
   */
  async clearAll() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

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

  /**
   * Get all stored NOC Requirements Documents (Up to 5)
   */
  async getRequirementsDocs() {
    try {
      const stored = localStorage.getItem('noc_requirements_documents_v2');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not read requirements from storage', e);
    }
    return window.DEFAULT_NOC_REQUIREMENTS_DOCS || [];
  }

  /**
   * Save NOC Requirements Documents list (Enforcing 5 maximum)
   */
  async saveRequirementsDocs(docs) {
    try {
      const clamped = (docs || []).slice(0, 5);
      localStorage.setItem('noc_requirements_documents_v2', JSON.stringify(clamped));
      return clamped;
    } catch (e) {
      console.error('Failed to save requirements documents:', e);
      throw e;
    }
  }

  /**
   * Delete a single requirements document by ID
   */
  async deleteRequirementsDoc(id) {
    const docs = await this.getRequirementsDocs();
    const filtered = docs.filter(d => d.id !== id);
    return await this.saveRequirementsDocs(filtered);
  }
}

// Global DB instance
window.nocDB = new NOCDatabase();
