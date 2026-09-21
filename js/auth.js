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
   * Built-in default user accounts
   */
  get defaultAccounts() {
    return {
      ryan: {
        username: 'ryan',
        password: 'spider06',
        role: 'developer',
        displayName: 'Ryan Ortiz (Developer)',
        email: ''
      },
      sbyim: {
        username: 'SBYIM',
        password: 'NOC#2022#',
        role: 'admin',
        displayName: 'SBYI Management',
        email: ''
      },
      security: {
        username: 'security',
        password: 'sec@2024',
        role: 'security',
        displayName: 'SBYIM Security Officer',
        email: ''
      },
      employee01: {
        username: 'Employee01',
        password: '666666@',
        role: 'employee',
        displayName: 'Island Security',
        email: ''
      },
      employee02: {
        username: 'Employee02',
        password: '777777#',
        role: 'employee',
        displayName: 'Inspire Integrated',
        email: ''
      },
      '1gdl': {
        username: '1GDL',
        password: '55555',
        role: 'guest',
        displayName: 'Gulf Dunes Landscapping',
        email: ''
      }
    };
  }

  /**
   * System accounts map (reads from dynamic cache merged with default accounts)
   */
  get systemUsers() {
    const combined = Object.assign({}, this.defaultAccounts);

    try {
      const stored = localStorage.getItem('noc_users_v3') || localStorage.getItem('noc_users_v2') || localStorage.getItem('noc_users_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach(u => {
            if (u && u.username) {
              combined[u.username.toLowerCase()] = u;
            }
          });
        }
      }
    } catch (e) {}

    if (this._cachedUsers && Object.keys(this._cachedUsers).length > 0) {
      Object.assign(combined, this._cachedUsers);
    }

    return combined;
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
          const uKey = parsed.username.toLowerCase();
          // If session contains old deprecated default username, purge session
          if (['admin', 'guest', 'main'].includes(uKey)) {
            sessionStorage.removeItem(this.STORAGE_KEY);
            return null;
          }
          if (uKey === 'security') {
            parsed.role = 'security';
            if (!parsed.displayName || parsed.displayName === 'Security Officer') parsed.displayName = 'SBYIM Security Officer';
          } else if (uKey === 'sbyim') {
            parsed.role = 'admin';
            if (!parsed.displayName) parsed.displayName = 'SBYI Management';
          } else if (uKey === 'ryan') {
            parsed.role = 'developer';
            if (parsed.displayName === 'Ryan (System Administrator)' || parsed.displayName === 'System Administrator' || parsed.displayName === 'Ryan (Developer)' || !parsed.displayName) {
              parsed.displayName = 'Ryan Ortiz (Developer)';
            }
          } else if (uKey === 'employee01') {
            parsed.role = 'employee';
            if (!parsed.displayName) parsed.displayName = 'Island Security';
          } else if (uKey === 'employee02') {
            parsed.role = 'employee';
            if (!parsed.displayName) parsed.displayName = 'Inspire Integrated';
          } else if (uKey === '1gdl') {
            parsed.role = 'guest';
            if (!parsed.displayName) parsed.displayName = 'Gulf Dunes Landscapping';
          }
          sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(parsed));
          return parsed;
        }
      }
      const localSaved = localStorage.getItem(this.STORAGE_KEY);
      if (localSaved) {
        const parsed = JSON.parse(localSaved);
        if (parsed && parsed.username) {
          const uKey = parsed.username.toLowerCase();
          if (['admin', 'guest', 'main'].includes(uKey)) {
            localStorage.removeItem(this.STORAGE_KEY);
            return null;
          }
          if (uKey === 'security') {
            parsed.role = 'security';
            if (!parsed.displayName || parsed.displayName === 'Security Officer') parsed.displayName = 'SBYIM Security Officer';
          } else if (uKey === 'sbyim') {
            parsed.role = 'admin';
            if (!parsed.displayName) parsed.displayName = 'SBYI Management';
          } else if (uKey === 'ryan') {
            parsed.role = 'developer';
            if (parsed.displayName === 'Ryan (System Administrator)' || parsed.displayName === 'System Administrator' || parsed.displayName === 'Ryan (Developer)' || !parsed.displayName) {
              parsed.displayName = 'Ryan Ortiz (Developer)';
            }
          } else if (uKey === 'employee01') {
            parsed.role = 'employee';
            if (!parsed.displayName) parsed.displayName = 'Island Security';
          } else if (uKey === 'employee02') {
            parsed.role = 'employee';
            if (!parsed.displayName) parsed.displayName = 'Inspire Integrated';
          } else if (uKey === '1gdl') {
            parsed.role = 'guest';
            if (!parsed.displayName) parsed.displayName = 'Gulf Dunes Landscapping';
          }
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(parsed));
          if (parsed && parsed.rememberMe) {
            sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(parsed));
            return parsed;
          }
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
      if (userKey === 'sbyim') {
        resolvedRole = 'admin';
        if (!resolvedDisplayName || resolvedDisplayName === 'admin') resolvedDisplayName = 'SBYI Management';
      }
      if (userKey === 'security') {
        resolvedRole = 'security';
        if (!resolvedDisplayName || resolvedDisplayName === 'Security Officer') resolvedDisplayName = 'SBYIM Security Officer';
      }
      if (userKey === 'ryan') {
        resolvedRole = 'developer';
        if (resolvedDisplayName === 'Ryan (System Administrator)' || resolvedDisplayName === 'System Administrator' || resolvedDisplayName === 'Ryan (Developer)' || !resolvedDisplayName) {
          resolvedDisplayName = 'Ryan Ortiz (Developer)';
        }
      }
      if (userKey === 'employee01') {
        resolvedRole = 'employee';
        if (!resolvedDisplayName) resolvedDisplayName = 'Island Security';
      }
      if (userKey === 'employee02') {
        resolvedRole = 'employee';
        if (!resolvedDisplayName) resolvedDisplayName = 'Inspire Integrated';
      }
      if (userKey === '1gdl') {
        resolvedRole = 'guest';
        if (!resolvedDisplayName) resolvedDisplayName = 'Gulf Dunes Landscapping';
      }

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
    const roleKey = String(role || '').trim().toLowerCase();
    const usersMap = this.systemUsers;
    let u = usersMap[roleKey];
    if (!u) {
      u = Object.values(usersMap).find(user => (user.role || '').toLowerCase() === roleKey);
    }
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

  canBulkDelete() {
    return this.isDeveloper();
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
       this.currentUser.username?.toLowerCase() === 'sbyim')
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
       this.currentUser.role === 'developer')
    );
  }

  canExportJSON() {
    if (this.isSBYIM()) return false;
    return Boolean(
      this.currentUser &&
      (this.currentUser.role === 'admin' ||
       this.currentUser.username?.toLowerCase() === 'ryan' ||
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
