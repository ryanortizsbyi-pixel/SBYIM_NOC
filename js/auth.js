/**
 * NOC Portal - Role-Based Authentication (RBAC) Module
 * Handles user login states, Admin vs Guest permissions, session storage, and event dispatching.
 */

class AuthManager {
  constructor() {
    this.STORAGE_KEY = 'noc_portal_auth_user';
    this._cachedUsers = null;
    this.currentUser = this.loadUser();
    this.refreshUsers();
  }

  /**
   * Refresh in-memory users cache from database / local storage
   */
  async refreshUsers() {
    try {
      if (window.nocDB && window.nocDB.getUsers) {
        const users = await window.nocDB.getUsers();
        if (users && users.length > 0) {
          this._cachedUsers = {};
          for (const u of users) {
            this._cachedUsers[u.username.toLowerCase()] = u;
          }
        }
      }
    } catch (e) {
      console.warn('Could not refresh users in AuthManager', e);
    }
  }

  /**
   * System accounts map (reads from dynamic cache or fallback defaults)
   */
  get systemUsers() {
    if (this._cachedUsers && Object.keys(this._cachedUsers).length > 0) {
      return this._cachedUsers;
    }

    try {
      const stored = localStorage.getItem('noc_users_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = {};
          parsed.forEach(u => {
            map[u.username.toLowerCase()] = u;
          });
          this._cachedUsers = map;
          return map;
        }
      }
    } catch (e) {}

