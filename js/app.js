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
    this.currentPage = 1;
    this.pageSize = 10;
  }

  /**
   * Main bootstrap method
   */
  async init() {
    console.log('Initializing NOC Portal Application...');

    // 1. Await database initialization and automatic Supabase cloud connection
    if (window.nocDB && window.nocDB.initPromise) {
      await window.nocDB.initPromise;
    }

    // 2. Initialize UI & Auth
    window.nocUI.init();

    // 2.1 Set default sort and initial search query for active user
    const isSBYIM = window.nocAuth && window.nocAuth.isSBYIM();
    const isSecurity = window.nocAuth && window.nocAuth.isSecurity();
    const isEmployee = window.nocAuth && (window.nocAuth.isEmployee ? window.nocAuth.isEmployee() : window.nocAuth.isMain());
    const isAdminUser = window.nocAuth && window.nocAuth.isAdminUser();
    const currentUser = window.nocAuth && window.nocAuth.getUser();

    const isGuest = window.nocAuth && window.nocAuth.isGuest();

    if (isSBYIM || isSecurity || isEmployee || isGuest) {
      this.sortBy = 'issuance';
      const filterSort = document.getElementById('filterSort');
      if (filterSort) filterSort.value = 'issuance';
    } else if (isAdminUser) {
      this.sortBy = 'newest';
      const filterSort = document.getElementById('filterSort');
      if (filterSort) filterSort.value = 'newest';
    }

    if (isGuest && currentUser && currentUser.username) {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = currentUser.username;
      this.searchQuery = currentUser.username;
    } else {
      this.searchQuery = '';
    }

    // 3. Seed initial realistic database if empty
    await window.seedInitialDatabaseIfEmpty();

    // 4. Load all records from active database (Supabase Cloud or Local fallback)
    await this.refreshData();

    // 5. Bind event listeners & populate type filters and form options
    this.bindEvents();
    this.populateTypeFilterOptions();
    this.populateFormTypeOptions('');
    this.populateFormContractorOptions('');

    // 6. Initialize SBYIM AI Assistant UI and sync Approved Documents Knowledge Base
    if (window.sbyimAIUI) {
      window.sbyimAIUI.init();
    }
    if (window.sbyimKnowledgeBase) {
      window.sbyimKnowledgeBase.syncKnowledgeBase().then(() => {
        if (window.sbyimAIUI) window.sbyimAIUI.updateKnowledgeStatusBadge();
      }).catch(err => console.warn('AI Knowledge Base initial sync warning:', err));
    }
  }

  /**
   * Fetch latest data from IndexedDB and re-render
   */
  async refreshData() {
    try {
      this.allRecords = await window.nocDB.getAll();
      if (Array.isArray(this.allRecords)) {
        this.allRecords.forEach(r => {
          if (r && r.issuedTo) {
            r.issuedTo = String(r.issuedTo).trim().toUpperCase();
          }
        });
      }
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
   * Persist a new custom NOC type into database / localStorage
   */
  async saveCustomNocType(newType) {
    if (!newType) return;
    const trimmed = String(newType).trim();
    if (!trimmed) return;

    try {
      await window.nocDB.saveCustomType(trimmed);
    } catch (e) {
      console.warn('Could not save custom type:', e);
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
   * Get all unique Contractors / Companies:
   * Base contractor list + stored custom contractors + distinct issuedTo from active records
   */
  getAvailableContractors() {
    const defaultContractors = [
      'ABU DHABI AVIATION',
      'ABU DHABI DISTRIBUTION COMPANY (ADDC)',
      'ABU DHABI MARINE SPORTS CLUB (ADMSC)',
      'ABU DHABI NATIONAL HOTELS (ADNH)',
      'ABU DHABI PORTS (ADP) / APPROVED CONTRACTOR/S AND SUBCONTRACTORS',
      'ABU DHABI PORTS (ADP) / CAPITAL EXPERIENCE (CE)',
      'ABU DHABI TRANSMISSION & DISPATCH COMPANY (TRANSCO)',
      'ACCESS ADVERTISING LLC. S.P.C. (ACCLADS)',
      'ADB SAFEGATE (ADBS)',
      'ADCEB GROUP FACILITIES MANAGEMENT DIVISION (AGFM)',
      'ADIL CO-ORDINATES PRIVATE LIMITED (ADIL)',
      'ADVANCED ELECTRICAL AND COMMUNICATION SYSTEMS CONTRACTING (AECSC)',
      'ADVANCED PIPELINE SERVICES LTD. L.L.C (ADPS)',
      'AG FACILITIES SOLUTIONS (AG)',
      'AL BAWARDI ALAN DICK LLC (ABAD)',
      'AL FALAK ELECTRONIC EQUIPMENT AND SUPPLIES',
      'AL KAENAT INT SCRAP (AIK)',
      'AL KHAYYAT INVESTMENTS (AKI)',
      'AL MAHARA DIVING CENTER (AMDC)',
      'AL MASAOOD LLC (AML)',
      'AL SAMHA BEACH TRANSPORT (AST)',
      'ALBAQALI INTERNATIONAL (ABI)',
      'ALPHAMED SPECIALISED PROJECTS - SOLE PROPRIETORSHIP (ASPSP)',
      'ANANTARA HOTELS, RESORTS & SPAS (AHRS)',
      'ANSON CONSTRUCTION L.L.C (AC)',
      'ARAB CENTER FOR ENGINEERING STUDIES LTD (ACES)',
      'ARABESQUE LABORATORY FOR SOIL TESTING (AL)',
      'ARABIC ENGINEER CONTROL & ELECTRO MECHANICAL SYSTEMS CO. L.L.C. (AECEMS)',
      'ARC ENGINEERING CONSULTANTS (ARC)',
      'ARIAN ADVANCED TECHNICAL GROUP (AATG)',
      'ASK PUMPS TRADING LLC (ASM)',
      'ATGC LLC',
      'B&M INTERNATIONAL ABU DHABI LLC',
      'BAKAH NATURAL RESOURCES (BNR)',
      'BGP INC. CHINA NATIONAL PETROLEUM CORPORATION',
      'BILFINGER TEBODIN MIDDLE EAST LTD. (BTME)',
      'BIN FADAN GENERAL CONT. L.L.C (BFC)',
      'BISSAN PREFAB HOUSE (BPH)',
      'BLACK BIRD MOTION MEDIA (BBMM)',
      'BOECKER PEST CONTROL LLC',
      'BRIGHT DEAL INTERNATIONAL GENERAL CONTRACTING (BDC)',
      'BRYNE GULF OILFIELD',
      'CANAL ENGINEERING SERVICES (CES)',
      'CAPITAL 360 (C360)',
      'CAPITAL EXPERIENCE (CE)',
      'CAPITAL SURVEY (CS)',
      'CH2M HILL INTERNATIONAL B.V. (CH2M)',
      'CHOPPER SHOOT ART PRODUCTION (CSAP)',
      'CITTA GROUP (CITTA)',
      'CITY SURVEYS (CS)',
      'CODA TECHNOLOGY LLC (CODA)',
      'CONTINENTAL GENERAL CONTRACTING (CGC)',
      'DEPARTMENT OF CULTURE AND TOURISM (DCT)',
      'DHAFIR TECHNOLOGIES LLC (DT)',
      'DR. MAHMOUD AL-AL SAYED ENGINEERING CONSULTANCY & DESIGN BUREAU (AES)',
      'E&I ENTERPRISE (E&I)',
      'EFS FACILITIES SERVICES (EFS)',
      'ELADAL ASSET MANAGEMENT GROUP L.L.C.',
      'ELITE AGRICULTURE MANAGEMENT L.L.C.',
      'EMARAT EUROPE GENERAL CONTRACTING LLC',
      'E-MARINE (EMAT)',
      'EMI MDS by C& (EMIMDS)',
      'EMIRATES INTEGRATED TELECOMMUNICATION COMPANY (EITC-DU)',
      'EMIRATES LINK NITCO LLC (ELN)',
      'ENTERPRISE SUSTAINABLE ENERGY (ESE)',
      'ETIMAD STRATEGIC SECURITY SOLUTIONS (ESSS)',
      'ETISALAT AND (E&)',
      'ETISALAT FACILITIES MANAGEMENT (EFM)',
      'ETISALAT SERVICES HOLDING (ESH)',
      'ETISALAT SERVICES HOLDING (TK)',
      'FALCON SURVEY ENGINEERING CONSULTANT',
      'FERROPAN OILFIELD SERVICES & SUPPLIES LLC',
      'FIRST RESPONDED MAINTENANCE AND BUILDING CLEANING (FR)',
      'FIRST SOURCE',
      'FRANCIS TECHNICAL SERVICES',
      'FREIBURG CONTRACTING & GENERAL MAINTENANCE L.L.C (FR)',
      'FUGRO SURVEY MIDDLE EAST (FSME)',
      'G4S SECURE SOLUTIONS L.L.C. (G4S)',
      'GSP POWER EQUIPMENT TRADING LLC (GSP)',
      'GULF DUNES LANDSCAPING & AGRICULTURAL SERVICES',
      'GULF INDUSTRIAL SERVICES COMPANY L.L.C (GISCO)',
      'GULF SURVEY',
      'GULF MULTISPORTS (GMS)',
      'HASSAN SULTAN FOR CONTRACTING & GENERAL MAINTENANCE (HS)',
      'HAYAT COMMUNICATION LLC (HC)',
      'HD GLOBAL PTY LTD (I)',
      'HI" DECORATION L.L.C.',
      'HOLIDAY PANORAMA TOURISM (HPT)',
      'HUMAID AL QUBAISI (HAQ)',
      'HYDROPOWER ENERGY AND GENERAL CONSTRUCTION LLC',
      'HYPSOS MIDDLE EAST',
      'I GULF / GULF FIREWORKS SOLE PROPRIETORSHIP (IGF)',
      'INSPACIAL GENERAL CONTRACTING (IGC)',
      'INTELTEC EMIRATES LLC',
      'ITTIHAD PEST CONTROL EST. (IPCE)',
      'JAN DE NUL DREDGING LTD. (JDN)',
      'JAZAL ENGINEERING & CONTRACTING L.L.C',
      'KDU WORLDWIDE MIDDLE EAST MARINE SERVICES LLC',
      'KEMS',
      'LAST VOYAGE',
      'LOTTE ENGINEERING GENERAL CONTRACTING CO. L.L.C',
      'M1 CONTRACTING S.A.L.R (M1C)',
      'MASDAR SPECIALIZED TECHNICAL SERVICES O&M LLC (MSTS)',
      'MIDDLE EAST SURVEY ENGINEERING',
      'MISSION GLOBAL',
      'MODON',
      'MOUNTAIN QUESTS ENTERTAINMENTS SERVICES LLC / AL MAHARA (MQ)',
      'MUNAWALA GROUND SERVICES',
      'NAFTCO ELECTROMECHANICAL LLC (NAFTCO)',
      'NATIONAL MARINE DREDGING COMPANY (NMDC)',
      'NETCOM COMMUNICATIONS TECHNOLOGY LLC (NCT)',
      'NOFIM GENERAL CONTRACTING (NGC)',
      'OASIS COILS & COATINGS L.L.C. (OCC)',
      'OHM ELECTROMECHANICAL CONTRACTING',
      'POWER CONSTRUCTION CORPORATION OF CHINA LTD (PC)',
      'PURE WATER TECHNOLOGY LLC',
      'RCC EL RACE (RCC)',
      'REALEYEZ MEDIA PRODUCTIONS (REMP)',
      'REDFILO EVENTS EXHIBITION ORGANIZING (RFTECO)',
      'RUSTAM KHAN GENERAL MAINTENANCE COMPANY LLC',
      'SCAN CONSTRUCTION',
      'SHADOW PROFESSIONAL PHOTOGRAPHY',
      'SIEMENS INDUSTRIAL (SI)',
      'SINYAR PROPERTY MANAGEMENT (SPM)',
      'SOURCE',
      'SPACE FILMS L.L.C (SF)',
      'TABREED',
      'TADAMUCT',
      'TAMDEED PROJECTS (TP)',
      'TAQA DISTRIBUTION COMPANY (TAQA)',
      'TAQA TRANSMISSION COMPANY (TTC)',
      'TASNEEM GENERAL CONTRACTING (TGC)',
      'TELETRON AGENCIES & TRADING (TAT)',
      'TICKEY TRADERS',
      'TOP TALENT (TT)',
      'TORNADO ENTERPRISES (TE)',
      'TORNADO TOTAL LANDSCAPE (TTL)',
      'TOURISM 365 (T365)',
      'TRANS DESERT CONT. GEN. MAINT. EST.',
      'TROJAN GENERAL CONTRACTING LLC',
      'VENUS INFRASTRUCTURE CONTRACTING L.L.C (VIC)',
      'WALKTHRU (WTD)',
      'WALTZ SOLUTIONS AND SERVICES LLC (WSS)',
      'WIPE OUT PEST CONTROL EST. (WPC)',
      'WOOD DESIGN AND MANAGEMENT GULF FZ LLC (WDMG)',
      'XAD TECHNOLOGIES LLC',
      'YPPH HOSPITALITY COMPANY LLC (YH) & SHINAR HOSPITALITY (SH) & SISTER COMPANIES'
    ];

    let customContractors = [];
    try {
      const stored = localStorage.getItem('noc_custom_contractors');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) customContractors = parsed.map(c => String(c).trim().toUpperCase()).filter(Boolean);
      }
    } catch (e) {
      console.warn('Could not read custom contractors from localStorage', e);
    }

    let renames = {};
    try {
      const storedRenames = localStorage.getItem('noc_contractor_renames');
      if (storedRenames) renames = JSON.parse(storedRenames);
    } catch (e) {
      console.warn('Could not read contractor renames from localStorage', e);
    }

    const mappedDefaults = defaultContractors.map(c => (renames && renames[c]) ? renames[c] : c);
    const recordContractors = (this.allRecords || []).map(r => r.issuedTo ? String(r.issuedTo).trim().toUpperCase() : '').filter(Boolean);
    const combined = [...mappedDefaults, ...customContractors, ...recordContractors];

    const seen = new Set();
    const unique = [];
    for (const c of combined) {
      const upper = String(c).trim().toUpperCase();
      if (!upper) continue;
      if (!seen.has(upper)) {
        seen.add(upper);
        unique.push(upper);
      }
    }
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }

  /**
   * Persist a new custom Contractor into database / localStorage
   */
  async saveCustomContractor(newContractor) {
    if (!newContractor) return;
    const trimmed = String(newContractor).trim().toUpperCase();
    if (!trimmed) return;

    try {
      await window.nocDB.saveCustomContractor(trimmed);
    } catch (e) {
      console.warn('Could not save custom contractor:', e);
    }
  }

  /**
   * Update / Rename Contractor name across DB, records, and dropdown
   */
  async updateContractorName(oldName, newName) {
    if (!oldName || !newName) return;
    const oldUpper = String(oldName).trim().toUpperCase();
    const newUpper = String(newName).trim().toUpperCase();
    if (!oldUpper || !newUpper || oldUpper === newUpper) return;

    // 1. Update in DB / localStorage
    if (window.nocDB && typeof window.nocDB.updateCustomContractor === 'function') {
      await window.nocDB.updateCustomContractor(oldUpper, newUpper);
    }

    // 2. Update records in memory
    if (this.allRecords && this.allRecords.length > 0) {
      this.allRecords.forEach(r => {
        if (r.issuedTo && r.issuedTo.trim().toUpperCase() === oldUpper) {
          r.issuedTo = newUpper;
        }
      });
    }

    // 3. Refresh filtered records table
    this.applyFilters();

    // 4. Repopulate modal dropdown with new company name selected
    this.populateFormContractorOptions(newUpper);
  }

  /**
   * Populate Create/Edit modal form Issued To (Contractor/Company) dropdown
   */
  populateFormContractorOptions(selectedContractor = '') {
    const select = document.getElementById('issuedToSelect');
    if (!select) return;

    const customContainer = document.getElementById('customContractorContainer');
    const customInput = document.getElementById('issuedToCustomInput');

    const contractors = this.getAvailableContractors();
    select.innerHTML = '<option value="" disabled selected>-- Select Contractor / Company --</option>';

    const targetUpper = (selectedContractor || '').trim().toUpperCase();
    let found = false;
    contractors.forEach(contractor => {
      const upper = contractor.toUpperCase();
      const opt = document.createElement('option');
      opt.value = upper;
      opt.textContent = upper;
      if (targetUpper && upper === targetUpper) {
        opt.selected = true;
        found = true;
      }
      select.appendChild(opt);
    });

    // Special option for adding a new contractor if not in the dropdown
    const addOpt = document.createElement('option');
    addOpt.value = '__custom__';
    addOpt.textContent = '➕ Add New / Custom Company...';
    select.appendChild(addOpt);

    if (targetUpper) {
      if (found) {
        if (customContainer) customContainer.style.display = 'none';
        if (customInput) {
          customInput.value = '';
          customInput.required = false;
        }
      } else {
        // Record has a contractor not currently in the base list: dynamically add option and select it
        const customOpt = document.createElement('option');
        customOpt.value = targetUpper;
        customOpt.textContent = targetUpper;
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
    const isLoggedIn = window.nocAuth && window.nocAuth.isLoggedIn();
    if (!isLoggedIn) {
      this.filteredRecords = [];
      window.nocUI.renderRecords([]);
      return;
    }

    const q = this.searchQuery.trim().toLowerCase();
    const isGuest = window.nocAuth.isGuest();

    this.filteredRecords = this.allRecords.filter((rec) => {
      // 1. Search filter: Guest can search by NOC Number, Issued To, and Client; Admin can search all fields
      let matchesSearch = true;
      if (q) {
        if (isGuest) {
          matchesSearch = (
            (rec.nocNumber && rec.nocNumber.toLowerCase().includes(q)) ||
            (rec.issuedTo && rec.issuedTo.toLowerCase().includes(q)) ||
            (rec.companyCode && rec.companyCode.toLowerCase().includes(q)) ||
            (rec.nocType && rec.nocType.toLowerCase().includes(q)) ||
            (rec.description && rec.description.toLowerCase().includes(q))
          );
        } else {
          matchesSearch = (
            (rec.nocNumber && rec.nocNumber.toLowerCase().includes(q)) ||
            (rec.nocType && rec.nocType.toLowerCase().includes(q)) ||
            (rec.client && rec.client.toLowerCase().includes(q)) ||
            (rec.issuedTo && rec.issuedTo.toLowerCase().includes(q)) ||
            (rec.companyCode && rec.companyCode.toLowerCase().includes(q)) ||
            (rec.description && rec.description.toLowerCase().includes(q))
          );
        }
      }

      // 2. Status filter (All users)
      let matchesStatus = true;
      if (this.selectedStatus !== 'all') {
        const status = window.nocDB.getStatus(rec.dateOfExpiration);
        matchesStatus = status === this.selectedStatus;
      }

      // 3. Type filter (All users)
      let matchesType = true;
      if (this.selectedType !== 'all') {
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

    // 5. Paginate records (10 per page)
    const totalRecords = this.filteredRecords.length;
    const pageSize = this.pageSize || 10;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const startIdx = (this.currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalRecords);
    const pageRecords = this.filteredRecords.slice(startIdx, endIdx);

    window.nocUI.renderRecords(pageRecords);
    window.nocUI.renderPagination(this.currentPage, totalPages, totalRecords, startIdx, endIdx);
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
          this.currentPage = 1;
          this.searchQuery = e.target.value;
          this.applyFilters();
        }, 200);
      });
    }

    // Status filter
    const statusFilter = document.getElementById('filterStatus');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentPage = 1;
        this.selectedStatus = e.target.value;
        this.applyFilters();
      });
    }

    // NOC Type filter
    const typeFilter = document.getElementById('filterNocType');
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        this.currentPage = 1;
        this.selectedType = e.target.value;
        this.applyFilters();
      });
    }

    // Sort By filter
    const sortFilter = document.getElementById('filterSort');
    if (sortFilter) {
      sortFilter.addEventListener('change', (e) => {
        this.currentPage = 1;
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
        this.applyFilters();
      });

      btnGridView.addEventListener('click', () => {
        window.nocUI.activeView = 'grid';
        btnGridView.classList.add('active');
        btnTableView.classList.remove('active');
        this.applyFilters();
      });
    }

    // Pagination Click Controls
    const paginationControls = document.getElementById('paginationControls');
    if (paginationControls) {
      paginationControls.addEventListener('click', (e) => {
        const btn = e.target.closest('.pagination-btn');
        if (!btn || btn.disabled || btn.classList.contains('active')) return;
        const targetPage = parseInt(btn.dataset.page, 10);
        if (targetPage && !isNaN(targetPage)) {
          this.currentPage = targetPage;
          this.applyFilters();
          const mainStage = document.getElementById('tableViewContainer') || document.querySelector('.main-wrapper');
          if (mainStage) {
            mainStage.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
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

    // Issued To (Contractor / Company) Select & Custom/Edit Contractor Input interactions
    const issuedToSelect = document.getElementById('issuedToSelect');
    const customContractorContainer = document.getElementById('customContractorContainer');
    const issuedToCustomInput = document.getElementById('issuedToCustomInput');
    const issuedToHint = document.getElementById('issuedToHint');
    const btnCancelCustomContractor = document.getElementById('btnCancelCustomContractor');
    const issuedToEditHint = document.getElementById('issuedToEditHint');
    const editContractorContainer = document.getElementById('editContractorContainer');
    const issuedToEditInput = document.getElementById('issuedToEditInput');
    const btnSaveEditContractor = document.getElementById('btnSaveEditContractor');
    const btnCancelEditContractor = document.getElementById('btnCancelEditContractor');

    if (issuedToSelect) {
      issuedToSelect.addEventListener('change', (e) => {
        if (editContractorContainer) editContractorContainer.style.display = 'none';
        if (issuedToEditInput) {
          issuedToEditInput.value = '';
          issuedToEditInput.dataset.originalValue = '';
        }

        if (e.target.value === '__custom__') {
          if (customContractorContainer) customContractorContainer.style.display = 'block';
          if (issuedToCustomInput) {
            issuedToCustomInput.required = true;
            issuedToCustomInput.focus();
          }
        } else {
          if (customContractorContainer) customContractorContainer.style.display = 'none';
          if (issuedToCustomInput) {
            issuedToCustomInput.required = false;
            issuedToCustomInput.value = '';
          }
        }
      });
    }

    if (issuedToHint) {
      issuedToHint.addEventListener('click', () => {
        if (editContractorContainer) editContractorContainer.style.display = 'none';
        if (issuedToEditInput) {
          issuedToEditInput.value = '';
          issuedToEditInput.dataset.originalValue = '';
        }

        if (issuedToSelect) issuedToSelect.value = '__custom__';
        if (customContractorContainer) customContractorContainer.style.display = 'block';
        if (issuedToCustomInput) {
          issuedToCustomInput.required = true;
          issuedToCustomInput.focus();
        }
      });
    }

    if (issuedToCustomInput) {
      issuedToCustomInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
      });
    }

    if (btnCancelCustomContractor) {
      btnCancelCustomContractor.addEventListener('click', () => {
        if (customContractorContainer) customContractorContainer.style.display = 'none';
        if (issuedToCustomInput) {
          issuedToCustomInput.required = false;
          issuedToCustomInput.value = '';
        }
        if (issuedToSelect) issuedToSelect.value = '';
      });
    }

    if (issuedToEditHint) {
      issuedToEditHint.addEventListener('click', () => {
        const currentVal = issuedToSelect ? issuedToSelect.value.trim() : '';
        if (!currentVal || currentVal === '__custom__') {
          if (window.showToast) {
            window.showToast('Please select a Contractor / Company from the dropdown to edit.', 'info');
          }
          return;
        }

        if (customContractorContainer) customContractorContainer.style.display = 'none';
        if (issuedToCustomInput) {
          issuedToCustomInput.required = false;
          issuedToCustomInput.value = '';
        }

        if (editContractorContainer) editContractorContainer.style.display = 'block';
        if (issuedToEditInput) {
          issuedToEditInput.value = currentVal;
          issuedToEditInput.dataset.originalValue = currentVal;
          issuedToEditInput.focus();
          issuedToEditInput.select();
        }
      });
    }

    if (issuedToEditInput) {
      issuedToEditInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
      });
      issuedToEditInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (btnSaveEditContractor) btnSaveEditContractor.click();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (btnCancelEditContractor) btnCancelEditContractor.click();
        }
      });
    }

    if (btnSaveEditContractor) {
      btnSaveEditContractor.addEventListener('click', async () => {
        const oldName = issuedToEditInput ? (issuedToEditInput.dataset.originalValue || '').trim().toUpperCase() : '';
        const newName = issuedToEditInput ? issuedToEditInput.value.trim().toUpperCase() : '';

        if (!newName) {
          if (window.showToast) window.showToast('Contractor / Company name cannot be empty.', 'error');
          return;
        }

        if (newName === oldName) {
          if (editContractorContainer) editContractorContainer.style.display = 'none';
          if (window.showToast) window.showToast('No changes made to company name.', 'info');
          return;
        }

        btnSaveEditContractor.disabled = true;
        try {
          await window.nocApp.updateContractorName(oldName, newName);
          if (editContractorContainer) editContractorContainer.style.display = 'none';
          if (issuedToEditInput) {
            issuedToEditInput.value = '';
            issuedToEditInput.dataset.originalValue = '';
          }
          if (window.showToast) window.showToast(`Company updated to "${newName}" successfully.`, 'success');
        } catch (err) {
          if (window.showToast) window.showToast('Failed to update company name: ' + err.message, 'error');
        } finally {
          btnSaveEditContractor.disabled = false;
        }
      });
    }

    if (btnCancelEditContractor) {
      btnCancelEditContractor.addEventListener('click', () => {
        if (editContractorContainer) editContractorContainer.style.display = 'none';
        if (issuedToEditInput) {
          issuedToEditInput.value = '';
          issuedToEditInput.dataset.originalValue = '';
        }
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

    // Login Form Submission & Modal Controls
    const btnCloseLoginModal = document.getElementById('btnCloseLoginModal');
    if (btnCloseLoginModal) btnCloseLoginModal.addEventListener('click', () => window.nocUI.closeLoginModal());

    // Show/Hide Password Toggle Buttons
    this.setupPasswordToggle('btnToggleLoginPassword', 'loginPassword', 'password');
    this.setupPasswordToggle('btnToggleSupabaseKey', 'inputSupabaseKey', 'API key');

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('loginUsername').value;
        const p = document.getElementById('loginPassword').value;
        const rememberMe = !!(document.getElementById('loginRememberMe') && document.getElementById('loginRememberMe').checked);
        const res = window.nocAuth.login(u, p, rememberMe);
        if (res.success) {
          window.nocUI.closeLoginModal(true);
          const isGuestUser = res.user.role === 'guest';
          const isMainUser = res.user.role === 'main' || res.user.role === 'employee';
          const isSecurityUser = res.user.role === 'security';
          const isSBYIMUser = res.user.username.toLowerCase() === 'sbyim';

          if (isGuestUser || isSecurityUser || isSBYIMUser || isMainUser) {
            this.sortBy = 'issuance';
            const filterSort = document.getElementById('filterSort');
            if (filterSort) filterSort.value = 'issuance';
          }

          this.currentPage = 1;
          const isAutoSearch = isGuestUser;
          const queryVal = isAutoSearch ? res.user.username : '';
          const searchInput = document.getElementById('searchInput');
          if (searchInput) {
            searchInput.value = queryVal;
          }
          this.searchQuery = queryVal;
          this.applyFilters();
          window.showToast(`Logged in successfully as "${res.user.username}" (${res.user.role.toUpperCase()}).` + (isAutoSearch ? ` Searching corresponding data files for "${res.user.username}" (Sorted by Issuance Date)...` : ((isSecurityUser || isMainUser || isSBYIMUser) ? ' Sorted by Issuance Date.' : '')), 'success');
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
        const isGuest = window.nocAuth && window.nocAuth.isGuest();
        window.showToast(`Starting download for ${docs.length} requirement file(s)...`, 'info');

        for (let idx = 0; idx < docs.length; idx++) {
          const d = docs[idx];
          const isPdf = (d.type && d.type.includes('pdf')) || (d.name && d.name.toLowerCase().endsWith('.pdf'));

          let downloadData = d.dataUrl;
          let downloadName = `Requirement_${d.name}`;

          if (isGuest && isPdf) {
            const baseName = d.name.replace(/\.pdf$/i, '');
            downloadName = `Requirement_${baseName}_Page_1.pdf`;
            const blob = await window.docViewer.getFirstPagePdfBlob(d.dataUrl);
            if (blob) {
              downloadData = blob;
            }
          }

          setTimeout(() => {
            window.docViewer.triggerFileDownload(downloadData, downloadName);
          }, idx * 400);
        }
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

    // SBYI COC Modal (Up to 8 PDF Documents)
    const btnSbyiCoc = document.getElementById('btnSbyiCoc');
    const btnCloseCocModal = document.getElementById('btnCloseCocModal');
    const btnCloseCocModalFooter = document.getElementById('btnCloseCocModalFooter');
    const btnDownloadAllCocDocs = document.getElementById('btnDownloadAllCocDocs');
    const cocDropzone = document.getElementById('cocDropzone');
    const cocFilesInput = document.getElementById('cocFilesInput');

    if (btnSbyiCoc) {
      btnSbyiCoc.addEventListener('click', () => {
        window.nocUI.openCocModal();
      });
    }

    if (btnCloseCocModal) {
      btnCloseCocModal.addEventListener('click', () => {
        window.nocUI.closeCocModal();
      });
    }

    if (btnCloseCocModalFooter) {
      btnCloseCocModalFooter.addEventListener('click', () => {
        window.nocUI.closeCocModal();
      });
    }

    if (btnDownloadAllCocDocs) {
      btnDownloadAllCocDocs.addEventListener('click', async () => {
        const docs = await window.nocDB.getCocDocs();
        if (!docs || docs.length === 0) {
          window.showToast('No SBYI COC documents available to download.', 'info');
          return;
        }
        window.showToast(`Starting download for ${docs.length} SBYI COC file(s)...`, 'info');

        for (let idx = 0; idx < docs.length; idx++) {
          const d = docs[idx];
          setTimeout(() => {
            window.docViewer.triggerFileDownload(d.dataUrl, `SBYI_COC_${d.name}`);
          }, idx * 400);
        }
      });
    }

    if (cocDropzone && cocFilesInput) {
      cocDropzone.addEventListener('click', () => {
        if (!window.nocAuth.isAdmin()) {
          window.showToast('Admin privileges required to upload SBYI COC documents.', 'error');
          return;
        }
        cocFilesInput.click();
      });

      const handleCocUploads = async (fileList) => {
        if (!window.nocAuth.isAdmin()) {
          window.showToast('Admin privileges required to upload SBYI COC documents.', 'error');
          return;
        }

        const files = Array.from(fileList);
        if (files.length === 0) return;

        const existingDocs = await window.nocDB.getCocDocs();
        const availableSlots = 8 - existingDocs.length;

        if (availableSlots <= 0) {
          window.showToast('Maximum of 8 SBYI COC PDF documents reached. Please delete an existing document first.', 'error');
          return;
        }

        // Validate strictly PDF files only
        const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
        const rejectedCount = files.length - pdfFiles.length;

        if (rejectedCount > 0) {
          window.showToast(`${rejectedCount} non-PDF file(s) skipped. SBYI COC accepts PDF files only.`, 'warning');
        }

        if (pdfFiles.length === 0) {
          window.showToast('Only PDF files can be uploaded.', 'error');
          return;
        }

        const toUpload = pdfFiles.slice(0, availableSlots);
        if (pdfFiles.length > availableSlots) {
          window.showToast(`Only ${availableSlots} file(s) can be added (max 8 total).`, 'info');
        }

        window.showToast(`Uploading ${toUpload.length} SBYI COC PDF file(s)...`, 'info');

        const newDocs = [];
        for (const file of toUpload) {
          if (file.size > 25 * 1024 * 1024) {
            window.showToast(`"${file.name}" exceeds 25MB limit.`, 'error');
            continue;
          }

          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
          });

          newDocs.push({
            id: 'coc_doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            name: file.name,
            type: 'application/pdf',
            size: file.size,
            dataUrl: dataUrl,
            uploadedAt: new Date().toISOString(),
            uploadedBy: window.nocAuth.currentUser?.displayName || 'Admin'
          });
        }

        const updatedList = [...existingDocs, ...newDocs];
        await window.nocDB.saveCocDocs(updatedList);
        await window.nocUI.openCocModal();
        const isDb = window.nocDB.isSupabaseActive();
        window.showToast(`Successfully uploaded ${newDocs.length} SBYI COC PDF document(s)${isDb ? ' to Supabase database' : ''}!`, 'success');
        cocFilesInput.value = '';
      };

      cocFilesInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleCocUploads(e.target.files);
        }
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        cocDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          cocDropzone.style.borderColor = '#D97706';
          cocDropzone.style.background = '#FEF3C7';
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        cocDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          cocDropzone.style.borderColor = '#F59E0B';
          cocDropzone.style.background = 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)';
        });
      });

      cocDropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          handleCocUploads(dt.files);
        }
      });
    }

    // ========================================================================
    // AI Documents Modal (DOC, DOCX, or PDF Files Only - Admin Only)
    // ========================================================================
    const btnAiDocuments = document.getElementById('btnAiDocuments');
    const btnCloseAiDocsModal = document.getElementById('btnCloseAiDocsModal');
    const btnCloseAiDocsModalFooter = document.getElementById('btnCloseAiDocsModalFooter');
    const btnDownloadAllAiDocs = document.getElementById('btnDownloadAllAiDocs');
    const aiDocDropzone = document.getElementById('aiDocDropzone');
    const aiDocFilesInput = document.getElementById('aiDocFilesInput');

    if (btnAiDocuments) {
      btnAiDocuments.addEventListener('click', () => {
        if (!window.nocAuth || !window.nocAuth.canManageAiDocs()) {
          window.showToast('Access restricted: System Administrator access required for AI Documents.', 'error');
          return;
        }
        window.nocUI.openAiDocumentsModal();
      });
    }

    if (btnCloseAiDocsModal) {
      btnCloseAiDocsModal.addEventListener('click', () => {
        window.nocUI.closeAiDocumentsModal();
      });
    }

    if (btnCloseAiDocsModalFooter) {
      btnCloseAiDocsModalFooter.addEventListener('click', () => {
        window.nocUI.closeAiDocumentsModal();
      });
    }

    if (btnDownloadAllAiDocs) {
      btnDownloadAllAiDocs.addEventListener('click', async () => {
        const docs = await window.nocDB.getAiDocs();
        if (!docs || docs.length === 0) {
          window.showToast('No AI documents available to download.', 'info');
          return;
        }
        window.showToast(`Starting download for ${docs.length} AI document file(s)...`, 'info');

        for (let idx = 0; idx < docs.length; idx++) {
          const d = docs[idx];
          setTimeout(() => {
            window.docViewer.triggerFileDownload(d.dataUrl, `AI_${d.name}`);
          }, idx * 400);
        }
      });
    }

    if (aiDocDropzone && aiDocFilesInput) {
      aiDocDropzone.addEventListener('click', () => {
        if (!window.nocAuth || !window.nocAuth.canManageAiDocs()) {
          window.showToast('Admin privileges required to upload AI documents.', 'error');
          return;
        }
        aiDocFilesInput.click();
      });

      const isAllowedDocFile = (file) => {
        const name = (file.name || '').toLowerCase();
        const type = (file.type || '').toLowerCase();
        return name.endsWith('.doc') || name.endsWith('.docx') || name.endsWith('.pdf') ||
               type.includes('pdf') || type.includes('wordprocessingml') || type.includes('msword');
      };

      const handleAiDocUploads = async (fileList) => {
        if (!window.nocAuth || !window.nocAuth.canManageAiDocs()) {
          window.showToast('Admin privileges required to upload AI documents.', 'error');
          return;
        }

        const files = Array.from(fileList);
        if (files.length === 0) return;

        // Strictly validate: DOC, DOCX, or PDF only
        const allowedFiles = files.filter(isAllowedDocFile);
        const rejectedCount = files.length - allowedFiles.length;

        if (rejectedCount > 0) {
          window.showToast(`${rejectedCount} unsupported file(s) skipped. AI Documents accepts DOC, DOCX, or PDF files only.`, 'warning');
        }

        if (allowedFiles.length === 0) {
          window.showToast('Only DOC, DOCX, or PDF files can be uploaded.', 'error');
          return;
        }

        window.showToast(`Processing ${allowedFiles.length} AI document(s)...`, 'info');

        const existingDocs = await window.nocDB.getAiDocs();
        const newDocs = [];

        for (const file of allowedFiles) {
          if (file.size > 25 * 1024 * 1024) {
            window.showToast(`"${file.name}" exceeds 25MB limit.`, 'error');
            continue;
          }

          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
          });

          const nameLower = file.name.toLowerCase();
          let mimeType = file.type;
          if (!mimeType) {
            if (nameLower.endsWith('.pdf')) mimeType = 'application/pdf';
            else if (nameLower.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            else if (nameLower.endsWith('.doc')) mimeType = 'application/msword';
            else mimeType = 'application/octet-stream';
          }

          newDocs.push({
            id: 'ai_doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            name: file.name,
            type: mimeType,
            size: file.size,
            dataUrl: dataUrl,
            uploadedAt: new Date().toISOString(),
            uploadedBy: window.nocAuth.currentUser?.displayName || 'Admin'
          });
        }

        if (newDocs.length === 0) return;

        const updatedList = [...existingDocs, ...newDocs];
        await window.nocDB.saveAiDocs(updatedList);
        await window.nocUI.openAiDocumentsModal();
        const isDb = window.nocDB.isSupabaseActive();
        window.showToast(`Successfully uploaded ${newDocs.length} AI document(s) & indexed in Knowledge Base${isDb ? ' (Synced with Supabase)' : ''}!`, 'success');
        aiDocFilesInput.value = '';
      };

      aiDocFilesInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleAiDocUploads(e.target.files);
        }
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        aiDocDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          aiDocDropzone.style.borderColor = '#6366F1';
          aiDocDropzone.style.background = '#EEF2FF';
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        aiDocDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          aiDocDropzone.style.borderColor = '#818CF8';
          aiDocDropzone.style.background = 'linear-gradient(135deg, #EEF2FF 0%, #FAF5FF 100%)';
        });
      });

      aiDocDropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          handleAiDocUploads(dt.files);
        }
      });
    }

    // Export Utilities
    const btnExportCSV = document.getElementById('btnExportCSV');
    const btnExportJSON = document.getElementById('btnExportJSON');
    const btnPrintReport = document.getElementById('btnPrintReport');

    if (btnExportCSV) btnExportCSV.addEventListener('click', () => this.exportCSV());
    if (btnExportJSON) btnExportJSON.addEventListener('click', () => this.exportJSON());
    if (btnPrintReport) {
      btnPrintReport.addEventListener('click', () => {
        if (!window.nocAuth.isAdmin()) {
          window.showToast('Admin access required to print report.', 'error');
          return;
        }
        window.print();
      });
    }

    // ========================================================================
    // Supabase / PostgreSQL Database Modal Events
    // ========================================================================
    const btnDatabaseConfig = document.getElementById('btnDatabaseConfig');
    const btnCloseDatabaseModal = document.getElementById('btnCloseDatabaseModal');
    const btnCloseDatabaseModalFooter = document.getElementById('btnCloseDatabaseModalFooter');
    const btnSaveSupabaseConfig = document.getElementById('btnSaveSupabaseConfig');
    const btnTestSupabaseConnection = document.getElementById('btnTestSupabaseConnection');
    const btnClearSupabaseConfig = document.getElementById('btnClearSupabaseConfig');
    const btnSyncToSupabase = document.getElementById('btnSyncToSupabase');
    const btnCopySqlSchema = document.getElementById('btnCopySqlSchema');

    if (btnDatabaseConfig) {
      btnDatabaseConfig.addEventListener('click', () => {
        if (!window.nocAuth || !window.nocAuth.isAdmin()) {
          window.showToast('Administrator privileges required for Database Settings.', 'error');
          return;
        }
        window.nocUI.openDatabaseModal();
      });
    }

    if (btnCloseDatabaseModal) {
      btnCloseDatabaseModal.addEventListener('click', () => {
        window.nocUI.closeDatabaseModal();
      });
    }

    if (btnCloseDatabaseModalFooter) {
      btnCloseDatabaseModalFooter.addEventListener('click', () => {
        window.nocUI.closeDatabaseModal();
      });
    }

    // Save Supabase Project Credentials & Connect
    if (btnSaveSupabaseConfig) {
      btnSaveSupabaseConfig.addEventListener('click', async () => {
        const url = (document.getElementById('inputSupabaseUrl')?.value || '').trim();
        const key = (document.getElementById('inputSupabaseKey')?.value || '').trim();

        if (!url || !key) {
          window.showToast('Please enter both Supabase URL and Anon Key.', 'error');
          return;
        }

        btnSaveSupabaseConfig.disabled = true;
        btnSaveSupabaseConfig.textContent = 'Connecting...';

        try {
          window.supabaseManager.saveCredentials(url, key);
          const result = await window.supabaseManager.testConnection();

          if (result.success) {
            window.showToast('Connected to Supabase PostgreSQL database!', 'success');
            await this.refreshData();
          } else {
            window.showToast(result.message || 'Connection failed.', 'error');
          }
        } catch (err) {
          window.showToast('Error saving credentials: ' + err.message, 'error');
        } finally {
          btnSaveSupabaseConfig.disabled = false;
          btnSaveSupabaseConfig.textContent = '💾 Save & Connect';
          window.nocUI.renderDatabaseStatus();
        }
      });
    }

    // Test Supabase Connection
    if (btnTestSupabaseConnection) {
      btnTestSupabaseConnection.addEventListener('click', async () => {
        const url = (document.getElementById('inputSupabaseUrl')?.value || '').trim();
        const key = (document.getElementById('inputSupabaseKey')?.value || '').trim();

        if (url && key) {
          window.supabaseManager.saveCredentials(url, key);
        }

        btnTestSupabaseConnection.disabled = true;
        btnTestSupabaseConnection.textContent = 'Testing...';

        try {
          const result = await window.supabaseManager.testConnection();
          if (result.success) {
            window.showToast('Supabase PostgreSQL connection successful! ⚡', 'success');
          } else {
            window.showToast(result.message || 'Connection test failed.', 'error');
          }
        } catch (err) {
          window.showToast('Connection test error: ' + err.message, 'error');
        } finally {
          btnTestSupabaseConnection.disabled = false;
          btnTestSupabaseConnection.textContent = '🔌 Test Connection';
          window.nocUI.renderDatabaseStatus();
        }
      });
    }

    // Clear Credentials & Disconnect
    if (btnClearSupabaseConfig) {
      btnClearSupabaseConfig.addEventListener('click', async () => {
        if (confirm('Disconnect Supabase and switch back to Local Persistent Storage?')) {
          window.supabaseManager.clearCredentials();
          const urlInput = document.getElementById('inputSupabaseUrl');
          const keyInput = document.getElementById('inputSupabaseKey');
          if (urlInput) urlInput.value = '';
          if (keyInput) keyInput.value = '';
          window.showToast('Reverted to Local Storage mode.', 'info');
          window.nocUI.renderDatabaseStatus();
          await this.refreshData();
        }
      });
    }

    // 1-Click Sync Local Records to Supabase
    if (btnSyncToSupabase) {
      btnSyncToSupabase.addEventListener('click', async () => {
        if (!window.supabaseManager || !window.supabaseManager.isConfigured()) {
          window.showToast('Please configure and connect your Supabase database first.', 'error');
          return;
        }

        btnSyncToSupabase.disabled = true;
        btnSyncToSupabase.textContent = 'Syncing...';

        try {
          const stats = await window.nocDB.syncLocalToSupabase();
          window.showToast(`Sync successful! ${stats.recordsSynced} records, ${stats.reqDocsSynced} guidelines, and ${stats.cocDocsSynced || 0} SBYI COC certificates pushed to Supabase.`, 'success');
          await this.refreshData();
        } catch (err) {
          window.showToast('Sync failed: ' + err.message, 'error');
        } finally {
          btnSyncToSupabase.disabled = false;
          btnSyncToSupabase.textContent = '⬆️ Sync to Supabase';
        }
      });
    }

    // Copy SQL Schema
    if (btnCopySqlSchema) {
      btnCopySqlSchema.addEventListener('click', async () => {
        try {
          const sqlText = window.nocUI.getSqlSchemaText();
          await navigator.clipboard.writeText(sqlText);
          window.showToast('PostgreSQL SQL Schema copied to clipboard!', 'success');
        } catch (err) {
          // Fallback if clipboard API is restricted
          const codeBlock = document.getElementById('sqlSchemaCodeBlock');
          if (codeBlock) {
            const range = document.createRange();
            range.selectNodeContents(codeBlock);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            document.execCommand('copy');
            selection.removeAllRanges();
            window.showToast('SQL Schema copied to clipboard!', 'success');
          } else {
            window.showToast('Could not copy automatically. Please select text manually.', 'error');
          }
        }
      });
    }

    // Setup User Database Listeners (Admin Only)
    this.setupUserDatabaseListeners();
  }

  /**
   * Set up User Database event listeners (Admin Only)
   */
  setupUserDatabaseListeners() {
    const btnUserDatabase = document.getElementById('btnUserDatabase');
    const btnCloseUserDbModal = document.getElementById('btnCloseUserDbModal');
    const btnCloseUserDbModalFooter = document.getElementById('btnCloseUserDbModalFooter');
    const userDbSearchInput = document.getElementById('userDbSearchInput');
    const btnAddUserModal = document.getElementById('btnAddUserModal');
    const userDbTableBody = document.getElementById('userDbTableBody');
    const btnCloseUserEditModal = document.getElementById('btnCloseUserEditModal');
    const btnCancelUserForm = document.getElementById('btnCancelUserForm');
    const userEditForm = document.getElementById('userEditForm');
    const btnToggleUserFormPassword = document.getElementById('btnToggleUserFormPassword');

    // 1. Open User Database Modal
    if (btnUserDatabase) {
      btnUserDatabase.addEventListener('click', () => {
        window.nocUI.openUserDatabaseModal();
      });
    }

    // 2. Close Modal
    if (btnCloseUserDbModal) {
      btnCloseUserDbModal.addEventListener('click', () => {
        window.nocUI.closeUserDatabaseModal();
      });
    }
    if (btnCloseUserDbModalFooter) {
      btnCloseUserDbModalFooter.addEventListener('click', () => {
        window.nocUI.closeUserDatabaseModal();
      });
    }

    // 3. Search Filter
    if (userDbSearchInput) {
      let searchTimeout = null;
      userDbSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          window.nocUI.refreshUserDatabaseView(e.target.value);
        }, 150);
      });
    }

    // 4. Open Add User Modal
    if (btnAddUserModal) {
      btnAddUserModal.addEventListener('click', () => {
        window.nocUI.openUserEditModal(null);
      });
    }

    // 5. Close Edit Modal
    if (btnCloseUserEditModal) {
      btnCloseUserEditModal.addEventListener('click', () => {
        window.nocUI.closeUserEditModal();
      });
    }
    if (btnCancelUserForm) {
      btnCancelUserForm.addEventListener('click', () => {
        window.nocUI.closeUserEditModal();
      });
    }

    // 6. Toggle Password Mask in Form
    this.setupPasswordToggle('btnToggleUserFormPassword', 'userFormPassword', 'password');

    // 7. Table Action Buttons (Edit, Delete, Copy Password)
    if (userDbTableBody) {
      userDbTableBody.addEventListener('click', async (e) => {
        const target = e.target;

        // Copy Password
        const copyBtn = target.closest('.btn-copy-pwd');
        if (copyBtn) {
          const pwd = copyBtn.getAttribute('data-clipboard');
          if (pwd) {
            try {
              await navigator.clipboard.writeText(pwd);
              window.showToast('Password copied to clipboard!', 'success');
            } catch (err) {
              window.showToast('Password: ' + pwd, 'info');
            }
          }
          return;
        }

        // Edit User
        const editBtn = target.closest('.btn-edit-user');
        if (editBtn) {
          const username = editBtn.getAttribute('data-username');
          const users = await window.nocDB.getUsers();
          const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
          if (user) {
            window.nocUI.openUserEditModal(user);
          }
          return;
        }

        // Delete User
        const deleteBtn = target.closest('.btn-delete-user');
        if (deleteBtn) {
          const username = deleteBtn.getAttribute('data-username');
          if (username.toLowerCase() === 'admin' || username.toLowerCase() === 'ryan') {
            window.showToast('Cannot delete the primary Developer account.', 'warning');
            return;
          }

          if (confirm(`Are you sure you want to permanently delete user account "${username}"?`)) {
            try {
              await window.nocDB.deleteUser(username);
              const isDb = window.nocDB.isSupabaseActive();
              window.showToast(`User account "${username}" deleted successfully${isDb ? ' (Synced with Supabase)' : ''}.`, 'success');
              const searchVal = document.getElementById('userDbSearchInput')?.value || '';
              await window.nocUI.refreshUserDatabaseView(searchVal);
            } catch (err) {
              window.showToast('Failed to delete user: ' + err.message, 'error');
            }
          }
          return;
        }
      });
    }

    // 8. Submit Add / Edit User Form
    if (userEditForm) {
      userEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const isEditMode = document.getElementById('userEditIsEditMode')?.value === 'true';
        const origUsername = (document.getElementById('userEditOriginalUsername')?.value || '').trim();
        const username = (document.getElementById('userFormUsername')?.value || '').trim();
        const password = (document.getElementById('userFormPassword')?.value || '').trim();
        const displayName = (document.getElementById('userFormDisplayName')?.value || '').trim();
        const role = (document.getElementById('userFormRole')?.value || 'guest').trim();
        const email = (document.getElementById('userFormEmail')?.value || '').trim();

        if (!username || !password) {
          window.showToast('Username and Password are required.', 'error');
          return;
        }

        if (/\s/.test(username)) {
          window.showToast('Username must not contain spaces.', 'error');
          return;
        }

        if (password.length < 4) {
          window.showToast('Password must be at least 4 characters long.', 'warning');
          return;
        }

        const users = await window.nocDB.getUsers();

        // Check username uniqueness
        if (!isEditMode) {
          const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase());
          if (exists) {
            window.showToast(`Username "${username}" already exists. Please choose a different username.`, 'error');
            return;
          }
        } else {
          // If editing and username changed, ensure new username isn't taken
          if (username.toLowerCase() !== origUsername.toLowerCase()) {
            const exists = users.some(u => u.username.toLowerCase() === username.toLowerCase() && u.username.toLowerCase() !== origUsername.toLowerCase());
            if (exists) {
              window.showToast(`Username "${username}" already exists. Please choose a different username.`, 'error');
              return;
            }
          }
        }

        const submitBtn = document.getElementById('btnSaveUserForm');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Saving...';
        }

        try {
          const userPayload = {
            username: username,
            password: password,
            displayName: displayName || username,
            role: role,
            email: email
          };

          await window.nocDB.saveUser(userPayload, isEditMode ? origUsername : null);
          const isDb = window.nocDB.isSupabaseActive();
          window.showToast(`User account "${userPayload.username}" ${isEditMode ? 'updated' : 'created'} successfully${isDb ? ' (Synced with Supabase)' : ''}!`, 'success');
          
          // Update active session if currently logged in user renamed their account
          if (window.nocAuth && window.nocAuth.currentUser && isEditMode && origUsername) {
            if (window.nocAuth.currentUser.username.toLowerCase() === origUsername.toLowerCase()) {
              window.nocAuth.currentUser.username = userPayload.username;
              window.nocAuth.currentUser.displayName = userPayload.displayName;
              window.nocAuth.currentUser.role = userPayload.role;
              window.nocAuth.currentUser.email = userPayload.email;
              sessionStorage.setItem(window.nocAuth.STORAGE_KEY, JSON.stringify(window.nocAuth.currentUser));
              if (localStorage.getItem(window.nocAuth.STORAGE_KEY)) {
                localStorage.setItem(window.nocAuth.STORAGE_KEY, JSON.stringify(window.nocAuth.currentUser));
              }
              if (localStorage.getItem('noc_remembered_username') === origUsername) {
                localStorage.setItem('noc_remembered_username', userPayload.username);
              }
              window.nocAuth.triggerAuthChange();
            }
          }

          window.nocUI.closeUserEditModal();
          const searchVal = document.getElementById('userDbSearchInput')?.value || '';
          await window.nocUI.refreshUserDatabaseView(searchVal);
        } catch (err) {
          window.showToast('Failed saving user: ' + err.message, 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '💾 Save User';
          }
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

    // Resolve Issued To (Contractor / Company) from select dropdown or custom input
    const issuedToSelect = document.getElementById('issuedToSelect');
    const customContractorContainer = document.getElementById('customContractorContainer');
    const issuedToCustomInput = document.getElementById('issuedToCustomInput');
    let issuedTo = '';
    let isCustomContractor = false;

    if (issuedToSelect && issuedToSelect.value === '__custom__') {
      issuedTo = issuedToCustomInput ? issuedToCustomInput.value.trim().toUpperCase() : '';
      isCustomContractor = true;
    } else if (customContractorContainer && customContractorContainer.style.display !== 'none' && issuedToCustomInput && issuedToCustomInput.value.trim()) {
      issuedTo = issuedToCustomInput.value.trim().toUpperCase();
      isCustomContractor = true;
    } else if (issuedToSelect && issuedToSelect.value) {
      issuedTo = issuedToSelect.value.trim().toUpperCase();
    } else {
      const fallbackInput = document.getElementById('issuedToInput');
      if (fallbackInput) issuedTo = fallbackInput.value.trim().toUpperCase();
    }
    issuedTo = (issuedTo || '').trim().toUpperCase();

    const rawIssuance = document.getElementById('dateIssuanceInput')?.value || '';
    const rawExpiration = document.getElementById('dateExpirationInput')?.value || '';
    const dateOfIssuance = this.parseDateToISO(rawIssuance);
    const dateOfExpiration = this.parseDateToISO(rawExpiration);
    const companyCode = (document.getElementById('companyCodeInput')?.value || '').trim();
    const client = document.getElementById('clientInput').value.trim();
    const description = document.getElementById('descriptionInput').value.trim();

    // Validation
    if (!nocNumber || !nocType || !dateOfIssuance || !dateOfExpiration || !issuedTo || !client || !description) {
      window.showToast('Please fill in all required fields including NOC Type and Issued To.', 'error');
      return;
    }

    if (!window.nocUI.pendingUploadFiles || window.nocUI.pendingUploadFiles.length === 0) {
      window.showToast('Please upload the required NOC Certificate / Document (PDF).', 'error');
      return;
    }

    if (new Date(dateOfExpiration) < new Date(dateOfIssuance)) {
      window.showToast('Date of Expiration cannot be earlier than Date of Issuance.', 'error');
      return;
    }

    if (window.nocUI.pendingUploadFiles.length > 1) {
      window.showToast('Only 1 PDF document can be attached per NOC record.', 'error');
      return;
    }

    // Save custom NOC Type & Contractor so they are permanently available in dropdown menus
    this.saveCustomNocType(nocType);
    this.saveCustomContractor(issuedTo);

    const payload = {
      nocNumber,
      nocType,
      dateOfIssuance,
      dateOfExpiration,
      issuedTo,
      companyCode,
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
   * Helper to parse any date string into standard ISO YYYY-MM-DD
   */
  parseDateToISO(dateStr) {
    if (!dateStr) return '';
    const trimmed = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    const dMMyMatch = trimmed.match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3,9})[\s\-\/](\d{4})$/);
    if (dMMyMatch) {
      const day = dMMyMatch[1].padStart(2, '0');
      const monthStr = dMMyMatch[2].toLowerCase().slice(0, 3);
      const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
      if (months[monthStr]) {
        const year = dMMyMatch[3];
        return `${year}-${months[monthStr]}-${day}`;
      }
    }

    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return trimmed;
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
      'Company Code',
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
        `"${(r.companyCode || '').replace(/"/g, '""')}"`,
        `"${window.nocUI.formatDate(r.dateOfIssuance)}"`,
        `"${window.nocUI.formatDate(r.dateOfExpiration)}"`,
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
    if (!window.nocAuth || !window.nocAuth.canExportJSON()) {
      window.showToast('System Administrator access required to download database backup.', 'error');
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

  /**
   * Universal Show/Hide Password Toggle Handler
   */
  setupPasswordToggle(btnId, inputId, labelText = 'password') {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    const eyeOpenSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const eyeClosedSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword ? eyeClosedSvg : eyeOpenSvg;
      const action = isPassword ? 'Hide' : 'Show';
      btn.title = `${action} ${labelText}`;
      btn.setAttribute('aria-label', `${action} ${labelText}`);
      btn.classList.toggle('active', isPassword);
    });
  }
}

// Bootstrap application once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.nocApp = new NOCApp();
  window.nocApp.init();
});
