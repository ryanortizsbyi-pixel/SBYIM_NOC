/**
 * NOC Portal - UI Renderer & Modal Controller
 * Manages DOM manipulation, data tables, grid cards, modals, notifications, and RBAC view state.
 */

class UIManager {
  constructor() {
    this.currentRecords = [];
    this.selectedRecordIds = new Set();
    this.activeView = 'table'; // 'table' or 'grid'
    this.currentEditingId = null;
    this.pendingUploadFiles = []; // Temporary files buffer for the create/edit form
    this.fpIssuance = null;
    this.fpExpiration = null;
  }

  /**
   * Initialize UI bindings and event listeners
   */
  init() {
    this.bindAuthEvents();
    this.bindDatabaseEvents();
    this.bindBulkDeleteEvents();
    this.initDatePickers();
    this.updateUserBadge();
    this.renderDatabaseStatus();

    const guestPrompt = document.getElementById('guestPromptContainer');
    if (guestPrompt) {
      guestPrompt.addEventListener('click', () => {
        if (!window.nocAuth || !window.nocAuth.isLoggedIn()) {
          this.openLoginModal(true);
        }
      });
      guestPrompt.style.cursor = 'pointer';
    }
  }

  /**
   * Initialize Flatpickr modern datepickers with custom date format (e.g. 31 Aug 2026)
   */
  initDatePickers() {
    const issuanceEl = document.getElementById('dateIssuanceInput');
    const expirationEl = document.getElementById('dateExpirationInput');

    if (typeof flatpickr === 'function') {
      if (issuanceEl && !this.fpIssuance) {
        this.fpIssuance = flatpickr(issuanceEl, {
          dateFormat: 'Y-m-d',
          altInput: true,
          altFormat: 'd M Y',
          altInputClass: 'form-input flatpickr-custom-input',
          allowInput: true,
          placeholder: 'e.g. 31 Aug 2026',
          onChange: (selectedDates, dateStr) => {
            if (this.fpExpiration && selectedDates[0]) {
              this.fpExpiration.set('minDate', dateStr);
            }
          }
        });
      }

      if (expirationEl && !this.fpExpiration) {
        this.fpExpiration = flatpickr(expirationEl, {
          dateFormat: 'Y-m-d',
          altInput: true,
          altFormat: 'd M Y',
          altInputClass: 'form-input flatpickr-custom-input',
          allowInput: true,
          placeholder: 'e.g. 31 Aug 2026'
        });
      }
    }
  }

  /**
   * Listen to database and Supabase config changes
   */
  bindDatabaseEvents() {
    window.addEventListener('noc:supabase-config-change', () => {
      this.renderDatabaseStatus();
    });
    window.addEventListener('noc:aiven-status-change', () => {
      this.renderDatabaseStatus();
    });
  }

  /**
   * Show a toast message to the user (with optional Undo action callback)
   */
  showToast(message, type = 'info', action = null) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    let actionBtnHtml = '';
    if (action && typeof action.onClick === 'function') {
      actionBtnHtml = `<button type="button" class="btn btn-sm toast-action-btn" style="margin-left:0.75rem; background:rgba(255,255,255,0.95); border:1px solid #93C5FD; color:#1E40AF; font-weight:800; font-size:0.78rem; padding:0.22rem 0.6rem; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; gap:0.25rem; box-shadow:0 1px 2px rgba(0,0,0,0.1);">${this.escapeHTML(action.label || '↩️ Undo')}</button>`;
    }