    return {
      ryan: {
        username: 'ryan',
        password: 'SBYIM@2026',
        role: 'developer',
        displayName: 'Ryan (Developer)',
        email: 'ryan@nocportal.gov'
      },
      admin: {
        username: 'admin',
        password: 'SBYIM@2026',
        role: 'admin',
        displayName: 'System Administrator',
        email: 'admin@nocportal.gov'
      },
      sbyim: {
        username: 'SBYIM',
        password: 'ManagementNOC',
        role: 'admin',
        displayName: 'SBYIM Management',
        email: 'sbyim@nocportal.gov'
      },
      developer: {
        username: 'developer',
        password: 'dev123',
        role: 'developer',
        displayName: 'Lead Developer (System Engineer)',
        email: 'developer@nocportal.gov'
      },
      security: {
        username: 'security',
        password: 'security123',
        role: 'security',
        displayName: 'Security Officer (Lookup & View)',
        email: 'security@nocportal.gov'
      },
      main: {
        username: 'main',
        password: 'main123',
        role: 'main',
        displayName: 'Main Control Officer (Lookup & View)',
        email: 'main@nocportal.gov'
      },
      guest: {
        username: 'guest',
        password: 'guest123',
        role: 'guest',
        displayName: 'Guest Officer / Viewer',
        email: 'guest@nocportal.gov'
      }
    };
  }

  /**
   * Load saved session from sessionStorage or persistent localStorage (if Remember Me was enabled)
   */
  loadUser() {
    try {
      const sessionSaved = sessionStorage.getItem(this.STORAGE_KEY);
      if (sessionSaved) {
        const parsed = JSON.parse(sessionSaved);
        if (parsed && parsed.username) {
          if (parsed.username.toLowerCase() === 'admin') {
            parsed.username = 'ryan';
            if (parsed.displayName === 'System Administrator' || parsed.displayName === 'Ryan (System Administrator)') parsed.displayName = 'Ryan (Developer)';
            parsed.role = 'developer';
          }
          if (parsed.username.toLowerCase() === 'security') {
            parsed.role = 'security';
          } else if (parsed.username.toLowerCase() === 'sbyim') {
            parsed.role = 'admin';
          } else if (parsed.username.toLowerCase() === 'ryan') {
            parsed.role = 'developer';
            if (parsed.displayName === 'Ryan (System Administrator)' || parsed.displayName === 'System Administrator') {
              parsed.displayName = 'Ryan (Developer)';
            }
          }
          sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
      const localSaved = localStorage.getItem(this.STORAGE_KEY);
      if (localSaved) {
        const parsed = JSON.parse(localSaved);
        if (parsed && parsed.username) {
          if (parsed.username.toLowerCase() === 'admin') {
            parsed.username = 'ryan';
            if (parsed.displayName === 'System Administrator' || parsed.displayName === 'Ryan (System Administrator)') parsed.displayName = 'Ryan (Developer)';
            parsed.role = 'developer';
          }
          if (parsed.username.toLowerCase() === 'security') {
            parsed.role = 'security';
          } else if (parsed.username.toLowerCase() === 'sbyim') {
            parsed.role = 'admin';
          } else if (parsed.username.toLowerCase() === 'ryan') {
            parsed.role = 'developer';
            if (parsed.displayName === 'Ryan (System Administrator)' || parsed.displayName === 'System Administrator') {
              parsed.displayName = 'Ryan (Developer)';
            }
          }
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(parsed));
        }
        if (parsed && parsed.rememberMe) {
          sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(parsed));
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read auth from storage', e);
    }
    // Return null so user starts unauthenticated and must click Sign In
    return null;
  }

  /**
   * Check login credentials against registered user accounts
   */
  login(username, password, rememberMe = false) {
    const userKey = String(username || '').trim().toLowerCase();
    const usersMap = this.systemUsers;
    const user = usersMap[userKey];

    if (user && user.password === password) {
      let resolvedRole = user.role || 'guest';
      let resolvedDisplayName = user.displayName || user.display_name || user.username;
      if (userKey === 'sbyim') resolvedRole = 'admin';
      if (userKey === 'security') resolvedRole = 'security';
      if (userKey === 'ryan') {
        resolvedRole = 'developer';
        if (resolvedDisplayName === 'Ryan (System Administrator)' || resolvedDisplayName === 'System Administrator') {
          resolvedDisplayName = 'Ryan (Developer)';
        }
      }
      if (userKey === 'admin') resolvedRole = 'admin';

      this.currentUser = {
        username: user.username,
        role: resolvedRole,
        displayName: resolvedDisplayName,
        email: user.email || '',
        loggedInAt: new Date().toISOString(),
        rememberMe: !!rememberMe
      };
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.currentUser));
      if (rememberMe) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.currentUser));
        localStorage.setItem('noc_remembered_username', user.username);
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem('noc_remembered_username');
      }
      this.triggerAuthChange();
      return { success: true, user: this.currentUser };
    }

    return {
      success: false,
      message: 'Invalid username or password. Please try again.'
    };
  }

  /**
   * Quick role switcher / direct login
   */
  switchRole(role) {
    const u = this.systemUsers[role.toLowerCase()];
    if (u) {
      return this.login(u.username, u.password);
    }
    return { success: false, message: 'Invalid role specified.' };
  }

  /**
   * Logout current user and reset back to unauthenticated state
   */
  logout() {
    this.currentUser = null;
    sessionStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem('noc_remembered_username');
    this.triggerAuthChange();
  }

  /**
   * Check if user is currently authenticated
   */
  isLoggedIn() {
    return this.currentUser !== null;
  }

  /**
   * Get current authenticated user
   */
  getUser() {
    return this.currentUser || { username: 'unauthenticated', role: 'none', displayName: 'Please Sign In' };
  }

  /**
   * Role check helpers
   */
  isAdmin() {
    return Boolean(this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'developer'));
  }

  isDeveloper() {
    return Boolean(this.currentUser && this.currentUser.role === 'developer');
  }

  canViewClient() {
    return false; // Apply same table view (hide separate Client column, show Description of Work)
  }

  canViewNocType() {
    return false; // Apply same table view (hide separate NOC Type column)
  }

  isSecurity() {
    return this.currentUser && this.currentUser.role === 'security';
  }

  isEmployee() {
    return Boolean(this.currentUser && (this.currentUser.role === 'employee' || this.currentUser.role === 'main'));
  }

  isMain() {
    return this.isEmployee();
  }

  isGuest() {
    return this.currentUser && this.currentUser.role === 'guest';
  }

  isLookupOnly() {
    return Boolean(this.currentUser && (this.currentUser.role === 'guest' || this.currentUser.role === 'security' || this.currentUser.role === 'employee' || this.currentUser.role === 'main'));
  }

  isAdminUser() {
    return Boolean(
      this.currentUser &&
      (this.currentUser.role === 'admin' ||
       this.currentUser.role === 'developer' ||
       this.currentUser.username?.toLowerCase() === 'ryan' ||
       this.currentUser.username?.toLowerCase() === 'admin')
    );
  }

  isSBYIM() {
    return Boolean(
      this.currentUser &&
      this.currentUser.username &&
      this.currentUser.username.toLowerCase() === 'sbyim'
    );
  }

  canManageDatabase() {
    return this.isAdmin(); // Allowed for 'ryan', 'admin', 'SBYIM', and 'developer'
  }

  canShowDatabaseBadge() {
    if (this.isSBYIM()) return false;
    return Boolean(
      this.currentUser &&
      (this.currentUser.role === 'admin' ||
       this.currentUser.username?.toLowerCase() === 'ryan' ||
       this.currentUser.username?.toLowerCase() === 'admin' ||
       this.currentUser.role === 'developer')
    );
  }

  canExportJSON() {
    if (this.isSBYIM()) return false;
    return Boolean(
      this.currentUser &&
      (this.currentUser.role === 'admin' ||
       this.currentUser.username?.toLowerCase() === 'ryan' ||
       this.currentUser.username?.toLowerCase() === 'admin' ||
       this.currentUser.role === 'developer')
    );
  }

  canManageAiDocs() {
    if (this.isSBYIM()) return false;
    return Boolean(this.isAdminUser() || this.isDeveloper() || this.isAdmin()); // Admin and Developer can see and manage AI Documents
  }

  canManageUsers() {
    if (this.isSBYIM()) return false;
    return Boolean(this.isAdminUser() || this.isDeveloper() || this.isAdmin()); // Admin and Developer can see and manage User Database
  }

  canAccessAiAssistant() {
    return this.isDeveloper(); // Strictly Developer access role only
  }

  canViewCompanyCode() {
    if (this.isSBYIM()) return false;
    return Boolean(
      this.currentUser &&
      (this.currentUser.role === 'developer' ||
       this.currentUser.username?.toLowerCase() === 'ryan' ||
       this.currentUser.role === 'admin')
    );
  }

  /**
   * Capability permission checks
   */
  canCreate() {
    return this.isAdmin();
  }

  canEdit() {
    return this.isAdmin();
  }

  canDelete() {
    return this.isAdmin();
  }

  canUpload() {
    return this.isAdmin();
  }

  canDownload() {
    return this.isAdmin(); // Only administrators can download NOC documents
  }

  canView() {
    return this.isAdmin(); // Only administrators can view NOC documents
  }

  canViewDocuments() {
    return this.isAdmin(); // Only administrators can view documents and actions
  }

  /**
   * Dispatch auth state change event to update UI elements
   */
  triggerAuthChange() {
    window.dispatchEvent(new CustomEvent('noc:auth-change', {
      detail: { user: this.currentUser }
    }));
  }
}

// Global Auth instance
window.nocAuth = new AuthManager();
