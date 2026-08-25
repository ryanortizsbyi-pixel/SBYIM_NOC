/**
 * NOC Portal - UI Renderer & Modal Controller
 * Manages DOM manipulation, data tables, grid cards, modals, notifications, and RBAC view state.
 */

class UIManager {
  constructor() {
    this.currentRecords = [];
    this.activeView = 'table'; // 'table' or 'grid'
    this.currentEditingId = null;
    this.pendingUploadFiles = []; // Temporary files buffer for the create/edit form
  }

  /**
   * Initialize UI bindings and event listeners
   */
  init() {
    this.bindAuthEvents();
    this.bindDatabaseEvents();
    this.updateUserBadge();
    this.renderDatabaseStatus();
  }

  /**
   * Listen to database and Supabase config changes
   */
  bindDatabaseEvents() {
    window.addEventListener('noc:supabase-config-change', () => {
      this.renderDatabaseStatus();
    });
  }

  /**
   * Show a toast message to the user
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `
      <span>${icon}</span>
      <span class="toast-message">${this.escapeHTML(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
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
   * Format date into readable string
   */
  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
   * Update top header user role badge and action buttons based on RBAC
   */
  updateUserBadge() {
    const user = window.nocAuth.getUser();
    const badgeEl = document.getElementById('userRoleBadge');
    const newNocBtn = document.getElementById('btnNewNoc');
    const btnExportCSV = document.getElementById('btnExportCSV');
    const btnExportJSON = document.getElementById('btnExportJSON');
    const statsGrid = document.querySelector('.stats-grid');
    const filterStatus = document.getElementById('filterStatus');
    const filterNocType = document.getElementById('filterNocType');
    const filterSort = document.getElementById('filterSort');
    const searchInput = document.getElementById('searchInput');
    const guestPromptText = document.querySelector('#guestPromptContainer .empty-text');
    const credentialsSection = document.getElementById('supabaseCredentialsSection');
    const syncSection = document.getElementById('supabaseSyncSection');
    const schemaSection = document.getElementById('supabaseSchemaSection');
    const isAdmin = window.nocAuth.isAdmin();

    const canManageDb = window.nocAuth && window.nocAuth.canManageDatabase();

    if (credentialsSection) {
      credentialsSection.style.display = canManageDb ? 'block' : 'none';
    }

    if (syncSection) {
      syncSection.style.display = canManageDb ? 'block' : 'none';
    }

    if (schemaSection) {
      schemaSection.style.display = canManageDb ? 'block' : 'none';
    }

    if (badgeEl) {
      if (window.nocAuth.isLoggedIn()) {
        const roleLabel = user?.username === 'admin' ? 'Admin' : (user?.username === 'SBYIM' ? 'SBYIM' : (isAdmin ? 'Admin' : 'Guest'));
        badgeEl.innerHTML = `
          <span class="role-dot ${isAdmin ? 'admin' : 'guest'}"></span>
          <span>${roleLabel}</span>
          <button class="btn btn-sm btn-outline" style="padding:0.15rem 0.45rem; font-size:0.75rem; margin-left:0.3rem;" id="btnHeaderSwitchRole" title="Switch role or log out">
            Switch
          </button>
        `;

        const switchBtn = document.getElementById('btnHeaderSwitchRole');
        if (switchBtn) {
          switchBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openLoginModal(false);
          });
        }
      } else {
        badgeEl.innerHTML = `
          <span class="role-dot" style="background:#94A3B8;"></span>
          <span>Sign In Required</span>
        `;
      }
    }

    if (newNocBtn) {
      newNocBtn.style.display = isAdmin ? 'inline-flex' : 'none';
      newNocBtn.disabled = !isAdmin;
      newNocBtn.title = isAdmin ? 'Create a new NOC record' : '';
    }

    if (btnExportCSV) {
      btnExportCSV.style.display = isAdmin ? 'inline-flex' : 'none';
      btnExportCSV.disabled = !isAdmin;
      btnExportCSV.title = isAdmin ? 'Export database to CSV spreadsheet' : '';
    }

    if (btnExportJSON) {
      btnExportJSON.style.display = isAdmin ? 'inline-flex' : 'none';
      btnExportJSON.disabled = !isAdmin;
      btnExportJSON.title = isAdmin ? 'Download complete JSON backup' : '';
    }

    if (statsGrid) {
      statsGrid.style.display = isAdmin ? 'grid' : 'none';
    }

    if (filterStatus) {
      filterStatus.style.display = isAdmin ? 'inline-block' : 'none';
    }

    if (filterNocType) {
      filterNocType.style.display = isAdmin ? 'inline-block' : 'none';
    }

    if (filterSort) {
      filterSort.style.display = isAdmin ? 'inline-block' : 'none';
    }

    if (searchInput) {
      searchInput.placeholder = isAdmin
        ? 'Search by NOC #, Client, Contractor, Type, or Description...'
        : 'Search by NOC Number, Issued To, or Client...';
    }

    if (guestPromptText) {
      guestPromptText.textContent = 'Please enter an NOC Number, Issued To, or Client in the search bar above to look up and view certificate details.';
    }

    const closeLoginBtn = document.getElementById('btnCloseLoginModal');
    if (closeLoginBtn) {
      closeLoginBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    }

    const btnDatabaseConfig = document.getElementById('btnDatabaseConfig');
    const showDbBadge = window.nocAuth && window.nocAuth.canShowDatabaseBadge();
    if (btnDatabaseConfig) {
      btnDatabaseConfig.style.display = showDbBadge ? 'inline-flex' : 'none';
      btnDatabaseConfig.disabled = !showDbBadge;
    }
  }

  /**
   * Clears search bar history, active filters, open modals, and temporary buffers when switching roles
   */
  resetSessionState() {
    // 1. Clear search input and app search query
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = '';
    }
    if (window.nocApp) {
      window.nocApp.searchQuery = '';
      window.nocApp.selectedStatus = 'all';
      window.nocApp.selectedType = 'all';
      window.nocApp.sortBy = 'newest';
    }

    // 2. Reset filter dropdown values
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) filterStatus.value = 'all';

    const filterNocType = document.getElementById('filterNocType');
    if (filterNocType) filterNocType.value = 'all';

    const filterSort = document.getElementById('filterSort');
    if (filterSort) filterSort.value = 'newest';

    // 3. Close any active modal dialogs & document viewers
    this.closeEntryModal();
    this.closeDetailsModal();
    this.closeDeleteModal();
    this.closeRequirementsModal();
    this.closeDatabaseModal();
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
   * Listen to auth change events
   */
  bindAuthEvents() {
    window.addEventListener('noc:auth-change', () => {
      this.resetSessionState();
      this.updateUserBadge();
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

    const isGuest = window.nocAuth.isGuest();
    const hasActiveQuery = window.nocApp && (
      (window.nocApp.searchQuery && window.nocApp.searchQuery.trim().length > 0) ||
      (!isGuest && window.nocApp.selectedStatus && window.nocApp.selectedStatus !== 'all') ||
      (!isGuest && window.nocApp.selectedType && window.nocApp.selectedType !== 'all')
    );

    // If logged in as Guest and no active search query, do not show whole data on front screen
    if (isGuest && !hasActiveQuery) {
      if (tableContainer) tableContainer.style.display = 'none';
      if (gridContainer) gridContainer.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
      if (guestPrompt) guestPrompt.style.display = 'block';
      return;
    }

    if (guestPrompt) guestPrompt.style.display = 'none';

    if (!records || records.length === 0) {
      if (tableContainer) tableContainer.style.display = 'none';
      if (gridContainer) gridContainer.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
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

    records.forEach((rec) => {
      const status = window.nocDB.getStatus(rec.dateOfExpiration);
      const docsCount = rec.documents ? rec.documents.length : 0;

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
        <td class="noc-number-cell">${this.escapeHTML(rec.nocNumber)}</td>
        <td><span class="badge badge-type">${this.escapeHTML(rec.nocType)}</span></td>
        <td>${this.escapeHTML(rec.client)}</td>
        <td>${this.escapeHTML(rec.issuedTo)}</td>
        <td style="white-space:nowrap;">${this.formatDate(rec.dateOfIssuance)}</td>
        <td style="white-space:nowrap;">${this.formatDate(rec.dateOfExpiration)}</td>
        <td>${statusBadge}</td>
        <td>
          <span class="doc-count-badge" data-action="view-docs" data-id="${rec.id}">
            📁 ${docsCount} ${docsCount === 1 ? 'file' : 'files'}
          </span>
        </td>
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
            ` : `
              <button class="btn btn-sm btn-outline" data-action="download-all" data-id="${rec.id}" title="Download all attached documents">
                📥
              </button>
            `}
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });

    this.bindTableActionEvents(tbody);
  }

  /**
   * Render Grid View
   */
  renderGridView(records) {
    const grid = document.getElementById('gridViewContainer');
    if (!grid) return;
    grid.innerHTML = '';

    const isAdmin = window.nocAuth.isAdmin();

    records.forEach((rec) => {
      const status = window.nocDB.getStatus(rec.dateOfExpiration);
      const docsCount = rec.documents ? rec.documents.length : 0;

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
      card.innerHTML = `
        <div>
          <div class="card-header">
            <div>
              <div class="card-noc-number">${this.escapeHTML(rec.nocNumber)}</div>
              <div style="margin-top:0.25rem;"><span class="badge badge-type">${this.escapeHTML(rec.nocType)}</span></div>
            </div>
            ${statusBadge}
          </div>
          
          <div class="card-body" style="margin-top:1rem;">
            <div class="card-meta-row">
              <span class="card-meta-label">Client:</span>
              <span class="card-meta-value">${this.escapeHTML(rec.client)}</span>
            </div>
            <div class="card-meta-row">
              <span class="card-meta-label">Issued To:</span>
              <span class="card-meta-value">${this.escapeHTML(rec.issuedTo)}</span>
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
            ` : `
              <button class="btn btn-sm btn-outline" data-action="download-all" data-id="${rec.id}">
                📥 Download
              </button>
            `}
          </div>
        </div>
      `;

      grid.appendChild(card);
    });

    this.bindTableActionEvents(grid);
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

    if (id) {
      if (title) title.textContent = 'Edit NOC Record';
      const record = await window.nocDB.getById(id);
      if (record) {
        document.getElementById('nocNumberInput').value = record.nocNumber || '';
        if (window.nocApp && typeof window.nocApp.populateFormTypeOptions === 'function') {
          window.nocApp.populateFormTypeOptions(record.nocType || '');
        }
        document.getElementById('dateIssuanceInput').value = record.dateOfIssuance || '';
        document.getElementById('dateExpirationInput').value = record.dateOfExpiration || '';
        document.getElementById('issuedToInput').value = record.issuedTo || '';
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
      // Suggest default today's date for issuance
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('dateIssuanceInput').value = today;
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
    const customContainer = document.getElementById('customTypeContainer');
    const customInput = document.getElementById('nocTypeCustomInput');
    const nocTypeSelect = document.getElementById('nocTypeSelect');
    if (customContainer) customContainer.style.display = 'none';
    if (customInput) {
      customInput.value = '';
      customInput.required = false;
    }
    if (nocTypeSelect) nocTypeSelect.value = '';
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
        <div class="details-item">
          <span class="details-label">NOC Type</span>
          <div><span class="badge badge-type">${this.escapeHTML(record.nocType)}</span></div>
        </div>
        <div class="details-item">
          <span class="details-label">Client</span>
          <span class="details-val">${this.escapeHTML(record.client)}</span>
        </div>
        <div class="details-item">
          <span class="details-label">Issued To</span>
          <span class="details-val">${this.escapeHTML(record.issuedTo)}</span>
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
          Attached Documents
        </h4>

        ${docs.length === 0 ? `
          <p style="color:var(--text-muted); font-size:0.88rem; margin-top:0.75rem; font-style:italic;">
            No documents attached to this NOC record.
          </p>
        ` : `
          <div class="doc-gallery">
            ${docs.map((doc, idx) => {
      const isPDF = doc.type === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf');
      const isGuest = window.nocAuth && window.nocAuth.isGuest();
      return `
                <div class="doc-card ${isPDF ? 'pdf' : 'image'}">
                  <div class="doc-card-icon">${isPDF ? '📄' : '🖼️'}</div>
                  <div class="doc-card-name" title="${this.escapeHTML(doc.name)}">${this.escapeHTML(doc.name)}</div>
                  <div class="doc-card-size">
                    ${this.formatBytes(doc.size)}
                    ${isGuest && isPDF ? `<span class="badge" style="background:#FEF3C7; color:#92400E; font-size:0.68rem; padding:0.1rem 0.35rem; margin-left:0.25rem; font-weight:700;">Page 1 Only</span>` : ''}
                  </div>
                  <div class="doc-card-actions">
                    <button class="btn btn-sm btn-primary" data-view-doc-idx="${idx}" title="${isGuest && isPDF ? 'Preview First Page' : 'Preview Document'}">
                      👁️ ${isGuest && isPDF ? 'View Page 1' : 'View'}
                    </button>
                    <button class="btn btn-sm btn-outline" data-download-doc-idx="${idx}" title="${isGuest && isPDF ? 'Download First Page Only' : 'Download File'}">
                      📥
                    </button>
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        `}
      </div>
    `;

    // Bind document preview and download clicks inside details modal
    content.querySelectorAll('[data-view-doc-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-view-doc-idx'), 10);
        window.docViewer.open(docs, idx);
      });
    });

    content.querySelectorAll('[data-download-doc-idx]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.getAttribute('data-download-doc-idx'), 10);
        const d = docs[idx];
        if (!d) return;

        const isGuest = window.nocAuth && window.nocAuth.isGuest();
        const isPDF = d.type === 'application/pdf' || d.name.toLowerCase().endsWith('.pdf');

        if (isGuest && isPDF) {
          const baseName = d.name.replace(/\.pdf$/i, '');
          const page1FileName = `${baseName}_Page_1.pdf`;
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
      msgEl.innerHTML = `Are you sure you want to delete NOC record <strong>"${this.escapeHTML(record.nocNumber)}"</strong> (${this.escapeHTML(record.client)})? This action cannot be undone.`;
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
   * Open Role Switch / Login Modal
   */
  openLoginModal(isMandatory = false) {
    const modal = document.getElementById('loginModal');
    const form = document.getElementById('loginForm');
    const closeBtn = document.getElementById('btnCloseLoginModal');

    if (form) form.reset();
    if (closeBtn) {
      const isGuest = window.nocAuth && window.nocAuth.isGuest();
      const isAdmin = window.nocAuth && window.nocAuth.isAdmin();
      // Hide close button if logged in as guest, mandatory, or not admin
      closeBtn.style.display = (isGuest || !isAdmin || isMandatory) ? 'none' : 'inline-flex';
    }
    if (modal) modal.classList.add('active');
  }

  /**
   * Close Login Modal (Only allowed if user is authenticated as Admin or programmatic override)
   */
  closeLoginModal(force = false) {
    if (!force && window.nocAuth && window.nocAuth.isGuest()) return;
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('active');
  }

  /**
   * Download all documents attached to a record sequentially (Page 1 only for Guest)
   */
  async downloadAllRecordDocs(id) {
    const record = await window.nocDB.getById(id);
    if (!record || !record.documents || record.documents.length === 0) {
      this.showToast('No documents available to download.', 'info');
      return;
    }

    const isGuest = window.nocAuth && window.nocAuth.isGuest();
    this.showToast(`Preparing download for ${record.documents.length} document(s)...`, 'info');

    for (let idx = 0; idx < record.documents.length; idx++) {
      const doc = record.documents[idx];
      const isPDF = doc.type === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf');

      let downloadData = doc.dataUrl;
      let downloadName = `${record.nocNumber}_${doc.name}`;

      if (isGuest && isPDF) {
        const baseName = doc.name.replace(/\.pdf$/i, '');
        downloadName = `${record.nocNumber}_${baseName}_Page_1.pdf`;
        const blob = await window.docViewer.getFirstPagePdfBlob(doc.dataUrl);
        if (blob) {
          downloadData = blob;
        }
      }

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
            <div style="background:var(--bg-surface); border:1px solid var(--border-light); border-radius:var(--radius-md); padding:0.9rem 1.15rem; display:flex; align-items:center; justify-content:space-between; gap:1rem; box-shadow:var(--shadow-sm); transition:all var(--transition-fast);">
              <div style="display:flex; align-items:center; gap:0.85rem; overflow:hidden;">
                <span class="file-item-badge ${badgeClass}" style="flex-shrink:0;">${badgeLabel}</span>
                <div style="overflow:hidden;">
                  <div style="font-size:0.9rem; font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${this.escapeHTML(doc.name)}">
                    ${this.escapeHTML(doc.name)}
                  </div>
                  <div style="display:flex; flex-wrap:wrap; gap:0.5rem; font-size:0.75rem; color:var(--text-muted); margin-top:0.15rem;">
                    <span>${this.formatBytes(doc.size || 0)}</span>
                    <span>•</span>
                    <span>Uploaded: ${this.formatDate(doc.uploadedAt || new Date().toISOString())}</span>
                  </div>
                </div>
              </div>

              <div style="display:flex; align-items:center; gap:0.5rem; flex-shrink:0;">
                ${canPreview ? `
                  <button type="button" class="btn btn-outline-primary" style="padding:0.4rem 0.75rem; font-size:0.8rem;" data-preview-req-idx="${idx}" title="Preview Document">
                    👁️ View
                  </button>
                ` : ''}
                <button type="button" class="btn btn-outline" style="padding:0.4rem 0.75rem; font-size:0.8rem;" data-download-req-idx="${idx}" title="Download File">
                  📥 Download
                </button>
                ${isAdmin ? `
                  <button type="button" class="btn btn-danger" style="padding:0.4rem 0.65rem; font-size:0.8rem;" data-delete-req-id="${doc.id}" title="Delete Document">
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
            ${isAdmin ? '<p style="font-size:0.8rem; margin-top:0.25rem;">Use the upload area above to attach up to 8 PDF certificates.</p>' : ''}
          </div>
        `;
      } else {
        container.innerHTML = docs.map((doc, idx) => {
          return `
            <div style="background:var(--bg-surface); border:1px solid var(--border-light); border-radius:var(--radius-md); padding:0.9rem 1.15rem; display:flex; align-items:center; justify-content:space-between; gap:1rem; box-shadow:var(--shadow-sm); transition:all var(--transition-fast);">
              <div style="display:flex; align-items:center; gap:0.85rem; overflow:hidden;">
                <span class="file-item-badge pdf" style="flex-shrink:0;">PDF</span>
                <div style="overflow:hidden;">
                  <div style="font-size:0.9rem; font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${this.escapeHTML(doc.name)}">
                    ${this.escapeHTML(doc.name)}
                  </div>
                  <div style="display:flex; flex-wrap:wrap; gap:0.5rem; font-size:0.75rem; color:var(--text-muted); margin-top:0.15rem;">
                    <span>${this.formatBytes(doc.size || 0)}</span>
                    <span>•</span>
                    <span>Uploaded: ${this.formatDate(doc.uploadedAt || new Date().toISOString())}</span>
                  </div>
                </div>
              </div>

              <div style="display:flex; align-items:center; gap:0.5rem; flex-shrink:0;">
                <button type="button" class="btn btn-outline-primary" style="padding:0.4rem 0.75rem; font-size:0.8rem;" data-preview-coc-idx="${idx}" title="Preview Complete Document">
                  👁️ View
                </button>
                <button type="button" class="btn btn-outline" style="padding:0.4rem 0.75rem; font-size:0.8rem;" data-download-coc-idx="${idx}" title="Download File">
                  📥 Download
                </button>
                ${isAdmin ? `
                  <button type="button" class="btn btn-danger" style="padding:0.4rem 0.65rem; font-size:0.8rem;" data-delete-coc-id="${doc.id}" title="Delete Document">
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
            window.docViewer.open(docs, idx, 'SBYI Certificate of Conformity', { allowFullPages: true });
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
    date_of_issuance DATE NOT NULL,
    date_of_expiration DATE NOT NULL,
    description TEXT,
    documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance Indexes
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

-- 3. TABLE: sbyi_coc_docs (SBYI Certificate of Conformity PDF Documents)
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

-- 4. TABLE: noc_custom_types (Dynamic NOC Categories)
CREATE TABLE IF NOT EXISTS public.noc_custom_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. AUTOMATIC TIMESTAMP TRIGGER
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

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.noc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noc_requirements_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbyi_coc_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noc_custom_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on noc_records" ON public.noc_records;
CREATE POLICY "Allow all operations on noc_records" ON public.noc_records FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on noc_requirements_docs" ON public.noc_requirements_docs;
CREATE POLICY "Allow all operations on noc_requirements_docs" ON public.noc_requirements_docs FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on sbyi_coc_docs" ON public.sbyi_coc_docs;
CREATE POLICY "Allow all operations on sbyi_coc_docs" ON public.sbyi_coc_docs FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on noc_custom_types" ON public.noc_custom_types;
CREATE POLICY "Allow all operations on noc_custom_types" ON public.noc_custom_types FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. DEFAULT CATEGORIES
INSERT INTO public.noc_custom_types (name) VALUES ('Activity'), ('Activity NOC') ON CONFLICT (name) DO NOTHING;`;
  }

  /**
   * Render top navbar database status badge and inside modal status card
   */
  renderDatabaseStatus() {
    const isConfigured = window.supabaseManager && window.supabaseManager.isConfigured();
    const isConnected = window.supabaseManager && window.supabaseManager.isConnected;

    const dotEl = document.getElementById('dbStatusDot');
    const textEl = document.getElementById('dbStatusText');
    const iconEl = document.getElementById('dbStatusIcon');
    const headEl = document.getElementById('dbStatusHeading');
    const pillEl = document.getElementById('dbStatusPill');
    const msgEl = document.getElementById('dbStatusMessage');

    if (isConnected) {
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
        msgEl.textContent = "Data is stored securely in your browser's IndexedDB and localStorage. Connect Supabase to enable cloud sync and PostgreSQL persistence.";
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
   * Open the Supabase Database Configuration Modal (Admin Only)
   */
  openDatabaseModal() {
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
    if (modal) modal.classList.add('active');
  }

  /**
   * Close the Supabase Database Configuration Modal
   */
  closeDatabaseModal() {
    const modal = document.getElementById('databaseModal');
    if (modal) modal.classList.remove('active');
  }
}

// Global UI instance
window.nocUI = new UIManager();
window.showToast = (msg, type) => window.nocUI.showToast(msg, type);