    toast.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.5rem; width:100%;">
        <span>${icon}</span>
        <span class="toast-message" style="flex:1;">${this.escapeHTML(message)}</span>
        ${actionBtnHtml}
      </div>
    `;

    if (action && typeof action.onClick === 'function') {
      const btn = toast.querySelector('.toast-action-btn');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          action.onClick();
          toast.remove();
        });
      }
    }

    container.appendChild(toast);

    const duration = action ? 6500 : 3500;
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Format date into readable string in "DD MMM YYYY" format (e.g. 31 Aug 2026)
   */
  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      // If string starts with YYYY-MM-DD format (standard ISO date), parse parts directly to prevent timezone shift
      if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        const parts = dateStr.split('T')[0].split('-');
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const monthName = months[monthIndex] || parts[1];
        return `${day} ${monthName} ${year}`;
      }

      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = d.getDate();
      const monthName = months[d.getMonth()];
      const year = d.getFullYear();
      return `${day} ${monthName} ${year}`;
    } catch (e) {
      return dateStr;
    }
  }

  /**
   * Format bytes into human-readable size
   */
  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Update header user badge & role indicator (RBAC)
   */
  updateUserBadge() {
    const badgeEl = document.getElementById('userRoleBadge');
    const newNocBtn = document.getElementById('btnNewNoc');
    const btnExportCSV = document.getElementById('btnExportCSV');
    const btnExportJSON = document.getElementById('btnExportJSON');
    const btnPrintReport = document.getElementById('btnPrintReport');
    const statsGrid = document.querySelector('.stats-grid');
    const filterStatus = document.getElementById('filterStatus');
    const filterNocType = document.getElementById('filterNocType');
    const filterSort = document.getElementById('filterSort');
    const searchInput = document.getElementById('searchInput');
    const guestPromptText = document.querySelector('#guestPromptContainer .empty-text');

    const user = window.nocAuth.getUser();
    const isAdmin = window.nocAuth.isAdmin();

    // Toggle Schema and User DB tab in DB Modal based on role
    const canManageDb = window.nocAuth && window.nocAuth.canManageDatabase();
    const schemaTabBtn = document.getElementById('tabBtnSchema');
    const userDbTabBtn = document.getElementById('tabBtnUserDb');
    const schemaSection = document.getElementById('dbModalSchemaSection');

    if (schemaTabBtn) {
      schemaTabBtn.style.display = canManageDb ? 'flex' : 'none';
    }
    if (userDbTabBtn) {
      userDbTabBtn.style.display = canManageDb ? 'flex' : 'none';
    }
    if (schemaSection) {
      schemaSection.style.display = canManageDb ? 'block' : 'none';
    }

    if (badgeEl) {
      if (window.nocAuth.isLoggedIn()) {
        badgeEl.classList.remove('is-unauthenticated');
        let roleLabel = 'Guest';
        let dotClass = 'guest';
        if (user?.role === 'admin') {
          roleLabel = 'Admin';
          dotClass = 'admin';
        } else if (user?.role === 'developer') {
          roleLabel = 'Developer';
          dotClass = 'developer';
        } else if (user?.role === 'security') {
          roleLabel = 'Security';
          dotClass = 'security';
        } else if (user?.role === 'main' || user?.role === 'employee') {
          roleLabel = 'Employee';
          dotClass = 'employee';
        } else {
          roleLabel = 'Guest';
          dotClass = 'guest';
        }

        badgeEl.innerHTML = `
          <span class="role-dot ${dotClass}"></span>
          <span>${roleLabel}</span>
          <button class="btn btn-sm btn-outline" style="padding:0.18rem 0.5rem; font-size:0.75rem; margin-left:0.35rem;" id="btnHeaderSwitchRole" title="Switch account role">
            Switch
          </button>
          <button class="btn btn-sm" style="padding:0.18rem 0.55rem; font-size:0.75rem; margin-left:0.25rem; background:#FFF1F2; color:#BE123C; border:1px solid #FDA4AF; border-radius:var(--radius-sm); font-weight:600; cursor:pointer;" id="btnHeaderLogout" title="Log out and return to landing screen">
            🚪 Log Out
          </button>
        `;

        const switchBtn = document.getElementById('btnHeaderSwitchRole');
        if (switchBtn) {
          switchBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openLoginModal(false);
          });
        }

        const logoutBtn = document.getElementById('btnHeaderLogout');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.nocAuth.logout();
            this.showToast('You have been logged out. Returned to landing screen.', 'info');
          });
        }
      } else {
        badgeEl.classList.add('is-unauthenticated');
        badgeEl.innerHTML = `
          <button class="btn btn-header-signin" id="btnHeaderSignIn" title="Click to sign in to the portal">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <path d="m9 12 2 2 4-4"></path>
            </svg>
            <span>Sign In</span>
          </button>
        `;

        const signInBtn = document.getElementById('btnHeaderSignIn');
        if (signInBtn) {
          signInBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openLoginModal(true);
          });
        }
      }
    }

    if (newNocBtn) {
      newNocBtn.style.display = isAdmin ? 'inline-flex' : 'none';
      newNocBtn.disabled = !isAdmin;
      newNocBtn.title = isAdmin ? 'Create a new NOC record' : '';
    }

    const isSbyim = window.nocAuth && window.nocAuth.isSBYIM && window.nocAuth.isSBYIM();
    if (btnExportCSV) {
      const showCsv = isAdmin && !isSbyim;
      btnExportCSV.style.display = showCsv ? 'inline-flex' : 'none';
      btnExportCSV.disabled = !showCsv;
      btnExportCSV.title = showCsv ? 'Export database to CSV spreadsheet' : '';
    }

    const canExportJson = window.nocAuth && window.nocAuth.canExportJSON();
    if (btnExportJSON) {
      btnExportJSON.style.display = canExportJson ? 'inline-flex' : 'none';
      btnExportJSON.disabled = !canExportJson;
      btnExportJSON.title = canExportJson ? 'Download complete JSON backup' : '';
    }

    if (btnPrintReport) {
      btnPrintReport.style.display = isAdmin ? 'inline-flex' : 'none';
      btnPrintReport.disabled = !isAdmin;
      btnPrintReport.title = isAdmin ? 'Print tabular report' : '';
    }

    const heroUserDisplay = document.getElementById('heroUserDisplay');
    const heroUserDisplayName = document.getElementById('heroUserDisplayName');
    if (heroUserDisplay && heroUserDisplayName) {
      if (window.nocAuth.isLoggedIn() && user && user.role !== 'none') {
        const displayName = user.displayName || user.display_name || user.username || '';
        heroUserDisplayName.textContent = displayName;
        heroUserDisplay.style.display = 'inline-flex';
      } else {
        heroUserDisplay.style.display = 'none';
      }
    }

    const isLoggedIn = window.nocAuth && window.nocAuth.isLoggedIn();
    const isGuest = window.nocAuth && window.nocAuth.isGuest();
    const isSecurity = window.nocAuth && window.nocAuth.isSecurity();
    const isMain = window.nocAuth && window.nocAuth.isMain();
    const isDeveloper = window.nocAuth && window.nocAuth.isDeveloper && window.nocAuth.isDeveloper();

    if (statsGrid) {
      statsGrid.style.display = (isAdmin || isSecurity) ? 'grid' : 'none';
    }

    document.body.classList.toggle('unauthenticated', !isLoggedIn);
    document.body.classList.toggle('role-main', Boolean(isMain));
    document.body.classList.toggle('role-employee', Boolean(isMain));
    document.body.classList.toggle('role-developer', Boolean(isDeveloper));

    const canViewCompanyCode = window.nocAuth && window.nocAuth.canViewCompanyCode ? window.nocAuth.canViewCompanyCode() : false;
    const companyCodeGroup = document.getElementById('companyCodeFormGroup');
    const clientGroup = document.getElementById('clientFormGroup');
    if (companyCodeGroup) {
      companyCodeGroup.style.display = canViewCompanyCode ? '' : 'none';
    }
    if (clientGroup) {
      clientGroup.classList.toggle('col-span-2', canViewCompanyCode);
    }

    const controlsCard = document.querySelector('.controls-card');
    if (controlsCard) {
      controlsCard.style.display = !isLoggedIn ? 'none' : 'block';
    }

    if (filterStatus) {
      filterStatus.style.display = !isLoggedIn ? 'none' : 'inline-block';
    }

    if (filterNocType) {
      filterNocType.style.display = !isLoggedIn ? 'none' : 'inline-block';
    }

    if (filterSort) {
      filterSort.style.display = !isLoggedIn ? 'none' : 'inline-block';
    }

    const filtersGroup = document.querySelector('.filters-group');
    if (filtersGroup) {
      filtersGroup.style.display = !isLoggedIn ? 'none' : 'flex';
    }

    const searchBox = document.querySelector('.search-box');
    if (searchBox) {
      searchBox.style.display = (!isLoggedIn || isGuest) ? 'none' : '';
    }

    if (searchInput) {
      searchInput.placeholder = (isSecurity || isMain)
        ? (isMain ? 'Search by NOC #, Client, Contractor, Type, or Description...' : 'Security Lookup: Search by NOC #, Contractor (Issued To), Client, Type...')
        : (isAdmin
            ? 'Search by NOC #, Client, Contractor, Type, or Description...'
            : 'Search by NOC Number, Contractor (Issued To), or Type...');
    }

    if (guestPromptText) {
      guestPromptText.textContent = isMain
        ? 'Please enter an NOC Number, Contractor (Issued To), or Client in the search bar above to look up and view certificate details.'
        : 'Active NOC records and permits corresponding to your account are displayed below.';
    }

    const closeLoginBtn = document.getElementById('btnCloseLoginModal');
    if (closeLoginBtn) {
      closeLoginBtn.style.display = 'inline-flex';
    }

    const btnDatabaseConfig = document.getElementById('btnDatabaseConfig');
    const showDbBadge = window.nocAuth && window.nocAuth.canShowDatabaseBadge();
    if (btnDatabaseConfig) {
      btnDatabaseConfig.style.display = showDbBadge ? 'inline-flex' : 'none';
      btnDatabaseConfig.disabled = !showDbBadge;
    }

    const btnAiDocuments = document.getElementById('btnAiDocuments');
    const canManageAi = window.nocAuth && window.nocAuth.canManageAiDocs();
    if (btnAiDocuments) {
      btnAiDocuments.style.display = canManageAi ? 'inline-flex' : 'none';
      btnAiDocuments.disabled = !canManageAi;
    }

    const btnUserDatabase = document.getElementById('btnUserDatabase');
    const canManageUsers = window.nocAuth && window.nocAuth.canManageUsers();
    if (btnUserDatabase) {
      btnUserDatabase.style.display = canManageUsers ? 'inline-flex' : 'none';
      btnUserDatabase.disabled = !canManageUsers;
    }

    const isEmployee = window.nocAuth && (window.nocAuth.isEmployee ? window.nocAuth.isEmployee() : window.nocAuth.isMain());
    const canViewClient = window.nocAuth && window.nocAuth.canViewClient ? window.nocAuth.canViewClient() : false;
    const canViewNocType = window.nocAuth && window.nocAuth.canViewNocType ? window.nocAuth.canViewNocType() : false;
    const thTableNocType = document.getElementById('thTableNocType');
    const thTableClient = document.getElementById('thTableClient');
    const thTableDesc = document.getElementById('thTableDesc');
    const thTableActions = document.getElementById('thTableActions');
    if (thTableNocType) {
      thTableNocType.style.display = canViewNocType ? '' : 'none';
    }
    if (thTableClient) {
      thTableClient.style.display = canViewClient ? '' : 'none';
    }
    if (thTableDesc) {
      thTableDesc.style.display = '';
    }
    if (thTableActions) {
      thTableActions.style.display = isEmployee ? 'none' : '';
    }

    const btnFloatingAI = document.getElementById('btnFloatingAIAssistant');
    if (btnFloatingAI) {
      btnFloatingAI.style.display = isDeveloper ? 'inline-flex' : 'none';
    }

    if (window.sbyimAIUI && window.sbyimAIUI.updateRoleView) {
      window.sbyimAIUI.updateRoleView();
    }

    this.updateSelectionUI();
  }

  /**
   * Clears search bar history, active filters, open modals, and temporary buffers when switching roles
   */
  resetSessionState() {
    const isSBYIM = window.nocAuth && window.nocAuth.isSBYIM();
    const isSecurity = window.nocAuth && window.nocAuth.isSecurity();
    const isAdminUser = window.nocAuth && window.nocAuth.isAdminUser();
    const isGuest = window.nocAuth && window.nocAuth.isGuest();
    const isMain = window.nocAuth && window.nocAuth.isMain();
    const currentUser = window.nocAuth && window.nocAuth.getUser();
    const guestSearchQuery = ((isGuest || isMain) && currentUser && currentUser.username) ? currentUser.username : '';

    let defaultSort = 'newest';
    if (isSBYIM || isSecurity || isGuest || isMain) {
      defaultSort = 'issuance';
    } else if (isAdminUser) {
      defaultSort = 'newest';
    }

    // 1. If role is Guest, automatically set search input to username to view corresponding data files
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = guestSearchQuery;
    }
    if (window.nocApp) {
      window.nocApp.searchQuery = guestSearchQuery;
      window.nocApp.selectedStatus = 'all';
      window.nocApp.selectedType = 'all';
      window.nocApp.sortBy = defaultSort;
    }

    // 2. Reset filter dropdown values
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) filterStatus.value = 'all';

    const filterNocType = document.getElementById('filterNocType');
    if (filterNocType) filterNocType.value = 'all';

    const filterSort = document.getElementById('filterSort');
    if (filterSort) filterSort.value = defaultSort;

    // 3. Close any active modal dialogs & document viewers
    this.closeEntryModal();
    this.closeDetailsModal();
    this.closeDeleteModal();
    this.closeBulkDeleteModal();
    this.clearRecordSelection();
    this.closeRequirementsModal();
    this.closeCocModal();
    this.closeAiDocumentsModal();
    this.closeDatabaseModal();
    this.closeUserDatabaseModal();
    this.closeUserEditModal();
    if (window.docViewer) {
      window.docViewer.close();
    }

    // 4. Reset entry form buffers
    const entryForm = document.getElementById('nocEntryForm');
    if (entryForm) entryForm.reset();
    const customContainer = document.getElementById('customTypeContainer');
    const customInput = document.getElementById('nocTypeCustomInput');
    const nocTypeSelect = document.getElementById('nocTypeSelect');
    if (customContainer) customContainer.style.display = 'none';
    if (customInput) {
      customInput.value = '';
      customInput.required = false;
    }
    if (nocTypeSelect) nocTypeSelect.value = '';

    const customContractorContainer = document.getElementById('customContractorContainer');
    const customContractorInput = document.getElementById('issuedToCustomInput');
    const editContractorContainer = document.getElementById('editContractorContainer');
    const issuedToEditInput = document.getElementById('issuedToEditInput');
    const issuedToSelect = document.getElementById('issuedToSelect');
    if (customContractorContainer) customContractorContainer.style.display = 'none';
    if (customContractorInput) {
      customContractorInput.value = '';
      customContractorInput.required = false;
    }
    if (editContractorContainer) editContractorContainer.style.display = 'none';
    if (issuedToEditInput) {
      issuedToEditInput.value = '';
      issuedToEditInput.dataset.originalValue = '';
    }
    if (issuedToSelect) issuedToSelect.value = '';

    this.currentEditingId = null;
    this.pendingUploadFiles = [];
    this.pendingDeleteId = null;

    // 5. Reset view mode to table view
    this.activeView = 'table';
    const btnTableView = document.getElementById('btnViewTable');
    const btnGridView = document.getElementById('btnViewGrid');
    if (btnTableView && btnGridView) {
      btnTableView.classList.add('active');
      btnGridView.classList.remove('active');
    }
  }

  /**
   * Listen to auth change events & delegated auth clicks
   */
  bindAuthEvents() {
    // 1. Global delegated click listeners for authentication buttons
    document.addEventListener('click', (e) => {
      const signInBtn = e.target.closest('#btnHeaderSignIn, .btn-header-signin');
      if (signInBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.openLoginModal(true);
        return;
      }

      const switchRoleBtn = e.target.closest('#btnHeaderSwitchRole');
      if (switchRoleBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.openLoginModal(false);
        return;
      }

      const logoutBtn = e.target.closest('#btnHeaderLogout');
      if (logoutBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (window.nocAuth) {
          window.nocAuth.logout();
          this.showToast('You have been logged out. Returned to landing screen.', 'info');
        }
        return;
      }

      const closeLoginBtn = e.target.closest('#btnCloseLoginModal');
      if (closeLoginBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.closeLoginModal();
        return;
      }
    });

    // 2. Auth state change listener
    window.addEventListener('noc:auth-change', () => {
      this.resetSessionState();
      this.updateUserBadge();
      if (window.nocDB && typeof window.nocDB.getStatistics === 'function') {
        window.nocDB.getStatistics().then(stats => {
          if (stats) this.renderStats(stats);
        }).catch(err => console.warn('Could not fetch stats on auth change:', err));
      }
      if (window.nocApp) {
        window.nocApp.applyFilters();
      } else {
        this.renderRecords(this.currentRecords);
      }
      this.showToast(`Active session: ${window.nocAuth.getUser().displayName} (${window.nocAuth.getUser().role.toUpperCase()})`, 'info');
    });
  }

  /**
   * Render Stats counters on dashboard
   */
  renderStats(stats) {
    const elTotal = document.getElementById('statTotalNOC');
    const elActive = document.getElementById('statActiveNOC');
    const elExpiring = document.getElementById('statExpiringNOC');
    const elExpired = document.getElementById('statExpiredNOC');

    if (elTotal) elTotal.textContent = stats.total || 0;
    if (elActive) elActive.textContent = stats.active || 0;
    if (elExpiring) elExpiring.textContent = stats.expiring || 0;
    if (elExpired) elExpired.textContent = stats.expired || 0;
  }

  /**
   * Render records in current active view (Table or Grid)
   */
  renderRecords(records = []) {
    this.currentRecords = records;
    const tableContainer = document.getElementById('tableViewContainer');
    const gridContainer = document.getElementById('gridViewContainer');
    const emptyState = document.getElementById('emptyStateContainer');
    const guestPrompt = document.getElementById('guestPromptContainer');
    const isLoggedIn = window.nocAuth && window.nocAuth.isLoggedIn();
    const isGuest = window.nocAuth && window.nocAuth.isGuest();
    const isMain = window.nocAuth && window.nocAuth.isMain();

    // 1. If not logged in on first load, DO NOT show data records - show Guest Sign-in Prompt
    if (!isLoggedIn) {
      if (tableContainer) tableContainer.style.display = 'none';
      if (gridContainer) gridContainer.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      const paginationContainer = document.getElementById('paginationContainer');
      if (paginationContainer) paginationContainer.style.display = 'none';
      if (guestPrompt) {
        guestPrompt.style.display = 'block';
        const titleEl = guestPrompt.querySelector('.empty-title');
        const textEl = guestPrompt.querySelector('.empty-text');
        const landingSignInBtn = document.getElementById('btnLandingSignIn');
        if (titleEl) titleEl.textContent = 'Welcome to SBYIM NOC Portal';
        if (textEl) textEl.textContent = 'Please sign in to access, search, and view certificate compliance records.';
        if (landingSignInBtn) landingSignInBtn.style.display = 'inline-flex';
      }
      return;
    }

    const hasActiveQuery = window.nocApp && (
      (window.nocApp.searchQuery && window.nocApp.searchQuery.trim().length > 0) ||
      (!isGuest && window.nocApp.selectedStatus && window.nocApp.selectedStatus !== 'all') ||
      (!isGuest && window.nocApp.selectedType && window.nocApp.selectedType !== 'all')
    );

    // If logged in as Guest and no active search query, show Guest Prompt
    if (isGuest && !hasActiveQuery) {
      if (tableContainer) tableContainer.style.display = 'none';
      if (gridContainer) gridContainer.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      if (guestPrompt) {
        guestPrompt.style.display = 'block';
        const titleEl = guestPrompt.querySelector('.empty-title');
        const textEl = guestPrompt.querySelector('.empty-text');
        const landingSignInBtn = document.getElementById('btnLandingSignIn');
        if (titleEl) {
          titleEl.textContent = 'Guest Certificate Lookup';
        }
        if (textEl) {
          textEl.textContent = 'Active NOC records and permits corresponding to your account are displayed below.';
        }
        if (landingSignInBtn) landingSignInBtn.style.display = 'none';
      }
      return;
    }

    if (guestPrompt) guestPrompt.style.display = 'none';

    const paginationContainer = document.getElementById('paginationContainer');
    if (!records || records.length === 0) {
      if (tableContainer) tableContainer.style.display = 'none';
      if (gridContainer) gridContainer.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      if (paginationContainer) paginationContainer.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    if (this.activeView === 'table') {
      if (tableContainer) tableContainer.style.display = 'block';
      if (gridContainer) gridContainer.style.display = 'none';
      this.renderTableView(records);
    } else {
      if (tableContainer) tableContainer.style.display = 'none';
      if (gridContainer) gridContainer.style.display = 'grid';
      this.renderGridView(records);
    }
  }

  /**
   * Render Table View
   */
  renderTableView(records) {
    const tbody = document.getElementById('nocTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const isAdmin = window.nocAuth.isAdmin();
    const isDeveloper = window.nocAuth && window.nocAuth.isDeveloper && window.nocAuth.isDeveloper();
    const canViewClient = window.nocAuth && window.nocAuth.canViewClient ? window.nocAuth.canViewClient() : false;
    const canViewNocType = window.nocAuth && window.nocAuth.canViewNocType ? window.nocAuth.canViewNocType() : false;
    const canViewCompanyCode = window.nocAuth && window.nocAuth.canViewCompanyCode ? window.nocAuth.canViewCompanyCode() : false;
    const isEmployee = window.nocAuth && (window.nocAuth.isEmployee ? window.nocAuth.isEmployee() : window.nocAuth.isMain());

    const thTableSelectAll = document.getElementById('thTableSelectAll');
    const thTableNocType = document.getElementById('thTableNocType');
    const thTableClient = document.getElementById('thTableClient');
    const thTableDesc = document.getElementById('thTableDesc');
    const thTableActions = document.getElementById('thTableActions');

    if (thTableSelectAll) thTableSelectAll.style.display = isDeveloper ? '' : 'none';
    if (thTableNocType) thTableNocType.style.display = canViewNocType ? '' : 'none';
    if (thTableClient) thTableClient.style.display = canViewClient ? '' : 'none';
    if (thTableDesc) thTableDesc.style.display = '';
    if (thTableActions) thTableActions.style.display = isEmployee ? 'none' : '';

    records.forEach((rec) => {
      const status = window.nocDB.getStatus(rec.dateOfExpiration);
      const isSelected = this.selectedRecordIds && this.selectedRecordIds.has(rec.id);

      let statusBadge = '';
      if (status === 'active') {
        statusBadge = `<span class="badge badge-active">Active</span>`;
      } else if (status === 'expiring') {
        statusBadge = `<span class="badge badge-expiring">Expiring Soon</span>`;
      } else {
        statusBadge = `<span class="badge badge-expired">Expired</span>`;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="developer-select-col" style="${isDeveloper ? '' : 'display:none;'} text-align:center;">
          <input type="checkbox" class="noc-row-checkbox noc-select-checkbox" data-id="${rec.id}" ${isSelected ? 'checked' : ''} title="Select record">
        </td>
        <td style="white-space:nowrap;">${this.escapeHTML(rec.nocNumber)}</td>
        ${canViewNocType ? `<td>${this.escapeHTML(rec.nocType)}</td>` : ''}
        ${canViewClient ? `<td>${this.escapeHTML(rec.client || '—')}</td>` : ''}
        <td class="noc-issued-to-cell">${this.escapeHTML((rec.issuedTo || '').toUpperCase())}</td>
        <td style="white-space:nowrap;">${this.formatDate(rec.dateOfIssuance)}</td>
        <td style="white-space:nowrap;">${this.formatDate(rec.dateOfExpiration)}</td>
        <td class="noc-table-desc" title="${this.escapeHTML(rec.description)}">
          <div class="desc-clamp">
            ${this.escapeHTML(rec.description || 'N/A')}
          </div>
        </td>
        <td>${statusBadge}</td>
        ${!isEmployee ? `
        <td>
          <div class="table-actions">
            <button class="btn btn-sm btn-outline-primary" data-action="view" data-id="${rec.id}" title="View NOC Details & Documents">
              👁️ View
            </button>
            ${isAdmin ? `
              <button class="btn btn-sm btn-outline" data-action="edit" data-id="${rec.id}" title="Edit NOC">
                ✏️ Edit
              </button>
              <button class="btn btn-sm btn-outline" style="color:#DC2626;" data-action="delete" data-id="${rec.id}" title="Delete NOC">
                🗑️
              </button>
            ` : ''}
          </div>
        </td>
        ` : ''}
      `;

