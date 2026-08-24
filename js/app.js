/**
 * NOC Portal - Main Application Orchestrator
 * Connects database, authentication, document handling, search/filter algorithms, and export utilities.
 */

class NOCApp {
  constructor() {
    this.allRecords = [];
    this.filteredRecords = [];
    this.searchQuery = '';
    this.selectedStatus = 'all';
    this.selectedType = 'all';
    this.sortBy = 'newest';
  }

  /**
   * Main bootstrap method
   */
  async init() {
    console.log('Initializing NOC Portal Application...');
    
    // 1. Initialize UI & Auth
    window.nocUI.init();

    // 2. Seed initial realistic database if empty
    await window.seedInitialDatabaseIfEmpty();

    // 3. Load all records from IndexedDB
    await this.refreshData();

    // 4. Bind event listeners
    this.bindEvents();
    this.populateTypeFilterOptions();

    // 5. Present login screen as the first screen if not authenticated
    if (!window.nocAuth.isLoggedIn()) {
      window.nocUI.openLoginModal(true);
    }
  }

  /**
   * Fetch latest data from IndexedDB and re-render
   */
  async refreshData() {
    try {
      this.allRecords = await window.nocDB.getAll();
      const stats = await window.nocDB.getStatistics();
      window.nocUI.renderStats(stats);
      this.applyFilters();
      this.populateTypeFilterOptions();
    } catch (err) {
      console.error('Error fetching data from database:', err);
      window.showToast('Failed to load records from database.', 'error');
    }
  }

