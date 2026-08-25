/**
 * NOC Portal - Role-Based Authentication (RBAC) Module
 * Handles user login states, Admin vs Guest permissions, session storage, and event dispatching.
 */

class AuthManager {
  constructor() {
    this.STORAGE_KEY = 'noc_portal_auth_user';
    this.currentUser = this.loadUser();
  }

  /**
   * Predefined system accounts
   */
  get systemUsers() {
    return {
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
   * Load saved session from sessionStorage, or default to Guest user on initial startup
   */
  loadUser() {
    try {
      const saved = sessionStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not read auth from storage', e);
    }
    // Default: Authenticate automatically as Guest when application starts
    const guestUser = {
      username: this.systemUsers.guest.username,
      role: this.systemUsers.guest.role,
      displayName: this.systemUsers.guest.displayName,
      email: this.systemUsers.guest.email,
      loggedInAt: new Date().toISOString()
    };
    try {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(guestUser));
    } catch (e) {
      console.warn('Could not persist initial guest auth to storage', e);
    }
    return guestUser;
  }

  /**
   * Check login credentials
   */
  login(username, password) {
    const userKey = username.trim().toLowerCase();
    const user = this.systemUsers[userKey];

    if (user && user.password === password) {
      this.currentUser = {
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        email: user.email,
        loggedInAt: new Date().toISOString()
      };
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.currentUser));
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
    if (this.systemUsers[role]) {
      const u = this.systemUsers[role];
      return this.login(u.username, u.password);
    }
    return { success: false, message: 'Invalid role specified.' };
  }

  /**
   * Logout current user and reset back to Guest role
   */
  logout() {
    const guestUser = {
      username: this.systemUsers.guest.username,
      role: this.systemUsers.guest.role,
      displayName: this.systemUsers.guest.displayName,
      email: this.systemUsers.guest.email,
      loggedInAt: new Date().toISOString()
    };
    this.currentUser = guestUser;
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.currentUser));
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
    return this.currentUser && this.currentUser.role === 'admin';
  }

  isGuest() {
    return this.currentUser && this.currentUser.role === 'guest';
  }

  canManageDatabase() {
    return true;
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
    return true; // Both admin and guest can download
  }

  canView() {
    return true; // Both admin and guest can view
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