      tbody.appendChild(tr);
    });

    this.bindTableActionEvents(tbody);
    this.updateSelectionUI();
  }

  /**
   * Render Grid View
   */
  renderGridView(records) {
    const grid = document.getElementById('gridViewContainer');
    if (!grid) return;
    grid.innerHTML = '';

    const isAdmin = window.nocAuth.isAdmin();
    const isDeveloper = window.nocAuth && window.nocAuth.isDeveloper && window.nocAuth.isDeveloper();
    const canViewClient = window.nocAuth && window.nocAuth.canViewClient ? window.nocAuth.canViewClient() : false;
    const canViewNocType = window.nocAuth && window.nocAuth.canViewNocType ? window.nocAuth.canViewNocType() : false;
    const canViewCompanyCode = window.nocAuth && window.nocAuth.canViewCompanyCode ? window.nocAuth.canViewCompanyCode() : false;
    const isEmployee = window.nocAuth && (window.nocAuth.isEmployee ? window.nocAuth.isEmployee() : window.nocAuth.isMain());

    records.forEach((rec) => {
      const status = window.nocDB.getStatus(rec.dateOfExpiration);
      const docsCount = rec.documents ? rec.documents.length : 0;
      const isSelected = this.selectedRecordIds && this.selectedRecordIds.has(rec.id);

      let statusBadge = '';
      if (status === 'active') {
        statusBadge = `<span class="badge badge-active">Active</span>`;
      } else if (status === 'expiring') {
        statusBadge = `<span class="badge badge-expiring">Expiring Soon</span>`;
      } else {
        statusBadge = `<span class="badge badge-expired">Expired</span>`;
      }

      const card = document.createElement('div');
      card.className = 'noc-card';
      card.style.position = 'relative';
      card.innerHTML = `
        ${isDeveloper ? `
        <div class="card-grid-select developer-select-col">
          <input type="checkbox" class="noc-grid-checkbox noc-select-checkbox" data-id="${rec.id}" ${isSelected ? 'checked' : ''} title="Select record">
        </div>
        ` : ''}
        <div>
          <div class="card-header">
            <div>
              <div class="card-noc-number">${this.escapeHTML(rec.nocNumber)}</div>
              ${canViewNocType ? `<div style="margin-top:0.25rem; font-size:0.88rem; color:var(--text-muted); font-weight:500;">${this.escapeHTML(rec.nocType)}</div>` : ''}
            </div>
            ${statusBadge}
          </div>
          
          <div class="card-body" style="margin-top:1rem;">
            ${canViewClient ? `
              <div class="card-meta-row">
                <span class="card-meta-label">Client:</span>
                <span class="card-meta-value">${this.escapeHTML(rec.client || '—')}</span>
              </div>
            ` : ''}
            <div class="card-meta-row">
              <span class="card-meta-label">Issued To:</span>
              <span class="card-meta-value noc-issued-to-val">${this.escapeHTML((rec.issuedTo || '').toUpperCase())}</span>
            </div>
            <div class="card-meta-row">
              <span class="card-meta-label">Issuance:</span>
              <span class="card-meta-value">${this.formatDate(rec.dateOfIssuance)}</span>
            </div>
            <div class="card-meta-row">
              <span class="card-meta-label">Expiration:</span>
              <span class="card-meta-value">${this.formatDate(rec.dateOfExpiration)}</span>
            </div>
            <div class="card-desc" title="${this.escapeHTML(rec.description)}">
              ${this.escapeHTML(rec.description)}
            </div>
          </div>
        </div>

        ${!isEmployee ? `
        <div class="card-footer">
          <span class="doc-count-badge" data-action="view-docs" data-id="${rec.id}">
            📁 ${docsCount} ${docsCount === 1 ? 'doc' : 'docs'}
          </span>
          <div class="table-actions">
            <button class="btn btn-sm btn-outline-primary" data-action="view" data-id="${rec.id}">
              👁️ View
            </button>
            ${isAdmin ? `
              <button class="btn btn-sm btn-outline" data-action="edit" data-id="${rec.id}">
                ✏️ Edit
              </button>
              <button class="btn btn-sm btn-outline" style="color:#DC2626;" data-action="delete" data-id="${rec.id}">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>
        ` : ''}
      `;

      grid.appendChild(card);
    });

    this.bindTableActionEvents(grid);
    this.updateSelectionUI();
  }

  /**
   * Render Pagination Bar and Controls
   */
  renderPagination(currentPage, totalPages, totalRecords, startIdx, endIdx) {
    const container = document.getElementById('paginationContainer');
    const infoEl = document.getElementById('paginationInfo');
    const controlsEl = document.getElementById('paginationControls');
    if (!container || !infoEl || !controlsEl) return;

    const isLoggedIn = window.nocAuth && window.nocAuth.isLoggedIn();
    const isGuest = window.nocAuth && window.nocAuth.isGuest();

    if (!isLoggedIn || isGuest || totalRecords === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';
    const displayedStart = totalRecords === 0 ? 0 : startIdx + 1;
    const displayedEnd = endIdx;
    infoEl.innerHTML = `Showing <strong>${displayedStart}–${displayedEnd}</strong> of <strong>${totalRecords}</strong> records`;

    if (totalPages <= 1) {
      controlsEl.innerHTML = '';
      return;
    }

    let html = '';
    // Previous Page Button
    html += `
      <button type="button" class="pagination-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''} title="Previous Page">
        ‹
      </button>
    `;

    // Numeric Page Buttons
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
        html += `
          <button type="button" class="pagination-btn ${p === currentPage ? 'active' : ''}" data-page="${p}" title="Page ${p}">
            ${p}
          </button>
        `;
      } else if (p === currentPage - 2 || p === currentPage + 2) {
        html += `<span class="pagination-ellipsis">…</span>`;
      }
    }

    // Next Page Button
    html += `
      <button type="button" class="pagination-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''} title="Next Page">
        ›
      </button>
    `;

    controlsEl.innerHTML = html;
  }

  /**
   * Bind event handlers for action buttons in rows and cards
   */
  bindTableActionEvents(container) {
    container.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');

        if (action === 'view' || action === 'view-docs') {
          this.openDetailsModal(id);
        } else if (action === 'edit') {
          this.openEditModal(id);
        } else if (action === 'delete') {
          this.openDeleteModal(id);
        } else if (action === 'download-all') {
          this.downloadAllRecordDocs(id);
        }
      });
    });

    // Bind checkboxes for developer multi-record selection
    container.querySelectorAll('.noc-row-checkbox, .noc-grid-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const id = checkbox.getAttribute('data-id');
        if (checkbox.checked) {
          this.selectedRecordIds.add(id);
        } else {
          this.selectedRecordIds.delete(id);
        }
        this.updateSelectionUI();
      });
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });
  }

  /**
   * Open the Create / Edit NOC Modal
   */
  async openEntryModal(id = null) {
    if (!window.nocAuth.canCreate() && !window.nocAuth.canEdit()) {
      this.showToast('You must be logged in as Admin to add or edit NOC records.', 'error');
      return;
    }

    this.currentEditingId = id;
    this.pendingUploadFiles = [];

    const modal = document.getElementById('nocEntryModal');
    const form = document.getElementById('nocEntryForm');
    const title = document.getElementById('entryModalTitle');
    const dropzoneContainer = document.getElementById('docPreviewList');

    if (form) form.reset();
    if (dropzoneContainer) dropzoneContainer.innerHTML = '';
    const customContainer = document.getElementById('customTypeContainer');
    const customInput = document.getElementById('nocTypeCustomInput');
    if (customContainer) customContainer.style.display = 'none';
    if (customInput) {
      customInput.value = '';
      customInput.required = false;
    }

    const customContractorContainer = document.getElementById('customContractorContainer');
    const customContractorInput = document.getElementById('issuedToCustomInput');
    const editContractorContainer = document.getElementById('editContractorContainer');
    const issuedToEditInput = document.getElementById('issuedToEditInput');
    if (customContractorContainer) customContractorContainer.style.display = 'none';
    if (customContractorInput) {
      customContractorInput.value = '';
      customContractorInput.required = false;
    }
    if (editContractorContainer) editContractorContainer.style.display = 'none';
    if (issuedToEditInput) {
      issuedToEditInput.value = '';
      issuedToEditInput.dataset.originalValue = '';
    }
    const companyCodeInput = document.getElementById('companyCodeInput');
    if (companyCodeInput) companyCodeInput.value = '';

    const canViewCompanyCode = window.nocAuth && window.nocAuth.canViewCompanyCode ? window.nocAuth.canViewCompanyCode() : false;
    const companyCodeGroup = document.getElementById('companyCodeFormGroup');
    const clientGroup = document.getElementById('clientFormGroup');
    if (companyCodeGroup) {
      companyCodeGroup.style.display = canViewCompanyCode ? '' : 'none';
    }
    if (clientGroup) {
      clientGroup.classList.toggle('col-span-2', canViewCompanyCode);
    }

    this.initDatePickers();

    if (id) {
      if (title) title.textContent = 'Edit NOC Record';
      const record = await window.nocDB.getById(id);
      if (record) {
        document.getElementById('nocNumberInput').value = record.nocNumber || '';
        if (window.nocApp && typeof window.nocApp.populateFormTypeOptions === 'function') {
          window.nocApp.populateFormTypeOptions(record.nocType || '');
        }
        if (window.nocApp && typeof window.nocApp.populateFormContractorOptions === 'function') {
          window.nocApp.populateFormContractorOptions(record.issuedTo || '');
        }

        if (this.fpIssuance) {
          this.fpIssuance.setDate(record.dateOfIssuance || '', true);
        } else {
          document.getElementById('dateIssuanceInput').value = record.dateOfIssuance || '';
        }

        if (this.fpExpiration) {
          this.fpExpiration.setDate(record.dateOfExpiration || '', true);
        } else {
          document.getElementById('dateExpirationInput').value = record.dateOfExpiration || '';
        }

        const issuedToFallback = document.getElementById('issuedToInput');
        if (issuedToFallback) issuedToFallback.value = record.issuedTo || '';
        if (companyCodeInput) companyCodeInput.value = record.companyCode || '';
        document.getElementById('clientInput').value = record.client || '';
        document.getElementById('descriptionInput').value = record.description || '';

        // Copy existing docs into pending buffer
        this.pendingUploadFiles = record.documents ? [...record.documents] : [];
        this.renderPendingUploads();
      }
    } else {
      if (title) title.textContent = 'Create New NOC Record';
      if (window.nocApp && typeof window.nocApp.populateFormTypeOptions === 'function') {
        window.nocApp.populateFormTypeOptions('');
      }
      if (window.nocApp && typeof window.nocApp.populateFormContractorOptions === 'function') {
        window.nocApp.populateFormContractorOptions('');
      }
      // Suggest default today's date for issuance
      const today = new Date().toISOString().split('T')[0];
      if (this.fpIssuance) {
        this.fpIssuance.setDate(today, true);
      } else {
        document.getElementById('dateIssuanceInput').value = today;
      }

      if (this.fpExpiration) {
        this.fpExpiration.clear();
      } else {
        document.getElementById('dateExpirationInput').value = '';
      }
    }

    if (modal) modal.classList.add('active');
  }

  /**
   * Helper to open edit modal
   */
  openEditModal(id) {
    this.openEntryModal(id);
  }

  /**
   * Close Entry Modal
   */
  closeEntryModal() {
    const modal = document.getElementById('nocEntryModal');
    if (modal) modal.classList.remove('active');
    this.currentEditingId = null;
    this.pendingUploadFiles = [];
    if (this.fpIssuance) this.fpIssuance.clear();
    if (this.fpExpiration) this.fpExpiration.clear();
    const customContainer = document.getElementById('customTypeContainer');
    const customInput = document.getElementById('nocTypeCustomInput');
    const nocTypeSelect = document.getElementById('nocTypeSelect');
    if (customContainer) customContainer.style.display = 'none';
    if (customInput) {
      customInput.value = '';
      customInput.required = false;
    }
    if (nocTypeSelect) nocTypeSelect.value = '';

    const customContractorContainer = document.getElementById('customContractorContainer');
    const customContractorInput = document.getElementById('issuedToCustomInput');
    const editContractorContainer = document.getElementById('editContractorContainer');
    const issuedToEditInput = document.getElementById('issuedToEditInput');
    const issuedToSelect = document.getElementById('issuedToSelect');
    if (customContractorContainer) customContractorContainer.style.display = 'none';
    if (customContractorInput) {
      customContractorInput.value = '';
      customContractorInput.required = false;
    }
    if (editContractorContainer) editContractorContainer.style.display = 'none';
    if (issuedToEditInput) {
      issuedToEditInput.value = '';
      issuedToEditInput.dataset.originalValue = '';
    }
    if (issuedToSelect) issuedToSelect.value = '';
    const companyCodeInput = document.getElementById('companyCodeInput');
    if (companyCodeInput) companyCodeInput.value = '';
  }

  /**
   * Render pending upload files inside the entry modal (Single PDF mode)
   */
  renderPendingUploads() {
    const container = document.getElementById('docPreviewList');
    const countEl = document.getElementById('uploadSlotCount');
    if (!container) return;

    container.innerHTML = '';
    const currentCount = this.pendingUploadFiles.length;
    if (countEl) countEl.textContent = `${currentCount}/1`;

    this.pendingUploadFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'doc-preview-item';
      item.innerHTML = `
        <div class="doc-preview-info">
          <span style="font-size:1.2rem;">📄</span>
          <div>
            <div class="doc-preview-name" title="${this.escapeHTML(file.name)}">${this.escapeHTML(file.name)}</div>
            <div class="doc-preview-size">${this.formatBytes(file.size)} <span class="badge" style="background:#FEE2E2; color:#DC2626; font-size:0.7rem; padding:0.1rem 0.4rem; margin-left:0.35rem; font-weight:700;">PDF</span></div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <button type="button" class="btn btn-sm btn-outline-primary doc-preview-btn" style="padding:0.25rem 0.6rem; font-size:0.75rem;" title="Preview PDF Document">👁️ Preview</button>
          <button type="button" class="doc-remove-btn" data-index="${index}" title="Remove PDF file">✕</button>
        </div>
      `;

      item.querySelector('.doc-preview-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        window.docViewer.open(this.pendingUploadFiles, index);
      });

      item.querySelector('.doc-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.pendingUploadFiles.splice(index, 1);
        this.renderPendingUploads();
      });

      container.appendChild(item);
    });
  }

  /**
   * Handle adding uploaded file to pending buffer with 1 PDF file limit validation
   */
  handleFilesSelected(files) {
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);

    // Filter for PDF documents only
    const pdfFiles = fileList.filter(file =>
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFiles.length === 0) {
      this.showToast('Invalid format. Please upload a PDF document only (.pdf).', 'error');
      return;
    }

    if (fileList.length > 1 || pdfFiles.length > 1) {
      this.showToast('Only 1 PDF document is permitted per record. Selected the first PDF.', 'info');
    }

    const file = pdfFiles[0];

    // Read file into Data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      // Set as the single pending document
      this.pendingUploadFiles = [{
        id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        name: file.name,
        type: 'application/pdf',
        size: file.size,
        dataUrl: e.target.result,
        uploadedAt: new Date().toISOString()
      }];
      this.renderPendingUploads();
      this.showToast(`PDF document "${file.name}" attached successfully.`, 'success');
    };
    reader.onerror = () => {
      this.showToast('Failed to read the selected PDF file.', 'error');
    };
    reader.readAsDataURL(file);
  }

  /**
   * Open the NOC Details and Document Gallery Modal
   */
  async openDetailsModal(id) {
    const record = await window.nocDB.getById(id);
    if (!record) return;

    const modal = document.getElementById('nocDetailsModal');
    const content = document.getElementById('nocDetailsContent');
    if (!modal || !content) return;

    const status = window.nocDB.getStatus(record.dateOfExpiration);
    let statusBadge = '';
    if (status === 'active') {
      statusBadge = `<span class="badge badge-active">Active</span>`;
    } else if (status === 'expiring') {
      statusBadge = `<span class="badge badge-expiring">Expiring Soon</span>`;
    } else {
      statusBadge = `<span class="badge badge-expired">Expired</span>`;
    }

    const docs = record.documents || [];
    const isAdmin = window.nocAuth.isAdmin();
    const isDeveloper = window.nocAuth && window.nocAuth.isDeveloper && window.nocAuth.isDeveloper();
    const canViewNocType = window.nocAuth && window.nocAuth.canViewNocType ? window.nocAuth.canViewNocType() : false;

    content.innerHTML = `
      <div class="details-grid">
        <div class="details-item">
          <span class="details-label">NOC Number</span>
          <span class="details-val" style="font-family:monospace; color:var(--primary-blue); font-size:1.1rem;">
            ${this.escapeHTML(record.nocNumber)}
          </span>
        </div>
        <div class="details-item">
          <span class="details-label">Status</span>
          <div>${statusBadge}</div>
        </div>
        ${canViewNocType ? `
          <div class="details-item">
            <span class="details-label">NOC Type</span>
            <span class="details-val">${this.escapeHTML(record.nocType)}</span>
          </div>
        ` : ''}
        <div class="details-item">
          <span class="details-label">Client</span>
          <span class="details-val">${this.escapeHTML(record.client || '—')}</span>
        </div>
        <div class="details-item">
          <span class="details-label">Issued To</span>
          <span class="details-val noc-issued-to-val">${this.escapeHTML((record.issuedTo || '').toUpperCase())}</span>
        </div>
        <div class="details-item">
          <span class="details-label">Validity Period</span>
          <span class="details-val">
            ${this.formatDate(record.dateOfIssuance)} &rarr; ${this.formatDate(record.dateOfExpiration)}
          </span>
        </div>
        <div class="details-item col-span-2">
          <span class="details-label">Description of Work</span>
          <div class="details-desc-box">${this.escapeHTML(record.description)}</div>
        </div>
      </div>

      <div style="margin-top:1.5rem;">
        <h4 style="font-size:1rem; font-weight:700; color:var(--text-main); margin-bottom:0.75rem;">
          Attached Documents &amp; Certificates
        </h4>

        ${docs.length === 0 ? `
          <p style="color:var(--text-muted); font-size:0.88rem; margin-top:0.75rem; font-style:italic;">
            No documents attached to this NOC record.
          </p>
        ` : `
          <div class="doc-gallery">
            ${docs.map((doc, idx) => {
      const isPDF = doc.type === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf');
      return `
                <div class="doc-card ${isPDF ? 'pdf' : 'image'}">
                  <div class="doc-card-icon">${isPDF ? '📄' : '🖼️'}</div>
                  <div class="doc-card-name" title="${this.escapeHTML(doc.name)}">${this.escapeHTML(doc.name)}</div>
                  <div class="doc-card-size">
                    ${this.formatBytes(doc.size)}
                  </div>
                  <div class="doc-card-actions">
                    <button class="btn btn-sm btn-primary" data-view-doc-idx="${idx}" title="Preview PDF / Document">
                      👁️ View
                    </button>
                    ${isAdmin ? `
                      <button class="btn btn-sm btn-outline" data-download-doc-idx="${idx}" title="Download File">
                        📥
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        `}
      </div>
    `;

    // Bind document preview clicks for all users (Admin & Guest)
    content.querySelectorAll('[data-view-doc-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-view-doc-idx'), 10);
        window.docViewer.open(docs, idx, `NOC Record: ${record.nocNumber}`);
      });
    });

    // Bind document download clicks for Admin
    if (isAdmin) {
      content.querySelectorAll('[data-download-doc-idx]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.getAttribute('data-download-doc-idx'), 10);
          const d = docs[idx];
          if (!d) return;
          window.docViewer.triggerFileDownload(d.dataUrl, `${record.nocNumber}_${d.name}`);
        });
      });
    }

    modal.classList.add('active');
  }

  /**
   * Close Details Modal
   */
  closeDetailsModal() {
    const modal = document.getElementById('nocDetailsModal');
    if (modal) modal.classList.remove('active');
  }

  /**
   * Open Delete Confirmation Modal
   */
  async openDeleteModal(id) {
    if (!window.nocAuth.canDelete()) {
      this.showToast('Admin privileges required to delete NOC records.', 'error');
      return;
    }

    const record = await window.nocDB.getById(id);
    if (!record) return;

    this.pendingDeleteId = id;
    const modal = document.getElementById('deleteConfirmModal');
    const msgEl = document.getElementById('deleteConfirmMessage');

    if (msgEl) {
      const canViewClient = window.nocAuth && window.nocAuth.canViewClient ? window.nocAuth.canViewClient() : false;
      const subtitle = canViewClient && record.client ? record.client : (record.issuedTo || record.nocType || '');
      msgEl.innerHTML = `Are you sure you want to delete NOC record <strong>"${this.escapeHTML(record.nocNumber)}"</strong>${subtitle ? ` (${this.escapeHTML(subtitle)})` : ''}? This action cannot be undone.`;
    }

    if (modal) modal.classList.add('active');
  }

  /**
   * Close Delete Modal
   */
  closeDeleteModal() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) modal.classList.remove('active');
    this.pendingDeleteId = null;
  }

  /**
   * Open Bulk Delete Confirmation Modal (Developer Only)
   */
  openBulkDeleteModal() {
    const isDeveloper = window.nocAuth && window.nocAuth.isDeveloper && window.nocAuth.isDeveloper();
    if (!isDeveloper) {
      this.showToast('Developer role required for bulk deletion.', 'error');
      return;
    }

    if (!this.selectedRecordIds || this.selectedRecordIds.size === 0) {
      this.showToast('Please select at least one NOC record to delete.', 'warning');
      return;
    }

    const modal = document.getElementById('bulkDeleteConfirmModal');
    const countEl = document.getElementById('bulkDeleteConfirmCount');
    const listEl = document.getElementById('bulkDeleteRecordsList');

    if (countEl) countEl.textContent = this.selectedRecordIds.size;

    if (listEl) {
      const allRecs = (window.nocApp && Array.isArray(window.nocApp.allRecords) && window.nocApp.allRecords.length > 0)
        ? window.nocApp.allRecords
        : (this.currentRecords || []);
      const selectedList = allRecs.filter(r => this.selectedRecordIds.has(r.id));

      let html = '';
      const previewLimit = 100;
      const previewItems = selectedList.slice(0, previewLimit);

      previewItems.forEach(r => {
        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:0.3rem 0; border-bottom:1px solid rgba(0,0,0,0.06);">
            <span style="font-weight:700; color:var(--text-main); font-size:0.84rem;">${this.escapeHTML(r.nocNumber || r.id)}</span>
            <span style="color:#64748B; font-size:0.78rem;">${this.escapeHTML((r.issuedTo || '').toUpperCase())}${r.client ? ` · ${this.escapeHTML(r.client)}` : ''}</span>
          </div>
        `;
      });

      if (selectedList.length > previewLimit) {
        html += `<div style="text-align:center; padding:0.4rem 0; color:var(--text-muted); font-size:0.75rem;">... and ${selectedList.length - previewLimit} more records</div>`;
      }

      listEl.innerHTML = html || '<div>No record preview available</div>';
    }

    if (modal) modal.classList.add('active');
  }

  /**
   * Close Bulk Delete Confirmation Modal
   */
  closeBulkDeleteModal() {
    const modal = document.getElementById('bulkDeleteConfirmModal');
    if (modal) modal.classList.remove('active');
  }

  /**
   * Clear all selected records
   */
  clearRecordSelection() {
    this.selectedRecordIds.clear();
    document.querySelectorAll('.noc-row-checkbox, .noc-grid-checkbox').forEach(cb => {
      cb.checked = false;
    });
    const selectAllCheckbox = document.getElementById('selectAllNocCheckbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
    this.updateSelectionUI();
  }

  /**
   * Update selection UI elements (counts, buttons, floating bar, select-all state)
   */
  updateSelectionUI() {
    const isDeveloper = window.nocAuth && window.nocAuth.isDeveloper && window.nocAuth.isDeveloper();
    const count = this.selectedRecordIds ? this.selectedRecordIds.size : 0;

    const bulkBtn = document.getElementById('btnBulkDeleteNoc');
    const bulkCountEl = document.getElementById('bulkDeleteSelectedCount');
    const floatingBar = document.getElementById('bulkSelectionFloatingBar');
    const floatingCountEl = document.getElementById('bulkFloatingCount');
    const thSelectAll = document.getElementById('thTableSelectAll');

    if (bulkCountEl) bulkCountEl.textContent = count;
    if (floatingCountEl) floatingCountEl.textContent = count;

    if (bulkBtn) {
      bulkBtn.style.display = isDeveloper ? 'inline-flex' : 'none';
      bulkBtn.disabled = (count === 0);
    }

    if (floatingBar) {
      floatingBar.style.display = (isDeveloper && count > 0) ? 'block' : 'none';
    }

    if (thSelectAll) {
      thSelectAll.style.display = isDeveloper ? '' : 'none';
    }

    document.querySelectorAll('.developer-select-col').forEach(el => {
      el.style.display = isDeveloper ? '' : 'none';
    });

    // Update Select All Checkbox state
    const selectAllCheckbox = document.getElementById('selectAllNocCheckbox');
    if (selectAllCheckbox && this.currentRecords && this.currentRecords.length > 0) {
      const allSelected = this.currentRecords.every(r => this.selectedRecordIds.has(r.id));
      const someSelected = this.currentRecords.some(r => this.selectedRecordIds.has(r.id));
      selectAllCheckbox.checked = allSelected;
      selectAllCheckbox.indeterminate = !allSelected && someSelected;
    } else if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
  }

  /**
   * Bind event listeners for Bulk Delete controls
   */
  bindBulkDeleteEvents() {
    // 1. Select All Checkbox in Table Header
    const selectAllCheckbox = document.getElementById('selectAllNocCheckbox');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        if (isChecked) {
          (this.currentRecords || []).forEach(r => this.selectedRecordIds.add(r.id));
        } else {
          (this.currentRecords || []).forEach(r => this.selectedRecordIds.delete(r.id));
        }
        document.querySelectorAll('.noc-row-checkbox, .noc-grid-checkbox').forEach(cb => {
          const id = cb.getAttribute('data-id');
          cb.checked = this.selectedRecordIds.has(id);
        });
        this.updateSelectionUI();
      });
    }

    // 2. Select All Visible button in floating bar
    const btnSelectAllVisible = document.getElementById('btnSelectAllVisible');
    if (btnSelectAllVisible) {
      btnSelectAllVisible.addEventListener('click', () => {
        (this.currentRecords || []).forEach(r => this.selectedRecordIds.add(r.id));
        document.querySelectorAll('.noc-row-checkbox, .noc-grid-checkbox').forEach(cb => {
          const id = cb.getAttribute('data-id');
          cb.checked = this.selectedRecordIds.has(id);
        });
        this.updateSelectionUI();
      });
    }

    // 3. Deselect All button in floating bar
    const btnDeselectAll = document.getElementById('btnDeselectAllRecords');
    if (btnDeselectAll) {
      btnDeselectAll.addEventListener('click', () => {
        this.clearRecordSelection();
      });
    }

    // 4. Open Bulk Delete Confirmation Modal (from controls bar or floating bar)
    const btnBulkDelete = document.getElementById('btnBulkDeleteNoc');
    const btnFloatingBulkDelete = document.getElementById('btnFloatingBulkDelete');

    const handleOpenBulkModal = () => {
      this.openBulkDeleteModal();
    };

    if (btnBulkDelete) btnBulkDelete.addEventListener('click', handleOpenBulkModal);
    if (btnFloatingBulkDelete) btnFloatingBulkDelete.addEventListener('click', handleOpenBulkModal);

    // 5. Bulk Delete Modal Close buttons
    const btnCloseBulkModal = document.getElementById('btnCloseBulkDeleteModal');
    const btnCancelBulkDelete = document.getElementById('btnCancelBulkDelete');

    if (btnCloseBulkModal) btnCloseBulkModal.addEventListener('click', () => this.closeBulkDeleteModal());
    if (btnCancelBulkDelete) btnCancelBulkDelete.addEventListener('click', () => this.closeBulkDeleteModal());

    // 6. Confirm Bulk Delete action
    const btnConfirmBulkDelete = document.getElementById('btnConfirmBulkDelete');
    if (btnConfirmBulkDelete) {
      btnConfirmBulkDelete.addEventListener('click', async () => {
        if (window.nocApp && typeof window.nocApp.bulkDeleteSelected === 'function') {
          await window.nocApp.bulkDeleteSelected();
        }
      });
    }
  }

  /**
   * Open Role Switch / Login Modal
   */
  openLoginModal(isMandatory = false) {
    const modal = document.getElementById('loginModal');
    const form = document.getElementById('loginForm');
    const closeBtn = document.getElementById('btnCloseLoginModal');
    const usernameInput = document.getElementById('loginUsername');
    const rememberMeCheckbox = document.getElementById('loginRememberMe');

    if (form) form.reset();
    this.resetPasswordInputState('loginPassword', 'btnToggleLoginPassword', 'Show password');

    // Prepopulate remembered username and checkbox state if previously saved
    try {
      const rememberedUser = localStorage.getItem('noc_remembered_username');
      if (rememberedUser && usernameInput) {
        usernameInput.value = rememberedUser;
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
      }
    } catch (e) {}

    const modalLogoutBtn = document.getElementById('btnModalLogout');
    if (modalLogoutBtn) {
      if (window.nocAuth && window.nocAuth.isLoggedIn()) {
        modalLogoutBtn.style.display = 'flex';
        modalLogoutBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.closeLoginModal(true);
          window.nocAuth.logout();
          this.showToast('You have been logged out. Returned to landing screen.', 'info');
        };
      } else {
        modalLogoutBtn.style.display = 'none';
      }
    }

    if (closeBtn) {
      closeBtn.style.display = 'inline-flex';
    }
    if (modal) modal.classList.add('active');
  }

  /**
   * Close Login Modal
   */
  closeLoginModal(force = false) {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('active');
  }

  /**
   * Download all documents attached to a record sequentially (Admin only)
   */
  async downloadAllRecordDocs(id) {
    if (window.nocAuth && window.nocAuth.isGuest()) {
      this.showToast('Guest accounts are not authorized to download certificate documents.', 'error');
      return;
    }

    const record = await window.nocDB.getById(id);
    if (!record || !record.documents || record.documents.length === 0) {
      this.showToast('No documents available to download.', 'info');
      return;
    }

    this.showToast(`Preparing download for ${record.documents.length} document(s)...`, 'info');

    for (let idx = 0; idx < record.documents.length; idx++) {
      const doc = record.documents[idx];
      let downloadData = doc.dataUrl;
      let downloadName = `${record.nocNumber}_${doc.name}`;

      setTimeout(() => {
        window.docViewer.triggerFileDownload(downloadData, downloadName);
      }, idx * 400);
    }
  }

  /**
   * Open the NOC Requirements Modal (supporting up to 5 documents)
   */
  async openRequirementsModal() {
    const modal = document.getElementById('nocRequirementsModal');
    const badgeEl = document.getElementById('reqDocCountBadge');
    const container = document.getElementById('reqDocumentsContainer');
    const adminUpload = document.getElementById('adminReqUploadSection');
    const guestNotice = document.getElementById('guestReqNotice');
    const isAdmin = window.nocAuth.isAdmin();

    const docs = await window.nocDB.getRequirementsDocs();

    // Update counter badge
    if (badgeEl) {
      badgeEl.textContent = `${docs.length} / 5 Documents`;
      badgeEl.style.background = docs.length >= 5 ? '#FEF3C7' : '#EFF6FF';
      badgeEl.style.color = docs.length >= 5 ? '#92400E' : '#1E40AF';
      badgeEl.style.borderColor = docs.length >= 5 ? '#FCD34D' : '#BFDBFE';
    }

    // Role-based section visibility
    if (adminUpload) {
      adminUpload.style.display = (isAdmin && docs.length < 5) ? 'block' : (isAdmin && docs.length >= 5 ? 'none' : 'none');
    }
    if (guestNotice) {
      guestNotice.style.display = isAdmin ? 'none' : 'block';
    }

    // Render document list
    if (container) {
      if (docs.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:2rem; background:var(--bg-subtle); border-radius:var(--radius-md); color:var(--text-muted);">
            <div style="font-size:2rem; margin-bottom:0.5rem;">📁</div>
            <p style="font-size:0.9rem;">No NOC requirement documents uploaded yet.</p>
            ${isAdmin ? '<p style="font-size:0.8rem; margin-top:0.25rem;">Use the upload area above to attach up to 5 guidelines.</p>' : ''}
          </div>
        `;
      } else {
        container.innerHTML = docs.map((doc, idx) => {
          const isPdf = (doc.type && doc.type.includes('pdf')) || (doc.name && doc.name.toLowerCase().endsWith('.pdf'));
          const isImg = (doc.type && doc.type.includes('image')) || (doc.name && doc.name.toLowerCase().match(/\.(png|jpg|jpeg|webp|svg)$/i));
          const isDocx = (doc.name && doc.name.toLowerCase().endsWith('.docx')) || (doc.type && doc.type.includes('wordprocessingml'));
          const isDoc = (doc.name && doc.name.toLowerCase().match(/\.(doc|rtf)$/i)) || (doc.type && doc.type.includes('msword'));
          const canPreview = isPdf || isImg;
          const badgeClass = isPdf ? 'pdf' : (isImg ? 'img' : 'doc');
          const badgeLabel = isPdf ? 'PDF' : (isImg ? 'IMG' : (isDocx ? 'DOCX' : (isDoc ? 'DOC' : 'FILE')));

          return `
            <div class="doc-list-item">
              <div class="doc-list-item-info">
                <span class="file-item-badge ${badgeClass}">${badgeLabel}</span>
                <div class="doc-list-item-text">
                  <div class="doc-list-item-title" title="${this.escapeHTML(doc.name)}">
                    ${this.escapeHTML(doc.name)}
                  </div>
                  <div class="doc-list-item-meta">
                    <span>${this.formatBytes(doc.size || 0)}</span>
                    <span>•</span>
                    <span>Uploaded: ${this.formatDate(doc.uploadedAt || new Date().toISOString())}</span>
                  </div>
                </div>
              </div>

              <div class="doc-list-item-actions">
                ${canPreview ? `
                  <button type="button" class="btn btn-outline-primary btn-action-view" data-preview-req-idx="${idx}" title="Preview Document">
                    👁️ View
                  </button>
                ` : ''}
                <button type="button" class="btn btn-outline btn-action-download" data-download-req-idx="${idx}" title="Download File">
                  📥 Download
                </button>
                ${isAdmin ? `
                  <button type="button" class="btn btn-danger btn-action-delete" data-delete-req-id="${doc.id}" title="Delete Document">
                    🗑️
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('');

        // Bind item action clicks
        container.querySelectorAll('[data-preview-req-idx]').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-preview-req-idx'), 10);
            window.docViewer.open(docs, idx, 'NOC Official Requirements');
          });
        });

        container.querySelectorAll('[data-download-req-idx]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const idx = parseInt(btn.getAttribute('data-download-req-idx'), 10);
            const d = docs[idx];
            if (!d) return;

            const isGuest = window.nocAuth && window.nocAuth.isGuest();
            const isPDF = (d.type && d.type.includes('pdf')) || (d.name && d.name.toLowerCase().endsWith('.pdf'));

            if (isGuest && isPDF) {
              const baseName = d.name.replace(/\.pdf$/i, '');
              const page1FileName = `Requirement_${baseName}_Page_1.pdf`;
              const blob = await window.docViewer.getFirstPagePdfBlob(d.dataUrl);
              if (blob) {
                window.docViewer.triggerFileDownload(blob, page1FileName);
              } else {
                const page1Url = await window.docViewer.getFirstPagePdfDataUrl(d.dataUrl);
                window.docViewer.triggerFileDownload(page1Url, page1FileName);
              }
            } else {
              window.docViewer.triggerFileDownload(d.dataUrl, d.name);
            }
          });
        });

        container.querySelectorAll('[data-delete-req-id]').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!window.nocAuth.isAdmin()) {
              this.showToast('Admin access required to delete requirement documents.', 'error');
              return;
            }
            const docId = btn.getAttribute('data-delete-req-id');
            await window.nocDB.deleteRequirementsDoc(docId);
            this.showToast('Requirement document removed.', 'info');
            await this.openRequirementsModal();
          });
        });
      }
    }

    if (modal) modal.classList.add('active');
  }

  /**
   * Close the NOC Requirements Modal
   */
  closeRequirementsModal() {
    const modal = document.getElementById('nocRequirementsModal');
    if (modal) modal.classList.remove('active');
  }

  /**
   * Open the SBYI COC Modal (supporting up to 8 PDF documents)
   */
  async openCocModal() {
    const modal = document.getElementById('sbyiCocModal');
    const badgeEl = document.getElementById('cocDocCountBadge');
    const container = document.getElementById('cocDocumentsContainer');
    const adminUpload = document.getElementById('adminCocUploadSection');
    const guestNotice = document.getElementById('guestCocNotice');
    const isAdmin = window.nocAuth.isAdmin();
    const isGuest = window.nocAuth.isGuest();

    const docs = await window.nocDB.getCocDocs();

    // Update counter badge
    if (badgeEl) {
      badgeEl.textContent = `${docs.length} / 8 PDF Documents`;
      badgeEl.style.background = docs.length >= 8 ? '#FEF3C7' : '#EFF6FF';
      badgeEl.style.color = docs.length >= 8 ? '#92400E' : '#1E40AF';
      badgeEl.style.borderColor = docs.length >= 8 ? '#FCD34D' : '#BFDBFE';
    }

    // Role-based section visibility
    if (adminUpload) {
      adminUpload.style.display = (isAdmin && docs.length < 8) ? 'block' : 'none';
    }
    if (guestNotice) {
      guestNotice.style.display = isAdmin ? 'none' : 'block';
    }

    // Render document list
    if (container) {
      if (docs.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:2rem; background:var(--bg-subtle); border-radius:var(--radius-md); color:var(--text-muted);">
            <div style="font-size:2rem; margin-bottom:0.5rem;">📜</div>
            <p style="font-size:0.9rem;">No SBYI COC documents uploaded yet.</p>
            ${isAdmin ? '<p style="font-size:0.8rem; margin-top:0.25rem;">Use the upload area above to attach up to 8 PDF documents.</p>' : ''}
          </div>
        `;
      } else {
        container.innerHTML = docs.map((doc, idx) => {
          return `
            <div class="doc-list-item">
              <div class="doc-list-item-info">
                <span class="file-item-badge pdf">PDF</span>
                <div class="doc-list-item-text">
                  <div class="doc-list-item-title" title="${this.escapeHTML(doc.name)}">
                    ${this.escapeHTML(doc.name)}
                  </div>
                  <div class="doc-list-item-meta">
                    <span>${this.formatBytes(doc.size || 0)}</span>
                    <span>•</span>
                    <span>Uploaded: ${this.formatDate(doc.uploadedAt || new Date().toISOString())}</span>
                  </div>
                </div>
              </div>

              <div class="doc-list-item-actions">
                <button type="button" class="btn btn-outline-primary btn-action-view" data-preview-coc-idx="${idx}" title="Preview Complete Document">
                  👁️ View
                </button>
                <button type="button" class="btn btn-outline btn-action-download" data-download-coc-idx="${idx}" title="Download File">
                  📥 Download
                </button>
                ${isAdmin ? `
                  <button type="button" class="btn btn-danger btn-action-delete" data-delete-coc-id="${doc.id}" title="Delete Document">
                    🗑️
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('');

        // Bind item action clicks
        container.querySelectorAll('[data-preview-coc-idx]').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-preview-coc-idx'), 10);
            window.docViewer.open(docs, idx, 'SBYI Code of Conduct (COC)', { allowFullPages: true });
          });
        });

        container.querySelectorAll('[data-download-coc-idx]').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-download-coc-idx'), 10);
            const d = docs[idx];
            if (d) {
              window.docViewer.triggerFileDownload(d.dataUrl, d.name);
            }
          });
        });

        container.querySelectorAll('[data-delete-coc-id]').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!window.nocAuth.isAdmin()) {
              this.showToast('Admin access required to delete SBYI COC documents.', 'error');
              return;
            }
            const docId = btn.getAttribute('data-delete-coc-id');
            await window.nocDB.deleteCocDoc(docId);
            this.showToast('SBYI COC document removed.', 'info');
            await this.openCocModal();
          });
        });
      }
    }

    if (modal) modal.classList.add('active');
  }

  /**
   * Close the SBYI COC Modal
   */
  closeCocModal() {
    const modal = document.getElementById('sbyiCocModal');
    if (modal) modal.classList.remove('active');
  }

  /**
   * Open the AI Documents Modal (DOC, DOCX, PDF - Admin Only)
   */
  async openAiDocumentsModal() {
    const modal = document.getElementById('aiDocumentsModal');
    const badgeEl = document.getElementById('aiDocCountBadge');
    const container = document.getElementById('aiDocumentsContainer');
    const adminUpload = document.getElementById('adminAiDocUploadSection');
    const isAdmin = window.nocAuth && window.nocAuth.canManageAiDocs();

    const docs = await window.nocDB.getAiDocs();

    // Update counter badge
    if (badgeEl) {
      badgeEl.textContent = `${docs.length} ${docs.length === 1 ? 'Document' : 'Documents'}`;
      badgeEl.style.background = docs.length > 0 ? '#EEF2FF' : '#F1F5F9';
      badgeEl.style.color = docs.length > 0 ? '#4F46E5' : '#64748B';
      badgeEl.style.borderColor = docs.length > 0 ? '#C7D2FE' : '#CBD5E1';
    }

    // Role-based section visibility (Admin only)
    if (adminUpload) {
      adminUpload.style.display = isAdmin ? 'block' : 'none';
    }

    // Render document list
    if (container) {
      if (docs.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:2.5rem 1.5rem; background:var(--bg-subtle); border-radius:var(--radius-md); color:var(--text-muted); border:1px dashed var(--border-light);">
            <div style="font-size:2.2rem; margin-bottom:0.5rem;">🤖</div>
            <p style="font-size:0.95rem; font-weight:600; color:var(--text-main);">No AI Documents Uploaded Yet</p>
            <p style="font-size:0.82rem; margin-top:0.35rem;">Use the upload area above to attach DOC, DOCX, or PDF files to the SBYIM AI Knowledge Base.</p>
          </div>
        `;
      } else {
        container.innerHTML = docs.map((doc, idx) => {
          const isPdf = (doc.type && doc.type.includes('pdf')) || (doc.name && doc.name.toLowerCase().endsWith('.pdf'));
          const isDocx = (doc.name && doc.name.toLowerCase().endsWith('.docx')) || (doc.type && doc.type.includes('wordprocessingml'));
          const isDoc = (doc.name && doc.name.toLowerCase().endsWith('.doc')) || (doc.type && doc.type.includes('msword'));
          const badgeClass = isPdf ? 'pdf' : (isDocx ? 'docx' : 'doc');
          const badgeLabel = isPdf ? 'PDF' : (isDocx ? 'DOCX' : 'DOC');
          const canPreview = isPdf;

          return `
            <div class="doc-list-item">
              <div class="doc-list-item-info">
                <span class="file-item-badge ${badgeClass}">${badgeLabel}</span>
                <div class="doc-list-item-text">
                  <div class="doc-list-item-title" title="${this.escapeHTML(doc.name)}">
                    ${this.escapeHTML(doc.name)}
                  </div>
                  <div class="doc-list-item-meta">
                    <span>${this.formatBytes(doc.size || 0)}</span>
                    <span>•</span>
                    <span>Uploaded: ${this.formatDate(doc.uploadedAt || new Date().toISOString())}</span>
                    <span>•</span>
                    <span style="color:#4F46E5; font-weight:600;">✨ Grounded in AI</span>
                  </div>
                </div>
              </div>

              <div class="doc-list-item-actions">
                ${canPreview ? `
                  <button type="button" class="btn btn-outline-primary btn-action-view" data-preview-aidoc-idx="${idx}" title="Preview Document">
                    👁️ View
                  </button>
                ` : ''}
                <button type="button" class="btn btn-outline btn-action-download" data-download-aidoc-idx="${idx}" title="Download File">
                  📥 Download
                </button>
                ${isAdmin ? `
                  <button type="button" class="btn btn-danger btn-action-delete" data-delete-aidoc-id="${doc.id}" title="Delete Document">
                    🗑️
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('');

        // Bind item action clicks
        container.querySelectorAll('[data-preview-aidoc-idx]').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-preview-aidoc-idx'), 10);
            window.docViewer.open(docs, idx, 'AI Knowledge Base Documents', { allowFullPages: true });
          });
        });

        container.querySelectorAll('[data-download-aidoc-idx]').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-download-aidoc-idx'), 10);
            const d = docs[idx];
            if (d) {
              window.docViewer.triggerFileDownload(d.dataUrl, d.name);
            }
          });
        });

        container.querySelectorAll('[data-delete-aidoc-id]').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!window.nocAuth.canManageAiDocs()) {
              this.showToast('Admin privileges required to delete AI documents.', 'error');
              return;
            }
            const docId = btn.getAttribute('data-delete-aidoc-id');
            await window.nocDB.deleteAiDoc(docId);
            this.showToast('AI document removed from Knowledge Base.', 'info');
            await this.openAiDocumentsModal();
          });
        });
      }
    }

    if (modal) modal.classList.add('active');
  }

  /**
   * Close the AI Documents Modal
   */
  closeAiDocumentsModal() {
    const modal = document.getElementById('aiDocumentsModal');
    if (modal) modal.classList.remove('active');
  }

  /**
   * Returns the complete PostgreSQL Schema SQL string
   */
  getSqlSchemaText() {
    return `-- ============================================================================
-- SBYIM NOC PORTAL - SUPABASE / POSTGRESQL DATABASE SCHEMA
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLE: noc_records (Main NOC Certificate & Permit Registry)
CREATE TABLE IF NOT EXISTS public.noc_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    noc_number VARCHAR(100) UNIQUE NOT NULL,
    noc_type VARCHAR(100) NOT NULL DEFAULT 'Activity',
    client VARCHAR(255) NOT NULL,
    issued_to VARCHAR(255) NOT NULL,
    company_code VARCHAR(100),
    date_of_issuance DATE NOT NULL,
    date_of_expiration DATE NOT NULL,
    description TEXT,
    documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_noc_records_noc_number ON public.noc_records (noc_number);
CREATE INDEX IF NOT EXISTS idx_noc_records_noc_type ON public.noc_records (noc_type);
CREATE INDEX IF NOT EXISTS idx_noc_records_client ON public.noc_records (client);
CREATE INDEX IF NOT EXISTS idx_noc_records_issued_to ON public.noc_records (issued_to);
CREATE INDEX IF NOT EXISTS idx_noc_records_date_issuance ON public.noc_records (date_of_issuance DESC);
CREATE INDEX IF NOT EXISTS idx_noc_records_date_expiration ON public.noc_records (date_of_expiration ASC);
CREATE INDEX IF NOT EXISTS idx_noc_records_created_at ON public.noc_records (created_at DESC);

-- 2. TABLE: noc_requirements_docs (Official Guidelines & Compliance Files)
CREATE TABLE IF NOT EXISTS public.noc_requirements_docs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL DEFAULT 0,
    data_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    uploaded_by VARCHAR(255) NOT NULL DEFAULT 'System Administrator'
);

CREATE INDEX IF NOT EXISTS idx_noc_req_docs_uploaded_at ON public.noc_requirements_docs (uploaded_at DESC);

-- 3. TABLE: sbyi_coc_docs (SBYI Code of Conduct (COC) PDF Documents)
CREATE TABLE IF NOT EXISTS public.sbyi_coc_docs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    size BIGINT NOT NULL DEFAULT 0,
    data_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    uploaded_by VARCHAR(255) NOT NULL DEFAULT 'SBYI Management'
);

CREATE INDEX IF NOT EXISTS idx_sbyi_coc_docs_uploaded_at ON public.sbyi_coc_docs (uploaded_at DESC);

-- 4. TABLE: ai_documents (Dedicated AI Knowledge Base Documents: DOC, DOCX, PDF)
CREATE TABLE IF NOT EXISTS public.ai_documents (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL DEFAULT 0,
    data_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    uploaded_by VARCHAR(255) NOT NULL DEFAULT 'System Administrator'
);

CREATE INDEX IF NOT EXISTS idx_ai_docs_uploaded_at ON public.ai_documents (uploaded_at DESC);

-- 5. TABLE: noc_custom_types (Dynamic NOC Categories)
CREATE TABLE IF NOT EXISTS public.noc_custom_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_noc_custom_types_name ON public.noc_custom_types (name);

-- 6. TABLE: noc_custom_contractors (Dynamic Contractors & Companies)
CREATE TABLE IF NOT EXISTS public.noc_custom_contractors (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_noc_custom_contractors_name ON public.noc_custom_contractors (name);

-- 7. TABLE: noc_settings (System Preferences & Dynamic Configs)
CREATE TABLE IF NOT EXISTS public.noc_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. TABLE: noc_users (User Database & Role Accounts)
CREATE TABLE IF NOT EXISTS public.noc_users (
    username VARCHAR(100) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'guest',
    display_name VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_noc_users_role ON public.noc_users (role);

-- 9. AUTOMATIC TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_noc_records_updated_at ON public.noc_records;
CREATE TRIGGER trg_noc_records_updated_at
    BEFORE UPDATE ON public.noc_records
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_noc_users_updated_at ON public.noc_users;
CREATE TRIGGER trg_noc_users_updated_at
    BEFORE UPDATE ON public.noc_users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_noc_settings_updated_at ON public.noc_settings;
CREATE TRIGGER trg_noc_settings_updated_at
    BEFORE UPDATE ON public.noc_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 10. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.noc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noc_requirements_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbyi_coc_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noc_custom_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noc_custom_contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noc_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noc_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on noc_records" ON public.noc_records;
CREATE POLICY "Allow all operations on noc_records" ON public.noc_records FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on noc_requirements_docs" ON public.noc_requirements_docs;
CREATE POLICY "Allow all operations on noc_requirements_docs" ON public.noc_requirements_docs FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on sbyi_coc_docs" ON public.sbyi_coc_docs;
CREATE POLICY "Allow all operations on sbyi_coc_docs" ON public.sbyi_coc_docs FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on ai_documents" ON public.ai_documents;
CREATE POLICY "Allow all operations on ai_documents" ON public.ai_documents FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on noc_custom_types" ON public.noc_custom_types;
CREATE POLICY "Allow all operations on noc_custom_types" ON public.noc_custom_types FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on noc_custom_contractors" ON public.noc_custom_contractors;
CREATE POLICY "Allow all operations on noc_custom_contractors" ON public.noc_custom_contractors FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on noc_settings" ON public.noc_settings;
CREATE POLICY "Allow all operations on noc_settings" ON public.noc_settings FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on noc_users" ON public.noc_users;
CREATE POLICY "Allow all operations on noc_users" ON public.noc_users FOR ALL TO public USING (true) WITH CHECK (true);

INSERT INTO public.noc_custom_types (name) VALUES 
    ('Activity'), ('Activity NOC'), ('Berthing NOC'), ('Construction Camp Site Approval'), 
    ('Construction Camp Size & Location Approval'), ('Construction NOC'), ('Design and Build NOC'), 
    ('Maintenance Activity'), ('Maintenance NOC'), ('Marine Survey NOC'), ('O&M NOC'), 
    ('Operation & Maintenance NOC'), ('Site Visit & Meeting'), ('Temporary Occupancy Certificate')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.noc_custom_contractors (name)
VALUES
    ('GULF DUNES LANDSCAPING & AGRICULTURAL SERVICES, AN ESG COMPANY (GDL)'),
    ('NETKOM COMMUNICATIONS TECHNOLOGY LLC (NCT)'),
    ('ARABIC ENGINEER CONTROL & ELECTRO MECHANICAL SYSTEMS CO L.L.C. (AECEMS)'),
    ('APEX ENGINEERING & INFRASTRUCTURE LTD.'),
    ('TRANS-GULF CONTRACTING CO.'),
    ('PIONEER DEMOLITION SPECIALISTS LLC'),
    ('SKYLINE ELECTROMECHANICAL SERVICES'),
    ('METROPOLITAN BUILDERS CORP.'),
    ('AL JABER BUILDING LLC'),
    ('ARABTEC CONSTRUCTION'),
    ('SIX CONSTRUCT'),
    ('ISLAND SECURITY SERVICES'),
    ('INSPIRE INTEGRATED INFRASTRUCTURE MANAGEMENT'),
    ('DELMA MARINE TRANSPORT & LOGISTICS'),
    ('NATIONAL MARINE DREDGING COMPANY (NMDC)'),
    ('EMIRATES UTILITIES & DESALINATION'),
    ('ETISALAT TELECOMMUNICATIONS SERVICES'),
    ('ABU DHABI DISTRIBUTION COMPANY (ADDC)')
ON CONFLICT (name) DO NOTHING;

DELETE FROM public.noc_users WHERE lower(username) IN ('admin', 'guest', 'developer', 'main');

INSERT INTO public.noc_users (username, password, role, display_name, email)
VALUES
    ('ryan', 'spider06', 'developer', 'Ryan Ortiz (Developer)', ''),
    ('SBYIM', 'NOC#2022#', 'admin', 'SBYI Management', ''),
    ('security', 'sec@2024', 'security', 'SBYIM Security Officer', ''),
    ('Employee01', '666666@', 'employee', 'Island Security', ''),
    ('Employee02', '777777#', 'employee', 'Inspire Integrated', ''),
    ('1GDL', '55555', 'guest', 'Gulf Dunes Landscapping', '')
ON CONFLICT (username) DO UPDATE
SET password = EXCLUDED.password,
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email;`;
  }

  /**
   * Render top navbar database status badge and inside modal status card
   */
  renderDatabaseStatus() {
    const isAiven = window.nocDB && window.nocDB.isAivenActive();
    const isAivenConnecting = window.nocDB && window.nocDB.isAivenConnecting;
    const isConfigured = window.supabaseManager && window.supabaseManager.isConfigured();
    const isConnected = window.supabaseManager && window.supabaseManager.isConnected;

    const dotEl = document.getElementById('dbStatusDot');
    const textEl = document.getElementById('dbStatusText');
    const iconEl = document.getElementById('dbStatusIcon');
    const headEl = document.getElementById('dbStatusHeading');
    const pillEl = document.getElementById('dbStatusPill');
    const msgEl = document.getElementById('dbStatusMessage');

    // Aiven Server section elements
    const hostDisp = document.getElementById('aivenHostDisplay');
    const portDbDisp = document.getElementById('aivenPortDbDisplay');
    const backendDisp = document.getElementById('aivenBackendDisplay');
    const latencyDisp = document.getElementById('aivenLatencyDisplay');

    const cntNoc = document.getElementById('cntNocRecords');
    const cntReq = document.getElementById('cntReqDocs');
    const cntCoc = document.getElementById('cntCocDocs');
    const cntAi = document.getElementById('cntAiDocs');
    const cntTypes = document.getElementById('cntCustomTypes');
    const cntContractors = document.getElementById('cntContractors');
    const cntUsers = document.getElementById('cntUsers');

    if (isAiven) {
      if (dotEl) {
        dotEl.className = 'db-status-dot connected';
      }
      if (textEl) textEl.textContent = 'Aiven: Connected';

      if (iconEl) iconEl.textContent = '🟢';
      if (headEl) headEl.textContent = 'Connected to Aiven PostgreSQL Cloud';
      if (pillEl) {
        pillEl.textContent = 'Aiven Cloud DB (Live)';
        pillEl.style.background = '#DCFCE7';
        pillEl.style.color = '#15803D';
      }
      const host = (window.nocDB && window.nocDB.aivenHost) || 'pg2026-noc-ryansbyi-noc.f.aivencloud.com';
      const port = (window.nocDB && window.nocDB.aivenPort) || 13029;
      const database = (window.nocDB && window.nocDB.aivenDatabase) || 'defaultdb';
      const counts = (window.nocDB && window.nocDB.aivenCounts) || {};
      const nocCount = counts.noc_records !== undefined ? counts.noc_records : '394';

      if (msgEl) {
        msgEl.textContent = `Active cloud database connection established to Aiven PostgreSQL (${host}:${port}). All ${nocCount} NOC records, documents, and accounts are live & synchronized.`;
      }

      if (hostDisp) hostDisp.textContent = host;
      if (portDbDisp) portDbDisp.textContent = `${port} / ${database}`;
      if (backendDisp) {
        backendDisp.textContent = `${window.nocDB.apiBaseUrl || 'http://localhost:3000'} (Online)`;
        backendDisp.style.color = '#15803D';
      }
      if (latencyDisp) {
        latencyDisp.textContent = 'Connected (Healthy)';
        latencyDisp.style.color = '#15803D';
      }

      if (cntNoc) cntNoc.textContent = counts.noc_records !== undefined ? counts.noc_records : '394';
      if (cntReq) cntReq.textContent = counts.noc_requirements_docs !== undefined ? counts.noc_requirements_docs : '4';
      if (cntCoc) cntCoc.textContent = counts.sbyi_coc_docs !== undefined ? counts.sbyi_coc_docs : '3';
      if (cntAi) cntAi.textContent = counts.ai_documents !== undefined ? counts.ai_documents : '3';
      if (cntTypes) cntTypes.textContent = counts.noc_custom_types !== undefined ? counts.noc_custom_types : '14';
      if (cntContractors) cntContractors.textContent = counts.noc_custom_contractors !== undefined ? counts.noc_custom_contractors : '19';
      if (cntUsers) cntUsers.textContent = counts.noc_users !== undefined ? counts.noc_users : '6';

    } else if (isAivenConnecting) {
      if (dotEl) {
        dotEl.className = 'db-status-dot connecting';
      }
      if (textEl) textEl.textContent = 'Aiven: Connecting...';

      if (iconEl) iconEl.textContent = '🟡';
      if (headEl) headEl.textContent = 'Connecting to Aiven Cloud Database...';
      if (pillEl) {
        pillEl.textContent = 'Connecting';
        pillEl.style.background = '#EFF6FF';
        pillEl.style.color = '#1D4ED8';
      }
      if (msgEl) {
        msgEl.textContent = 'Establishing secure connection to Aiven PostgreSQL cloud database (pg2026-noc-ryansbyi-noc.f.aivencloud.com:13029)...';
      }
      if (backendDisp) {
        backendDisp.textContent = 'Connecting...';
        backendDisp.style.color = '#B45309';
      }
      if (latencyDisp) {
        latencyDisp.textContent = 'Probing Aiven Cloud...';
        latencyDisp.style.color = '#B45309';
      }
    } else if (isConnected) {
      if (dotEl) {
        dotEl.className = 'db-status-dot connected';
      }
      if (textEl) textEl.textContent = 'Supabase: Connected';

      if (iconEl) iconEl.textContent = '🟢';
      if (headEl) headEl.textContent = 'Connected to Supabase PostgreSQL';
      if (pillEl) {
        pillEl.textContent = 'Cloud PostgreSQL';
        pillEl.style.background = '#DCFCE7';
        pillEl.style.color = '#15803D';
      }
      if (msgEl) {
        const url = window.supabaseManager.getUrl();
        msgEl.textContent = `Active connection established to: ${url}. All operations are syncing in real-time.`;
      }
    } else if (isConfigured) {
      if (dotEl) {
        dotEl.className = 'db-status-dot disconnected';
      }
      if (textEl) textEl.textContent = 'Supabase: Connecting...';

      if (iconEl) iconEl.textContent = '🟡';
      if (headEl) headEl.textContent = 'Connecting to Supabase...';
      if (pillEl) {
        pillEl.textContent = 'Connecting';
        pillEl.style.background = '#FEF3C7';
        pillEl.style.color = '#B45309';
      }
      if (msgEl) {
        msgEl.textContent = 'Credentials configured. Testing connection with Supabase backend.';
      }
    } else {
      if (dotEl) {
        dotEl.className = 'db-status-dot';
      }
      if (textEl) textEl.textContent = 'Database: Local';

      if (iconEl) iconEl.textContent = '🟡';
      if (headEl) headEl.textContent = 'Local Persistent Storage Mode';
      if (pillEl) {
        pillEl.textContent = 'Offline / Local';
        pillEl.style.background = '#FEF3C7';
        pillEl.style.color = '#B45309';
      }
      if (msgEl) {
        msgEl.textContent = "Data is stored securely in your browser's IndexedDB and localStorage. Connect Aiven or Supabase to enable cloud sync and PostgreSQL persistence.";
      }
      if (backendDisp) {
        backendDisp.textContent = 'Offline / Standalone';
        backendDisp.style.color = '#B45309';
      }
      if (latencyDisp) {
        latencyDisp.textContent = 'Local Mode';
        latencyDisp.style.color = '#B45309';
      }
    }

    const btnDatabaseConfig = document.getElementById('btnDatabaseConfig');
    const showDbBadge = window.nocAuth && window.nocAuth.canShowDatabaseBadge();
    if (btnDatabaseConfig) {
      btnDatabaseConfig.style.display = showDbBadge ? 'inline-flex' : 'none';
      btnDatabaseConfig.disabled = !showDbBadge;
    }
  }

  /**
   * Open the Database Configuration Modal (Admin Only)
   */
  async openDatabaseModal() {
    if (!window.nocAuth || !window.nocAuth.canManageDatabase()) {
      this.showToast('System Administrator access required for Database Settings.', 'error');
      return;
    }
    const modal = document.getElementById('databaseModal');
    const urlInput = document.getElementById('inputSupabaseUrl');
    const keyInput = document.getElementById('inputSupabaseKey');
    const codeBlock = document.getElementById('sqlSchemaCodeBlock');
    const credentialsSection = document.getElementById('supabaseCredentialsSection');
    const syncSection = document.getElementById('supabaseSyncSection');
    const schemaSection = document.getElementById('supabaseSchemaSection');

    if (credentialsSection) {
      credentialsSection.style.display = 'block';
    }
    if (syncSection) {
      syncSection.style.display = 'block';
    }
    if (schemaSection) {
      schemaSection.style.display = 'block';
    }

    if (urlInput && window.supabaseManager) {
      urlInput.value = window.supabaseManager.getUrl() || '';
    }
    if (keyInput && window.supabaseManager) {
      keyInput.value = window.supabaseManager.getAnonKey() || '';
    }
    if (codeBlock) {
      codeBlock.textContent = this.getSqlSchemaText();
    }

    this.renderDatabaseStatus();
    this.resetPasswordInputState('inputSupabaseKey', 'btnToggleSupabaseKey', 'Show API key');
    if (modal) modal.classList.add('active');

    // Live refresh Aiven status from server in background
    if (window.nocDB && window.nocDB.checkAivenStatus) {
      window.nocDB.checkAivenStatus(true).then(() => {
        this.renderDatabaseStatus();
      }).catch(() => {});
    }
  }

  /**
   * Close the Supabase Database Configuration Modal
   */
  closeDatabaseModal() {
    const modal = document.getElementById('databaseModal');
    if (modal) modal.classList.remove('active');
  }

  // ==========================================================================
  // USER DATABASE MANAGEMENT UI (Admin Only)
  // ==========================================================================

  /**
   * Open the User Database Management Modal (Admin Only)
   */
  async openUserDatabaseModal() {
    if (!window.nocAuth || !window.nocAuth.canManageUsers()) {
      this.showToast('Access Denied: Only Administrator accounts can access the User Database.', 'error');
      return;
    }

    const modal = document.getElementById('userDatabaseModal');
    const searchInput = document.getElementById('userDbSearchInput');
    if (searchInput) searchInput.value = '';

    if (modal) modal.classList.add('active');
    await this.refreshUserDatabaseView();
  }

  /**
   * Close the User Database Management Modal
   */
  closeUserDatabaseModal() {
    const modal = document.getElementById('userDatabaseModal');
    if (modal) modal.classList.remove('active');
  }

  /**
   * Render or refresh the User Database table
   */
  async refreshUserDatabaseView(searchTerm = '') {
    const tbody = document.getElementById('userDbTableBody');
    const emptyState = document.getElementById('userDbEmptyState');
    const countLabel = document.getElementById('userDbCountLabel');
    if (!tbody || !window.nocDB) return;

    try {
      const users = await window.nocDB.getUsers();
      const term = String(searchTerm || '').toLowerCase().trim();

      const filtered = (users || []).filter(u => {
        if (!term) return true;
        return (
          (u.username && u.username.toLowerCase().includes(term)) ||
          (u.displayName && u.displayName.toLowerCase().includes(term)) ||
          (u.role && u.role.toLowerCase().includes(term)) ||
          (u.email && u.email.toLowerCase().includes(term))
        );
      });

      if (countLabel) {
        countLabel.innerHTML = `Total Registered Users: <strong>${users.length}</strong>${term ? ` (Showing ${filtered.length} matches)` : ''}`;
      }

      if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      tbody.innerHTML = filtered.map(u => {
        const isMasterAccount = u.username.toLowerCase() === 'ryan';
        let roleClass = 'badge-guest';
        let roleLabel = 'Guest';
        let avatarIcon = '👤';
        let avatarClass = 'guest';

        if (u.role === 'admin') {
          roleClass = 'badge-admin';
          roleLabel = 'Admin';
          avatarIcon = '🛡️';
          avatarClass = 'admin';
        } else if (u.role === 'developer') {
          roleClass = 'badge-developer';
          roleLabel = 'Developer';
          avatarIcon = '💻';
          avatarClass = 'developer';
        } else if (u.role === 'security') {
          roleClass = 'badge-security';
          roleLabel = 'Security';
          avatarIcon = '👮';
          avatarClass = 'security';
        } else if (u.role === 'main' || u.role === 'employee') {
          roleClass = 'badge-employee';
          roleLabel = 'Employee';
          avatarIcon = '💼';
          avatarClass = 'employee';
        }

        const escapedUsername = this.escapeHTML(u.username);
        const escapedPassword = this.escapeHTML(u.password);
        const escapedDisplayName = this.escapeHTML(u.displayName || u.display_name || u.username);

        return `
          <tr data-username="${escapedUsername}">
            <td>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <div class="user-avatar-pill ${avatarClass}">
                  ${avatarIcon}
                </div>
                <div>
                  <strong style="font-size:0.9rem; color:var(--text-main); font-family:'JetBrains Mono', monospace;">${escapedUsername}</strong>
                  ${isMasterAccount ? '<span class="master-badge" style="display:inline-block; margin-left:0.3rem; font-size:0.68rem; padding:0.1rem 0.35rem; background:#DCFCE7; color:#166534; border-radius:9999px; font-weight:700;">Master Developer</span>' : ''}
                </div>
              </div>
            </td>
            <td>
              <div class="password-cell-box" style="display:flex; align-items:center; gap:0.35rem;">
                <code class="user-pwd-text" data-password="${escapedPassword}" style="background:#F1F5F9; color:#0F172A; padding:0.2rem 0.45rem; border-radius:4px; font-size:0.84rem; font-family:'JetBrains Mono', monospace; letter-spacing:0.5px;">${escapedPassword}</code>
                <button type="button" class="btn btn-sm btn-icon btn-copy-pwd" title="Copy password" data-clipboard="${escapedPassword}" style="padding:0.2rem 0.35rem; font-size:0.75rem; border:none; background:transparent; cursor:pointer;">
                  📋
                </button>
              </div>
            </td>
            <td>
              <span style="font-size:0.88rem; color:var(--text-main); font-weight:500;">${escapedDisplayName}</span>
            </td>
            <td>
              <span class="user-role-badge ${roleClass}">${roleLabel}</span>
            </td>
            <td style="text-align:center;">
              <div style="display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                <button type="button" class="btn btn-sm btn-outline btn-edit-user" data-username="${escapedUsername}" title="Edit User Credentials" style="padding:0.25rem 0.55rem; font-size:0.78rem;">
                  ✏️ Edit
                </button>
                <button type="button" class="btn btn-sm btn-danger btn-delete-user" data-username="${escapedUsername}" ${isMasterAccount ? 'disabled title="Primary Developer account cannot be deleted"' : `onclick="window.nocUI.openUserDeleteModal('${escapedUsername}')" title="Delete User Account"`} style="padding:0.25rem 0.55rem; font-size:0.78rem; ${isMasterAccount ? 'opacity:0.4; cursor:not-allowed;' : ''}">
                  🗑️ Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.warn('Error refreshing User Database table:', e);
      this.showToast('Could not load user accounts: ' + e.message, 'error');
    }
  }

  /**
   * Open the Add/Edit User sub-modal
   */
  openUserEditModal(user = null) {
    const modal = document.getElementById('userEditModal');
    const titleEl = document.getElementById('userEditModalTitle');
    const subtitleEl = document.getElementById('userEditModalSubtitle');
    const isEditModeInput = document.getElementById('userEditIsEditMode');
    const origUsernameInput = document.getElementById('userEditOriginalUsername');
    const usernameInput = document.getElementById('userFormUsername');
    const passwordInput = document.getElementById('userFormPassword');
    const displayNameInput = document.getElementById('userFormDisplayName');
    const roleSelect = document.getElementById('userFormRole');

    if (!modal) return;

    if (user) {
      if (titleEl) titleEl.textContent = 'Edit User: ' + user.username;
      if (subtitleEl) subtitleEl.textContent = 'Update username, password, display name, and access role';
      if (isEditModeInput) isEditModeInput.value = 'true';
      if (origUsernameInput) origUsernameInput.value = user.username;
      if (usernameInput) {
        usernameInput.value = user.username;
        usernameInput.readOnly = false;
        usernameInput.style.background = '';
      }
      if (passwordInput) passwordInput.value = user.password || '';
      if (displayNameInput) displayNameInput.value = user.displayName || user.display_name || '';
      if (roleSelect) roleSelect.value = (user.role === 'main' ? 'employee' : user.role) || 'guest';
    } else {
      if (titleEl) titleEl.textContent = 'Add New User';
      if (subtitleEl) subtitleEl.textContent = 'Enter portal account credentials and access role';
      if (isEditModeInput) isEditModeInput.value = 'false';
      if (origUsernameInput) origUsernameInput.value = '';
      if (usernameInput) {
        usernameInput.value = '';
        usernameInput.readOnly = false;
        usernameInput.style.background = '';
      }
      if (passwordInput) passwordInput.value = '';
      if (displayNameInput) displayNameInput.value = '';
      if (roleSelect) roleSelect.value = 'guest';
    }

    this.resetPasswordInputState('userFormPassword', 'btnToggleUserFormPassword', 'Show password');
    modal.classList.add('active');
    setTimeout(() => {
      if (user && passwordInput) {
        passwordInput.focus();
      } else if (usernameInput) {
        usernameInput.focus();
      }
    }, 100);
  }

  /**
   * Reset Password Visibility and Icon State Helper
   */
  resetPasswordInputState(inputId, btnId, defaultTitle = 'Show password') {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (input) input.type = 'password';
    if (btn) {
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
      btn.title = defaultTitle;
      btn.setAttribute('aria-label', defaultTitle);
      btn.classList.remove('active');
    }
  }

  /**
   * Close the Add/Edit User sub-modal
   */
  closeUserEditModal() {
    const modal = document.getElementById('userEditModal');
    if (modal) modal.classList.remove('active');
  }

  /**
   * Open Delete User Confirmation Modal
   */
  openUserDeleteModal(username) {
    if (!username) return;
    const cleanUsername = String(username).trim();
    if (cleanUsername.toLowerCase() === 'ryan') {
      this.showToast('Cannot delete the primary Developer account.', 'warning');
      return;
    }

    this.pendingDeleteUsername = cleanUsername;
    const modal = document.getElementById('userDeleteConfirmModal');
    const targetNameEl = document.getElementById('userDeleteTargetName');
    const warningNotice = document.getElementById('userDeleteWarningNotice');

    if (targetNameEl) targetNameEl.textContent = `"${cleanUsername}"`;

    const currentUser = window.nocAuth && window.nocAuth.getUser ? window.nocAuth.getUser() : null;
    const isCurrentActive = currentUser && currentUser.username && currentUser.username.toLowerCase() === cleanUsername.toLowerCase();
    if (warningNotice) {
      warningNotice.style.display = isCurrentActive ? 'block' : 'none';
    }

    if (modal) {
      modal.classList.add('active');
    }
  }

  /**
   * Close Delete User Confirmation Modal
   */
  closeUserDeleteModal() {
    const modal = document.getElementById('userDeleteConfirmModal');
    if (modal) modal.classList.remove('active');
    this.pendingDeleteUsername = null;
  }

  /**
   * Update Recycle Bin badge count
   */
  async updateRecycleBinBadge() {
    try {
      if (!window.nocDB || !window.nocDB.getDeletedCount) return;
      const count = await window.nocDB.getDeletedCount();
      const badge = document.getElementById('recycleBinBadge');
      const countBadge = document.getElementById('deletedRecordsCountBadge');
      const btn = document.getElementById('btnRecycleBin');

      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
      }
      if (countBadge) {
        countBadge.textContent = `${count} Record${count === 1 ? '' : 's'}`;
      }
      if (btn) {
        const canManage = window.nocAuth && window.nocAuth.isLoggedIn ? window.nocAuth.isLoggedIn() : false;
        btn.style.display = canManage ? 'inline-flex' : 'none';
      }
    } catch (e) {}
  }

  /**
   * Open Deleted Records Modal
   */
  async openDeletedRecordsModal() {
    const modal = document.getElementById('modalDeletedRecords');
    if (!modal) return;
    modal.classList.add('active');
    await this.refreshDeletedRecordsList();
  }

  /**
   * Close Deleted Records Modal
   */
  closeDeletedRecordsModal() {
    const modal = document.getElementById('modalDeletedRecords');
    if (modal) modal.classList.remove('active');
  }

  /**
   * Refresh and render deleted records list in Recycle Bin modal
   */
  async refreshDeletedRecordsList() {
    const tbody = document.getElementById('tbodyDeletedRecords');
    const emptyState = document.getElementById('deletedRecordsEmptyState');
    const searchInput = document.getElementById('inputSearchDeleted');
    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();

    if (!tbody) return;

    try {
      const records = await window.nocDB.getDeletedRecords();
      await this.updateRecycleBinBadge();

      let filtered = records || [];
      if (query) {
        filtered = filtered.filter(r => 
          (r.nocNumber && r.nocNumber.toLowerCase().includes(query)) ||
          (r.issuedTo && r.issuedTo.toLowerCase().includes(query)) ||
          (r.client && r.client.toLowerCase().includes(query)) ||
          (r.description && r.description.toLowerCase().includes(query)) ||
          (r.nocType && r.nocType.toLowerCase().includes(query))
        );
      }

      if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';

      tbody.innerHTML = filtered.map(r => {
        const canViewClient = window.nocAuth && window.nocAuth.canViewClient ? window.nocAuth.canViewClient() : false;
        const contractorOrClient = canViewClient && r.client ? `${this.escapeHTML(r.issuedTo || 'N/A')}<br><small style="color:var(--text-muted);">${this.escapeHTML(r.client)}</small>` : this.escapeHTML(r.issuedTo || 'N/A');
        const deletedTime = r.deletedAt ? new Date(r.deletedAt).toLocaleString('en-US', { dateStyle:'medium', timeStyle:'short' }) : 'Unknown';

        return `
          <tr style="border-bottom:1px solid var(--border-light); transition: background 0.15s ease;">
            <td style="padding:0.75rem 0.85rem; font-family:'JetBrains Mono', monospace; font-weight:700; color:#1E40AF;">
              ${this.escapeHTML(r.nocNumber || 'NOC-PENDING')}
            </td>
            <td style="padding:0.75rem 0.85rem; font-weight:600; color:var(--text-main);">
              ${contractorOrClient}
            </td>
            <td style="padding:0.75rem 0.85rem;">
              <span class="badge" style="background:#EFF6FF; color:#1E40AF; border:1px solid #BFDBFE; font-size:0.76rem; font-weight:600;">
                ${this.escapeHTML(r.nocType || 'Activity')}
              </span>
            </td>
            <td style="padding:0.75rem 0.85rem; font-size:0.78rem; color:var(--text-muted);">
              <div>🕒 ${deletedTime}</div>
              ${r.deletedBy ? `<div style="font-size:0.74rem; color:#64748B;">👤 by ${this.escapeHTML(r.deletedBy)}</div>` : ''}
            </td>
            <td style="padding:0.75rem 0.85rem; text-align:center;">
              <div style="display:inline-flex; gap:0.4rem;">
                <button type="button" class="btn btn-sm btn-green btn-restore-record" data-id="${this.escapeHTML(r.id)}" title="Restore Record back to Active Database" style="padding:0.3rem 0.65rem; font-size:0.78rem; font-weight:700;">
                  🔄 Restore
                </button>
                <button type="button" class="btn btn-sm btn-outline btn-preview-deleted" data-id="${this.escapeHTML(r.id)}" title="View Record Details & Documents" style="padding:0.3rem 0.55rem; font-size:0.78rem;">
                  👁️ View
                </button>
                <button type="button" class="btn btn-sm btn-outline text-rose btn-purge-deleted" data-id="${this.escapeHTML(r.id)}" data-noc="${this.escapeHTML(r.nocNumber)}" title="Permanently Delete" style="border-color:#FDA4AF; padding:0.3rem 0.55rem; font-size:0.78rem;">
                  ❌
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Wire row action buttons
      tbody.querySelectorAll('.btn-restore-record').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          try {
            btn.disabled = true;
            btn.textContent = 'Restoring...';
            const restored = await window.nocDB.restoreDeletedRecord(id);
            this.showToast(`NOC record "${restored.nocNumber || id}" restored successfully!`, 'success');
            await this.refreshDeletedRecordsList();
            if (window.nocApp && window.nocApp.refreshData) {
              await window.nocApp.refreshData();
            }
          } catch (err) {
            this.showToast('Failed to restore record: ' + err.message, 'error');
            btn.disabled = false;
            btn.textContent = '🔄 Restore';
          }
        });
      });

      tbody.querySelectorAll('.btn-preview-deleted').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const deletedList = await window.nocDB.getDeletedRecords();
          const target = deletedList.find(d => d.id === id);
          if (target) {
            this.openDetailsModal(target);
          }
        });
      });

      tbody.querySelectorAll('.btn-purge-deleted').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          const nocNumber = btn.getAttribute('data-noc');
          if (!confirm(`Are you sure you want to permanently delete "${nocNumber || id}"? It cannot be recovered.`)) {
            return;
          }
          try {
            await window.nocDB.permanentlyDeleteRecord(id);
            this.showToast(`Record "${nocNumber || id}" permanently purged.`, 'info');
            await this.refreshDeletedRecordsList();
          } catch (err) {
            this.showToast('Purge error: ' + err.message, 'error');
          }
        });
      });

    } catch (e) {
      console.warn('Error refreshing deleted records table:', e);
    }
  }
}

// Global UI instance
window.nocUI = new UIManager();
window.showToast = (msg, type, action) => window.nocUI.showToast(msg, type, action);