  /**
   * Get all unique NOC types: base types + stored custom types + distinct types from active records
   */
  getAvailableNocTypes() {
    const defaultTypes = [
      'Activity',
      'Activity NOC'
    ];
    let customTypes = [];
    try {
      const stored = localStorage.getItem('noc_custom_types');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) customTypes = parsed;
      }
    } catch (e) {
      console.warn('Could not read custom types from localStorage', e);
    }

    const recordTypes = (this.allRecords || []).map(r => r.nocType).filter(Boolean);
    const combined = [...defaultTypes, ...customTypes, ...recordTypes];

    const seen = new Set();
    const unique = [];
    for (const t of combined) {
      const trimmed = String(t).trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(trimmed);
      }
    }
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }

  /**
   * Persist a new custom NOC type into localStorage
   */
  saveCustomNocType(newType) {
    if (!newType) return;
    const trimmed = String(newType).trim();
    if (!trimmed) return;

    try {
      let customTypes = [];
      const stored = localStorage.getItem('noc_custom_types');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) customTypes = parsed;
      }
      if (!customTypes.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
        customTypes.push(trimmed);
        localStorage.setItem('noc_custom_types', JSON.stringify(customTypes));
      }
    } catch (e) {
      console.warn('Could not save custom type to localStorage', e);
    }
  }

  /**
   * Populate dashboard NOC Type dropdown filter with all dynamic types
   */
  populateTypeFilterOptions() {
    const typeFilter = document.getElementById('filterNocType');
    if (!typeFilter) return;

    const currentVal = this.selectedType || typeFilter.value || 'all';
    const types = this.getAvailableNocTypes();

    typeFilter.innerHTML = '<option value="all">All NOC Types</option>';
    let hasMatch = false;

    types.forEach(type => {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type;
      if (currentVal !== 'all' && type.toLowerCase() === currentVal.toLowerCase()) {
        opt.selected = true;
        hasMatch = true;
      }
      typeFilter.appendChild(opt);
    });

    if (currentVal === 'all' || !hasMatch) {
      typeFilter.value = 'all';
      this.selectedType = 'all';
    }
  }

  /**
   * Populate Create/Edit modal form NOC Type dropdown with all dynamic types
   */
  populateFormTypeOptions(selectedType = '') {
    const select = document.getElementById('nocTypeSelect');
    if (!select) return;

    const customContainer = document.getElementById('customTypeContainer');
    const customInput = document.getElementById('nocTypeCustomInput');

    const types = this.getAvailableNocTypes();
    select.innerHTML = '<option value="" disabled selected>-- Select NOC Type --</option>';

    let found = false;
    types.forEach(type => {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type;
      if (selectedType && type.toLowerCase() === selectedType.toLowerCase()) {
        opt.selected = true;
        found = true;
      }
      select.appendChild(opt);
    });

    // Special option for adding a new type if not in the dropdown
    const addOpt = document.createElement('option');
    addOpt.value = '__custom__';
    addOpt.textContent = '➕ Add New / Custom Type...';
    select.appendChild(addOpt);

    if (selectedType) {
      if (found) {
        if (customContainer) customContainer.style.display = 'none';
        if (customInput) {
          customInput.value = '';
          customInput.required = false;
        }
      } else {
        // Record has a type not currently in the base list: dynamically add option and select it
        const customOpt = document.createElement('option');
        customOpt.value = selectedType;
        customOpt.textContent = selectedType;
        customOpt.selected = true;
        select.insertBefore(customOpt, addOpt);
        if (customContainer) customContainer.style.display = 'none';
        if (customInput) {
          customInput.value = '';
          customInput.required = false;
        }
      }
    } else {
      select.value = '';
      if (customContainer) customContainer.style.display = 'none';
      if (customInput) {
        customInput.value = '';
        customInput.required = false;
      }
    }
  }

  /**
   * Filter and sort records based on search query and dropdown selections
   */
  applyFilters() {
    const q = this.searchQuery.trim().toLowerCase();
    const isGuest = window.nocAuth.isGuest();

    this.filteredRecords = this.allRecords.filter((rec) => {
      // 1. Search filter: Guest can ONLY search by NOC Number; Admin can search all fields
      let matchesSearch = true;
      if (q) {
        if (isGuest) {
          matchesSearch = rec.nocNumber && rec.nocNumber.toLowerCase().includes(q);
        } else {
          matchesSearch = (
            (rec.nocNumber && rec.nocNumber.toLowerCase().includes(q)) ||
            (rec.nocType && rec.nocType.toLowerCase().includes(q)) ||
            (rec.client && rec.client.toLowerCase().includes(q)) ||
            (rec.issuedTo && rec.issuedTo.toLowerCase().includes(q)) ||
            (rec.description && rec.description.toLowerCase().includes(q))
          );
        }
      }

      // 2. Status filter (Admin only)
      let matchesStatus = true;
      if (!isGuest && this.selectedStatus !== 'all') {
        const status = window.nocDB.getStatus(rec.dateOfExpiration);
        matchesStatus = status === this.selectedStatus;
      }

      // 3. Type filter (Admin only)
      let matchesType = true;
      if (!isGuest && this.selectedType !== 'all') {
        matchesType = rec.nocType === this.selectedType;
      }

      return matchesSearch && matchesStatus && matchesType;
    });

    // Sort records
    if (this.sortBy === 'newest') {
      this.filteredRecords.sort((a, b) => new Date(b.createdAt || b.dateOfIssuance) - new Date(a.createdAt || a.dateOfIssuance));
    } else if (this.sortBy === 'oldest') {
      this.filteredRecords.sort((a, b) => new Date(a.createdAt || a.dateOfIssuance) - new Date(b.createdAt || b.dateOfIssuance));
    } else if (this.sortBy === 'issuance') {
      this.filteredRecords.sort((a, b) => new Date(b.dateOfIssuance || 0) - new Date(a.dateOfIssuance || 0));
    } else if (this.sortBy === 'expiring') {
      this.filteredRecords.sort((a, b) => new Date(a.dateOfExpiration) - new Date(b.dateOfExpiration));
    } else if (this.sortBy === 'nocNumber') {
      this.filteredRecords.sort((a, b) => (a.nocNumber || '').localeCompare(b.nocNumber || ''));
    }

    window.nocUI.renderRecords(this.filteredRecords);
  }

  /**
   * Bind DOM event listeners for inputs, buttons, and drag-and-drop
   */
  bindEvents() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      let timeout = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          this.searchQuery = e.target.value;
          this.applyFilters();
        }, 200);
      });
    }

    // Status filter
    const statusFilter = document.getElementById('filterStatus');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.selectedStatus = e.target.value;
        this.applyFilters();
      });
    }

    // NOC Type filter
    const typeFilter = document.getElementById('filterNocType');
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        this.selectedType = e.target.value;
        this.applyFilters();
      });
    }

    // Sort By filter
    const sortFilter = document.getElementById('filterSort');
    if (sortFilter) {
      sortFilter.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.applyFilters();
      });
    }

    // View toggle buttons (Table vs Grid)
    const btnTableView = document.getElementById('btnViewTable');
    const btnGridView = document.getElementById('btnViewGrid');

    if (btnTableView && btnGridView) {
      btnTableView.addEventListener('click', () => {
        window.nocUI.activeView = 'table';
        btnTableView.classList.add('active');
        btnGridView.classList.remove('active');
        window.nocUI.renderRecords(this.filteredRecords);
      });

      btnGridView.addEventListener('click', () => {
        window.nocUI.activeView = 'grid';
        btnGridView.classList.add('active');
        btnTableView.classList.remove('active');
        window.nocUI.renderRecords(this.filteredRecords);
      });
    }

    // New NOC Button
    const btnNewNoc = document.getElementById('btnNewNoc');
    if (btnNewNoc) {
      btnNewNoc.addEventListener('click', () => {
        window.nocUI.openEntryModal();
      });
    }

    // Modal Close Buttons
    const btnCloseEntryModal = document.getElementById('btnCloseEntryModal');
    const btnCancelEntry = document.getElementById('btnCancelEntry');
    if (btnCloseEntryModal) btnCloseEntryModal.addEventListener('click', () => window.nocUI.closeEntryModal());
    if (btnCancelEntry) btnCancelEntry.addEventListener('click', () => window.nocUI.closeEntryModal());

    const btnCloseDetailsModal = document.getElementById('btnCloseDetailsModal');
    if (btnCloseDetailsModal) btnCloseDetailsModal.addEventListener('click', () => window.nocUI.closeDetailsModal());

    const btnCloseDeleteModal = document.getElementById('btnCloseDeleteModal');
    const btnCancelDelete = document.getElementById('btnCancelDelete');
    if (btnCloseDeleteModal) btnCloseDeleteModal.addEventListener('click', () => window.nocUI.closeDeleteModal());
    if (btnCancelDelete) btnCancelDelete.addEventListener('click', () => window.nocUI.closeDeleteModal());

    // Confirm Delete Button
    const btnConfirmDelete = document.getElementById('btnConfirmDelete');
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener('click', async () => {
        if (window.nocUI.pendingDeleteId) {
          try {
            await window.nocDB.delete(window.nocUI.pendingDeleteId);
            window.showToast('NOC Record deleted successfully.', 'success');
            window.nocUI.closeDeleteModal();
            await this.refreshData();
          } catch (err) {
            window.showToast('Failed to delete record: ' + err.message, 'error');
          }
        }
      });
    }

    // NOC Entry Form Submit (Add / Edit)
    const nocForm = document.getElementById('nocEntryForm');
    if (nocForm) {
      nocForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      });
    }

    // NOC Type Select & Custom Type Input interactions
    const nocTypeSelect = document.getElementById('nocTypeSelect');
    const customTypeContainer = document.getElementById('customTypeContainer');
    const nocTypeCustomInput = document.getElementById('nocTypeCustomInput');
    const nocTypeHint = document.getElementById('nocTypeHint');
    const btnCancelCustomType = document.getElementById('btnCancelCustomType');

    if (nocTypeSelect) {
      nocTypeSelect.addEventListener('change', (e) => {
        if (e.target.value === '__custom__') {
          if (customTypeContainer) customTypeContainer.style.display = 'block';
          if (nocTypeCustomInput) {
            nocTypeCustomInput.required = true;
            nocTypeCustomInput.focus();
          }
        } else {
          if (customTypeContainer) customTypeContainer.style.display = 'none';
          if (nocTypeCustomInput) {
            nocTypeCustomInput.required = false;
            nocTypeCustomInput.value = '';
          }
        }
      });
    }

    if (nocTypeHint) {
      nocTypeHint.addEventListener('click', () => {
        if (nocTypeSelect) nocTypeSelect.value = '__custom__';
        if (customTypeContainer) customTypeContainer.style.display = 'block';
        if (nocTypeCustomInput) {
          nocTypeCustomInput.required = true;
          nocTypeCustomInput.focus();
        }
      });
    }

    if (btnCancelCustomType) {
      btnCancelCustomType.addEventListener('click', () => {
        if (customTypeContainer) customTypeContainer.style.display = 'none';
        if (nocTypeCustomInput) {
          nocTypeCustomInput.required = false;
          nocTypeCustomInput.value = '';
        }
        if (nocTypeSelect) nocTypeSelect.value = '';
      });
    }

    // Document Dropzone File Input
    const dropzone = document.getElementById('docDropzone');
    const fileInput = document.getElementById('docFileInput');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      
      fileInput.addEventListener('change', (e) => {
        window.nocUI.handleFilesSelected(e.target.files);
        fileInput.value = ''; // reset so same file can be selected again if needed
      });

      // Drag and Drop
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files) {
          window.nocUI.handleFilesSelected(dt.files);
        }
      });
    }

    // Role Switcher / Login Form & Buttons
    const btnCloseLoginModal = document.getElementById('btnCloseLoginModal');
    if (btnCloseLoginModal) btnCloseLoginModal.addEventListener('click', () => window.nocUI.closeLoginModal());

    const btnQuickAdmin = document.getElementById('btnQuickAdmin');
    const btnQuickGuest = document.getElementById('btnQuickGuest');

    if (btnQuickAdmin) {
      btnQuickAdmin.addEventListener('click', () => {
        window.nocAuth.switchRole('admin');
        window.nocUI.closeLoginModal();
      });
    }

    if (btnQuickGuest) {
      btnQuickGuest.addEventListener('click', () => {
        window.nocAuth.switchRole('guest');
        window.nocUI.closeLoginModal();
      });
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('loginUsername').value;
        const p = document.getElementById('loginPassword').value;
        const res = window.nocAuth.login(u, p);
        if (res.success) {
          window.nocUI.closeLoginModal();
        } else {
          window.showToast(res.message, 'error');
        }
      });
    }

    // NOC Requirements Modal (Up to 5 Documents)
    const btnNocRequirements = document.getElementById('btnNocRequirements');
    const btnCloseRequirementsModal = document.getElementById('btnCloseRequirementsModal');
    const btnCloseReqModalFooter = document.getElementById('btnCloseReqModalFooter');
    const btnDownloadAllReqDocs = document.getElementById('btnDownloadAllReqDocs');
    const reqDropzone = document.getElementById('reqDropzone');
    const reqFilesInput = document.getElementById('reqFilesInput');

    if (btnNocRequirements) {
      btnNocRequirements.addEventListener('click', () => {
        window.nocUI.openRequirementsModal();
      });
    }

    if (btnCloseRequirementsModal) {
      btnCloseRequirementsModal.addEventListener('click', () => {
        window.nocUI.closeRequirementsModal();
      });
    }

    if (btnCloseReqModalFooter) {
      btnCloseReqModalFooter.addEventListener('click', () => {
        window.nocUI.closeRequirementsModal();
      });
    }

    if (btnDownloadAllReqDocs) {
      btnDownloadAllReqDocs.addEventListener('click', async () => {
        const docs = await window.nocDB.getRequirementsDocs();
        if (!docs || docs.length === 0) {
          window.showToast('No requirement documents available to download.', 'info');
          return;
        }
        window.showToast(`Starting sequential download for ${docs.length} requirement file(s)...`, 'info');
        docs.forEach((d, idx) => {
          setTimeout(() => {
            window.docViewer.triggerFileDownload(d.dataUrl, `Requirement_${d.name}`);
          }, idx * 400);
        });
      });
    }

    if (reqDropzone && reqFilesInput) {
      reqDropzone.addEventListener('click', () => {
        if (!window.nocAuth.isAdmin()) {
          window.showToast('Admin privileges required to upload requirements.', 'error');
          return;
        }
        reqFilesInput.click();
      });

      const handleReqUploads = async (fileList) => {
        if (!window.nocAuth.isAdmin()) {
          window.showToast('Admin privileges required to upload requirements.', 'error');
          return;
        }

        const existingDocs = await window.nocDB.getRequirementsDocs();
        const availableSlots = 5 - existingDocs.length;

        if (availableSlots <= 0) {
          window.showToast('Maximum limit of 5 requirement documents reached. Delete existing documents first.', 'error');
          return;
        }

        const filesToProcess = Array.from(fileList).slice(0, availableSlots);
        if (fileList.length > availableSlots) {
          window.showToast(`Only ${availableSlots} more document(s) could be added (max 5 limit).`, 'info');
        }

        const newDocs = [];
        for (const file of filesToProcess) {
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
          });

          newDocs.push({
            id: 'req_doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            dataUrl: dataUrl,
            uploadedAt: new Date().toISOString(),
            uploadedBy: window.nocAuth.getUser().displayName || 'System Administrator'
          });
        }

        const updatedList = [...existingDocs, ...newDocs];
        await window.nocDB.saveRequirementsDocs(updatedList);
        await window.nocUI.openRequirementsModal();
        window.showToast(`Successfully uploaded ${newDocs.length} requirement document(s).`, 'success');
      };

      reqFilesInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleReqUploads(e.target.files);
          reqFilesInput.value = '';
        }
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        reqDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          reqDropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        reqDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          reqDropzone.classList.remove('dragover');
        });
      });

      reqDropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          handleReqUploads(dt.files);
        }
      });
    }

    // Export Utilities
    const btnExportCSV = document.getElementById('btnExportCSV');
    const btnExportJSON = document.getElementById('btnExportJSON');
    const btnPrintReport = document.getElementById('btnPrintReport');
    const btnResetData = document.getElementById('btnResetData');

    if (btnExportCSV) btnExportCSV.addEventListener('click', () => this.exportCSV());
    if (btnExportJSON) btnExportJSON.addEventListener('click', () => this.exportJSON());
    if (btnPrintReport) btnPrintReport.addEventListener('click', () => window.print());
    if (btnResetData) {
      btnResetData.addEventListener('click', async () => {
        if (confirm('Reset database to demo sample records? This will replace any custom changes.')) {
          await window.nocDB.clearAll();
          await window.nocDB.bulkInsert(window.INITIAL_NOC_SEED_DATA);
          window.showToast('Database reset to original demo records.', 'success');
          await this.refreshData();
        }
      });
    }
  }

  /**
   * Handle NOC Add/Edit Form submission
   */
  async handleFormSubmit() {
    const nocNumber = document.getElementById('nocNumberInput').value.trim();
    
    // Resolve NOC Type from select dropdown or custom input
    const nocTypeSelect = document.getElementById('nocTypeSelect');
    const customTypeContainer = document.getElementById('customTypeContainer');
    const nocTypeCustomInput = document.getElementById('nocTypeCustomInput');
    let nocType = '';
    let isCustomType = false;

    if (nocTypeSelect && nocTypeSelect.value === '__custom__') {
      nocType = nocTypeCustomInput ? nocTypeCustomInput.value.trim() : '';
      isCustomType = true;
    } else if (customTypeContainer && customTypeContainer.style.display !== 'none' && nocTypeCustomInput && nocTypeCustomInput.value.trim()) {
      nocType = nocTypeCustomInput.value.trim();
      isCustomType = true;
    } else if (nocTypeSelect && nocTypeSelect.value) {
      nocType = nocTypeSelect.value.trim();
    } else {
      const fallbackInput = document.getElementById('nocTypeInput');
      if (fallbackInput) nocType = fallbackInput.value.trim();
    }

    const dateOfIssuance = document.getElementById('dateIssuanceInput').value;
    const dateOfExpiration = document.getElementById('dateExpirationInput').value;
    const issuedTo = document.getElementById('issuedToInput').value.trim();
    const client = document.getElementById('clientInput').value.trim();
    const description = document.getElementById('descriptionInput').value.trim();

    // Validation
    if (!nocNumber || !nocType || !dateOfIssuance || !dateOfExpiration || !issuedTo || !client || !description) {
      window.showToast('Please fill in all required fields including NOC Type.', 'error');
      return;
    }

    if (new Date(dateOfExpiration) < new Date(dateOfIssuance)) {
      window.showToast('Date of Expiration cannot be earlier than Date of Issuance.', 'error');
      return;
    }

    if (window.nocUI.pendingUploadFiles.length > 5) {
      window.showToast('A maximum of 5 documents can be attached.', 'error');
      return;
    }

    // Save custom NOC Type so it is permanently available in dropdown menus
    this.saveCustomNocType(nocType);

    const payload = {
      nocNumber,
      nocType,
      dateOfIssuance,
      dateOfExpiration,
      issuedTo,
      client,
      description,
      documents: window.nocUI.pendingUploadFiles
    };

    try {
      if (window.nocUI.currentEditingId) {
        // Update existing
        await window.nocDB.update(window.nocUI.currentEditingId, payload);
        window.showToast(`NOC "${nocNumber}" updated successfully.` + (isCustomType ? ` New type "${nocType}" added to dropdown menu.` : ''), 'success');
      } else {
        // Add new
        await window.nocDB.add(payload);
        window.showToast(`NOC "${nocNumber}" created and saved to database.` + (isCustomType ? ` New type "${nocType}" added to dropdown menu.` : ''), 'success');
      }

      window.nocUI.closeEntryModal();
      await this.refreshData();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  }

  /**
   * Export database records as formatted CSV file
   */
  exportCSV() {
    if (!window.nocAuth.isAdmin()) {
      window.showToast('Admin access required to export CSV spreadsheet.', 'error');
      return;
    }

    if (!this.filteredRecords || this.filteredRecords.length === 0) {
      window.showToast('No records to export.', 'info');
      return;
    }

    const headers = [
      'NOC Number',
      'NOC Type',
      'Client',
      'Issued To',
      'Date of Issuance',
      'Date of Expiration',
      'Status',
      'Attached Documents Count',
      'Description of Work'
    ];

    const rows = this.filteredRecords.map(r => {
      const status = window.nocDB.getStatus(r.dateOfExpiration);
      const docsCount = r.documents ? r.documents.length : 0;
      return [
        `"${(r.nocNumber || '').replace(/"/g, '""')}"`,
        `"${(r.nocType || '').replace(/"/g, '""')}"`,
        `"${(r.client || '').replace(/"/g, '""')}"`,
        `"${(r.issuedTo || '').replace(/"/g, '""')}"`,
        `"${r.dateOfIssuance || ''}"`,
        `"${r.dateOfExpiration || ''}"`,
        `"${status.toUpperCase()}"`,
        docsCount,
        `"${(r.description || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NOC_Records_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.showToast('CSV export downloaded successfully.', 'success');
  }

  /**
   * Export raw JSON database backup
   */
  async exportJSON() {
    if (!window.nocAuth.isAdmin()) {
      window.showToast('Admin access required to download database backup.', 'error');
      return;
    }

    const jsonStr = await window.nocDB.exportJSON();
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr);
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `NOC_Database_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.showToast('JSON database backup downloaded.', 'success');
  }
}

// Bootstrap application once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.nocApp = new NOCApp();
  window.nocApp.init();
});
