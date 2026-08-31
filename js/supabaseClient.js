/**
 * NOC Portal - Supabase Client & Configuration Manager
 * Initializes the Supabase JS Client with localStorage persistence and live status checking.
 */

class SupabaseConfigManager {
  constructor() {
    this.STORAGE_KEY_URL = 'noc_supabase_url';
    this.STORAGE_KEY_KEY = 'noc_supabase_anon_key';
    
    // Default pre-configured Supabase Project URL & Anon Public API Key
    this.defaultUrl = 'https://xycrdbcaggdthcyngkyn.supabase.co';
    this.defaultAnonKey = 'sb_publishable_oq4jrLK3juO6RNSkniKJ9Q_9b08hvmc';
    
    this.client = null;
    this.isConnected = false;
    this.lastChecked = null;
    
    this.initClient();
  }

  /**
   * Get configured Supabase URL
   */
  getUrl() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_URL);
      if (stored && stored.trim()) {
        // Automatically migrate legacy project URLs to the new Supabase server location
        if (stored.includes('qstyziuwxklvcadqrho') || stored.includes('qstyziuwxklbvcadqrho')) {
          localStorage.setItem(this.STORAGE_KEY_URL, this.defaultUrl);
          return this.defaultUrl;
        }
        return stored.trim();
      }
    } catch (e) {
      console.warn('Could not read Supabase URL from localStorage', e);
    }
    return this.defaultUrl;
  }

  /**
   * Get configured Supabase Anon Key
   */
  getAnonKey() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_KEY);
      if (stored && stored.trim()) {
        // Automatically migrate legacy API keys to the new Supabase API key
        if (stored.includes('iqh_iXjgVJAqL6BtMJsm_g_Oe43JJFE')) {
          localStorage.setItem(this.STORAGE_KEY_KEY, this.defaultAnonKey);
          return this.defaultAnonKey;
        }
        return stored.trim();
      }
    } catch (e) {
      console.warn('Could not read Supabase Anon Key from localStorage', e);
    }
    return this.defaultAnonKey;
  }

  /**
   * Save new Supabase credentials and re-initialize client
   */
  saveCredentials(url, anonKey) {
    const trimmedUrl = (url || '').trim();
    const trimmedKey = (anonKey || '').trim();

    try {
      if (trimmedUrl) {
        localStorage.setItem(this.STORAGE_KEY_URL, trimmedUrl);
      } else {
        localStorage.removeItem(this.STORAGE_KEY_URL);
      }

      if (trimmedKey) {
        localStorage.setItem(this.STORAGE_KEY_KEY, trimmedKey);
      } else {
        localStorage.removeItem(this.STORAGE_KEY_KEY);
      }
    } catch (e) {
      console.error('Error saving Supabase credentials:', e);
    }

    this.initClient();
    this.triggerConfigChange();
  }

  /**
   * Clear Supabase credentials (revert to local mode)
   */
  clearCredentials() {
    try {
      localStorage.removeItem(this.STORAGE_KEY_URL);
      localStorage.removeItem(this.STORAGE_KEY_KEY);
    } catch (e) {
      console.error('Error clearing Supabase credentials:', e);
    }
    this.client = null;
    this.isConnected = false;
    this.triggerConfigChange();
  }

  /**
   * Initialize Supabase Client if credentials are valid and Supabase JS SDK is loaded
   */
  initClient() {
    const url = this.getUrl();
    const key = this.getAnonKey();

    if (url && key && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        this.client = window.supabase.createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true
          }
        });
        console.log('Supabase client initialized with URL:', url);
      } catch (err) {
        console.error('Failed to initialize Supabase client:', err);
        this.client = null;
      }
    } else {
      this.client = null;
    }
  }

  /**
   * Check if Supabase client is configured
   */
  isConfigured() {
    const url = this.getUrl();
    const key = this.getAnonKey();
    return Boolean(url && key && this.client);
  }

  /**
   * Get current Supabase client instance
   */
  getClient() {
    if (!this.client && this.isConfigured()) {
      this.initClient();
    }
    return this.client;
  }

  /**
   * Test connection to Supabase database (health check)
   */
  async testConnection() {
    const url = this.getUrl();
    const key = this.getAnonKey();

    if (!url || !key) {
      this.isConnected = false;
      return {
        success: false,
        message: 'Supabase URL or Anon Key is missing. Running in Local Storage mode.'
      };
    }

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      this.isConnected = false;
      return {
        success: false,
        message: 'Supabase JS SDK is not loaded. Please check your internet connection.'
      };
    }

    try {
      const testClient = window.supabase.createClient(url, key);
      // Query noc_records table (limit 1) to test table access and RLS
      const { data, error } = await testClient
        .from('noc_records')
        .select('id')
        .limit(1);

      if (error) {
        this.isConnected = false;
        console.warn('Supabase connection test failed:', error);
        return {
          success: false,
          error: error.message || 'Database query error',
          message: `Connection failed: ${error.message}. Make sure you executed the SQL Schema in Supabase SQL Editor.`
        };
      }

      this.isConnected = true;
      this.client = testClient;
      this.lastChecked = new Date();
      this.triggerConfigChange();

      return {
        success: true,
        message: 'Successfully connected to Supabase PostgreSQL database!'
      };
    } catch (err) {
      this.isConnected = false;
      return {
        success: false,
        error: err.message,
        message: `Connection error: ${err.message}`
      };
    }
  }

  /**
   * Dispatch custom event when configuration changes
   */
  triggerConfigChange() {
    window.dispatchEvent(new CustomEvent('noc:supabase-config-change', {
      detail: {
        isConfigured: this.isConfigured(),
        isConnected: this.isConnected,
        url: this.getUrl()
      }
    }));
  }
}

// Global Supabase Manager instance
window.supabaseManager = new SupabaseConfigManager();
