/**
 * NOC Portal - In-App Document Viewer & Preview Engine
 * Provides rich in-browser previewing of PDF and Image documents, zoom/rotation controls, and download features.
 */

class DocumentViewer {
  constructor() {
    this.currentDocs = [];
    this.currentIndex = 0;
    this.zoomLevel = 1;
    this.rotation = 0;
    this.overlay = null;

    // Wait for DOM to register overlay elements
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initElements());
    } else {
      this.initElements();
    }
  }

  initElements() {
    this.overlay = document.getElementById('documentViewerOverlay');
    this.stage = document.getElementById('viewerStage');
    this.titleEl = document.getElementById('viewerTitle');
    this.badgeEl = document.getElementById('viewerBadge');
    this.prevBtn = document.getElementById('viewerPrevBtn');
    this.nextBtn = document.getElementById('viewerNextBtn');
    this.downloadBtn = document.getElementById('viewerDownloadBtn');
    this.zoomInBtn = document.getElementById('viewerZoomInBtn');
    this.zoomOutBtn = document.getElementById('viewerZoomOutBtn');
    this.rotateBtn = document.getElementById('viewerRotateBtn');
    this.resetBtn = document.getElementById('viewerResetBtn');
    this.closeBtn = document.getElementById('viewerCloseBtn');
    this.thumbContainer = document.getElementById('viewerThumbs');

    this.bindEvents();
  }

  bindEvents() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.navigate(-1));
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.navigate(1));
    }

    if (this.zoomInBtn) {
      this.zoomInBtn.addEventListener('click', () => this.adjustZoom(0.2));
    }

    if (this.zoomOutBtn) {
      this.zoomOutBtn.addEventListener('click', () => this.adjustZoom(-0.2));
    }

    if (this.rotateBtn) {
      this.rotateBtn.addEventListener('click', () => this.rotate());
    }

    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => this.resetTransform());
    }

    if (this.downloadBtn) {
      this.downloadBtn.addEventListener('click', () => this.downloadCurrent());
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.overlay || !this.overlay.classList.contains('active')) return;

      if (e.key === 'Escape') {
        this.close();
      } else if (e.key === 'ArrowLeft') {
        this.navigate(-1);
      } else if (e.key === 'ArrowRight') {
        this.navigate(1);
      } else if (e.key === '+' || e.key === '=') {
        this.adjustZoom(0.2);
      } else if (e.key === '-') {
        this.adjustZoom(-0.2);
      }
    });

    // Close when clicking outside stage container
    if (this.overlay) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.close();
        }
      });
    }
  }

  /**
   * Open the viewer with an array of documents, starting index, context title, and options.
   */
  open(docs = [], startIndex = 0, contextTitle = '', options = {}) {
    if (!docs || docs.length === 0) {
      if (window.showToast) window.showToast('No documents available to view.', 'info');
      return;
    }

    this.currentDocs = docs;
    this.currentIndex = Math.min(Math.max(0, startIndex), docs.length - 1);
    this.contextTitle = contextTitle || '';
    this.currentOptions = options || {};
    this.zoomLevel = 1;
    this.rotation = 0;

    if (this.overlay) {
      this.overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    this.renderCurrentDocument();
    this.renderThumbnails();
  }

  /**
   * Close the viewer modal.
   */
  close() {
    if (this.overlay) {
      this.overlay.classList.remove('active');
      document.body.style.overflow = '';
      if (this.stage) this.stage.innerHTML = '';
    }
  }

  /**
   * Navigate to previous / next document.
   */
  navigate(delta) {
    const newIndex = this.currentIndex + delta;
    if (newIndex >= 0 && newIndex < this.currentDocs.length) {
      this.currentIndex = newIndex;
      this.zoomLevel = 1;
      this.rotation = 0;
      this.renderCurrentDocument();
      this.renderThumbnails();
    }
  }

  /**
   * Helper to parse dataUrl into Uint8Array bytes
   */
  getPdfBytes(dataUrl) {
    if (!dataUrl) return null;
    if (dataUrl instanceof Uint8Array) return dataUrl;
    if (dataUrl instanceof ArrayBuffer) return new Uint8Array(dataUrl);

    if (typeof dataUrl === 'string') {
      if (dataUrl.startsWith('data:')) {
        const parts = dataUrl.split(',');
        const base64Clean = (parts[1] || '').replace(/\s/g, '');
        const binaryString = atob(base64Clean);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      } else {
        const base64Clean = dataUrl.replace(/\s/g, '');
        const binaryString = atob(base64Clean);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      }
    }
    return null;
  }

  /**
   * Ensure PDF.js library and worker are loaded
   */
  async ensurePdfJsLoaded() {
    if (window.pdfjsLib) {
      if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      return true;
    }
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        if (window.pdfjsLib) {
          if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          }
          resolve(true);
        } else if (attempts++ < 40) {
          setTimeout(check, 100);
        } else {
          resolve(false);
        }
      };
      check();
    });
  }

  /**
   * Ensure PDFLib library is loaded and accessible
   */
  async ensurePdfLibLoaded() {
    if (window.PDFLib && window.PDFLib.PDFDocument) {
      return true;
    }
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        if (window.PDFLib && window.PDFLib.PDFDocument) {
          resolve(true);
        } else if (attempts++ < 40) {
          setTimeout(check, 100);
        } else {
          resolve(false);
        }
      };
      check();
    });
  }

  /**
   * Render Page 1 of a PDF onto a Canvas element (High-DPI)
   */
  async renderPdfPage1ToCanvas(pdfBytes, scale = 2.0) {
    if (!pdfBytes) return null;
    await this.ensurePdfJsLoaded();

    if (window.pdfjsLib) {
      try {
        const dataCopy = pdfBytes.slice ? pdfBytes.slice(0) : new Uint8Array(pdfBytes);
        const loadingTask = window.pdfjsLib.getDocument({ data: dataCopy });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        return canvas;
      } catch (err) {
        console.warn('PDF.js page 1 rendering error:', err);
      }
    }
    return null;
  }

  /**
   * Generate a genuine 1-Page PDF Blob from a Canvas element
   */
  async canvasToSinglePagePdf(canvas) {
    if (!canvas) return null;

    // 1. Try PDF-Lib image embedding
    await this.ensurePdfLibLoaded();
    if (window.PDFLib && window.PDFLib.PDFDocument) {
      try {
        const { PDFDocument } = window.PDFLib;
        const imgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const imgBytes = this.getPdfBytes(imgDataUrl);
        const doc = await PDFDocument.create();
        const embeddedImg = await doc.embedJpg(imgBytes);
        const page = doc.addPage([embeddedImg.width, embeddedImg.height]);
        page.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: embeddedImg.width,
          height: embeddedImg.height,
        });
        const bytes = await doc.save();
        return new Blob([bytes], { type: 'application/pdf' });
      } catch (e) {
        console.warn('PDFLib canvas embedding error:', e);
      }
    }

    // 2. Pure JS Minimal valid PDF 1.4 builder (standard conforming)
    try {
      const imgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const parts = imgDataUrl.split(',');
      const base64 = parts[1];
      const binary = atob(base64);
      const imgLen = binary.length;
      const imgBytes = new Uint8Array(imgLen);
      for (let i = 0; i < imgLen; i++) imgBytes[i] = binary.charCodeAt(i);

      const w = Math.round(canvas.width);
      const h = Math.round(canvas.height);

      const header = `%PDF-1.4\n`;
      const o1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
      const o2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
      const o3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>\nendobj\n`;
      const streamContent = `q\n${w} 0 0 ${h} 0 0 cm\n/Im1 Do\nQ\n`;
      const o4 = `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`;
      const o5Head = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgLen} >>\nstream\n`;
      const o5Tail = `\nendstream\nendobj\n`;

      const encoder = new TextEncoder();
      const bHead = encoder.encode(header + o1 + o2 + o3 + o4 + o5Head);
      const bTail = encoder.encode(o5Tail + `xref\n0 6\n0000000000 65535 f \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n%%EOF\n`);

      const total = new Uint8Array(bHead.length + imgBytes.length + bTail.length);
      total.set(bHead, 0);
      total.set(imgBytes, bHead.length);
      total.set(bTail, bHead.length + imgBytes.length);

      return new Blob([total], { type: 'application/pdf' });
    } catch (err) {
      console.error('Pure JS PDF generation error:', err);
    }
    return null;
  }

  /**
   * Extract first page of PDF and return as a genuine 1-page PDF Blob
   */
  async getFirstPagePdfBlob(dataUrl) {
    if (!dataUrl) return null;

    const pdfBytes = this.getPdfBytes(dataUrl);
    if (!pdfBytes) return null;

    // Priority 1: Vector/Text Page 1 Extraction with PDF-Lib
    await this.ensurePdfLibLoaded();
    if (window.PDFLib && window.PDFLib.PDFDocument) {
      try {
        const { PDFDocument } = window.PDFLib;
        const srcDoc = await PDFDocument.load(pdfBytes.slice ? pdfBytes.slice(0) : pdfBytes, { ignoreEncryption: true });
        
        const singleDoc = await PDFDocument.create();
        const [copiedPage] = await singleDoc.copyPages(srcDoc, [0]);
        singleDoc.addPage(copiedPage);

        const outBytes = await singleDoc.save();
        return new Blob([outBytes], { type: 'application/pdf' });
      } catch (err) {
        console.warn('PDF-Lib exact page 1 extraction fallback to canvas:', err);
      }
    }

    // Priority 2: Render Page 1 to Canvas via PDF.js, then build 1-Page PDF
    try {
      const canvas = await this.renderPdfPage1ToCanvas(pdfBytes, 2.0);
      if (canvas) {
        const pdfBlob = await this.canvasToSinglePagePdf(canvas);
        if (pdfBlob) return pdfBlob;
      }
    } catch (e) {
      console.warn('Render to single page PDF error:', e);
    }

    return null;
  }

  /**
   * Extract first page of PDF for Guest access restriction
   * Generates a genuine 1-page standalone PDF document Data URL
   */
  async getFirstPagePdfDataUrl(dataUrl) {
    const blob = await this.getFirstPagePdfBlob(dataUrl);
    if (blob) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }
    return dataUrl;
  }

  /**
   * Render all pages of a PDF onto high-DPI Canvas elements for universal multi-page viewing
   * across Mobile, Tablet, Laptop, and Desktop screens.
   */
  async renderPdfDocument(pdfBytes, isRestrictedGuest = false) {
    if (!pdfBytes) return false;
    await this.ensurePdfJsLoaded();

    if (!window.pdfjsLib) {
      console.warn('PDF.js library is not available.');
      return false;
    }

    // Show loading spinner
    this.stage.innerHTML = `
      <div class="pdf-loading-spinner">
        <div class="pdf-spinner-circle"></div>
        <div>Rendering document pages...</div>
      </div>
    `;

    try {
      const dataCopy = pdfBytes.slice ? pdfBytes.slice(0) : new Uint8Array(pdfBytes);
      const loadingTask = window.pdfjsLib.getDocument({ data: dataCopy });
      const pdf = await loadingTask.promise;

      const totalPdfPages = pdf.numPages;
      const numPagesToRender = isRestrictedGuest ? 1 : totalPdfPages;

      // Update header title with total page count info
      const doc = this.currentDocs[this.currentIndex];
      let titleText = `${doc.name} (${this.currentIndex + 1}/${this.currentDocs.length}) • ${totalPdfPages} ${totalPdfPages === 1 ? 'Page' : 'Pages'}`;
      if (isRestrictedGuest) {
        titleText += ` [Page 1 Only - Guest Mode]`;
      }
      if (this.titleEl) this.titleEl.textContent = titleText;

      this.stage.innerHTML = '';

      const scrollWrapper = document.createElement('div');
      scrollWrapper.className = 'pdf-pages-scroll-wrapper';
      scrollWrapper.id = 'viewerImageWrapper';

      const dpr = Math.min(2.5, Math.max(1.5, window.devicePixelRatio || 1.5));

      for (let pageNum = 1; pageNum <= numPagesToRender; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: dpr });

        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'pdf-page-wrapper';
        pageWrapper.id = `pdfPageWrapper_${pageNum}`;

        const pageBadge = document.createElement('div');
        pageBadge.className = 'pdf-page-badge';
        pageBadge.textContent = isRestrictedGuest
          ? `Page 1 of ${totalPdfPages} (Guest Preview)`
          : `Page ${pageNum} of ${totalPdfPages}`;

        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page-canvas';
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const context = canvas.getContext('2d');
        await page.render({ canvasContext: context, viewport }).promise;

        pageWrapper.appendChild(pageBadge);
        pageWrapper.appendChild(canvas);
        scrollWrapper.appendChild(pageWrapper);
      }

      this.stage.appendChild(scrollWrapper);
      this.applyImageTransform();
      return true;
    } catch (err) {
      console.warn('PDF.js full document rendering error:', err);
      return false;
    }
  }

  /**
   * Render the active document in the stage.
   */
  async renderCurrentDocument() {
    if (!this.stage) return;
    const doc = this.currentDocs[this.currentIndex];
    if (!doc) return;

    const isGuest = window.nocAuth && window.nocAuth.isGuest();
    const isPDF = doc.type === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf');
    const isRestrictedGuest = isGuest && isPDF && !this.currentOptions?.allowFullPages;

    // Update Header info
    let titleText = `${doc.name} (${this.currentIndex + 1}/${this.currentDocs.length})`;
    if (isRestrictedGuest) {
      titleText += ` [Page 1 Only - Guest Mode]`;
    }
    if (this.titleEl) this.titleEl.textContent = titleText;
    
    if (this.badgeEl) {
      this.badgeEl.className = `viewer-badge ${isRestrictedGuest ? 'page1' : (isPDF ? 'pdf' : 'image')}`;
      this.badgeEl.textContent = isPDF ? (isRestrictedGuest ? 'PDF Page 1' : 'PDF Document') : 'Image';
    }

    // Enable zoom, rotate, and reset controls for both PDFs and images
    if (this.zoomInBtn) this.zoomInBtn.style.display = 'inline-flex';
    if (this.zoomOutBtn) this.zoomOutBtn.style.display = 'inline-flex';
    if (this.rotateBtn) this.rotateBtn.style.display = 'inline-flex';
    if (this.resetBtn) this.resetBtn.style.display = 'inline-flex';

    // Update Nav buttons
    if (this.prevBtn) this.prevBtn.disabled = this.currentIndex === 0;
    if (this.nextBtn) this.nextBtn.disabled = this.currentIndex === this.currentDocs.length - 1;

    // Render Content
    this.stage.innerHTML = '';

    if (isPDF) {
      const pdfBytes = this.getPdfBytes(doc.dataUrl);
      const rendered = await this.renderPdfDocument(pdfBytes, isRestrictedGuest);

      if (!rendered) {
        // Fallback to standalone single-page PDF in iframe if canvas rendering fails
        this.stage.innerHTML = '';
        if (isRestrictedGuest && !doc._guestPage1DataUrl) {
          doc._guestPage1DataUrl = await this.getFirstPagePdfDataUrl(doc.dataUrl);
        }
        const iframe = document.createElement('iframe');
        iframe.className = 'viewer-pdf-frame';
        iframe.src = isRestrictedGuest ? (doc._guestPage1DataUrl || doc.dataUrl) : doc.dataUrl;
        iframe.title = doc.name;
        this.stage.appendChild(iframe);
      }
    } else {
      // Image Render
      const imgWrapper = document.createElement('div');
      imgWrapper.className = 'viewer-image-wrapper';
      imgWrapper.id = 'viewerImageWrapper';

      const img = document.createElement('img');
      img.className = 'viewer-image';
      img.src = doc.dataUrl;
      img.alt = doc.name;

      imgWrapper.appendChild(img);
      this.stage.appendChild(imgWrapper);
      this.applyImageTransform();
    }
  }

  /**
   * Adjust image zoom level
   */
  adjustZoom(delta) {
    this.zoomLevel = Math.max(0.4, Math.min(4.0, this.zoomLevel + delta));
    this.applyImageTransform();
  }

  /**
   * Rotate image 90 degrees clockwise
   */
  rotate() {
    this.rotation = (this.rotation + 90) % 360;
    this.applyImageTransform();
  }

  /**
   * Reset zoom and rotation
   */
  resetTransform() {
    this.zoomLevel = 1;
    this.rotation = 0;
    this.applyImageTransform();
  }

  /**
   * Apply CSS transform to image
   */
  applyImageTransform() {
    const wrapper = document.getElementById('viewerImageWrapper');
    if (wrapper) {
      wrapper.style.transform = `scale(${this.zoomLevel}) rotate(${this.rotation}deg)`;
    }
  }

  /**
   * Render the bottom thumbnails strip
   */
  renderThumbnails() {
    if (!this.thumbContainer) return;
    this.thumbContainer.innerHTML = '';

    this.currentDocs.forEach((doc, idx) => {
      const isPDF = doc.type === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf');
      const thumb = document.createElement('div');
      thumb.className = `viewer-thumb-item ${idx === this.currentIndex ? 'active' : ''}`;
      thumb.title = doc.name;

      if (isPDF) {
        thumb.innerHTML = `<span class="viewer-thumb-doc-icon" style="color:#DC2626">PDF</span>`;
      } else {
        thumb.innerHTML = `<img src="${doc.dataUrl}" class="viewer-thumb-img" alt="${doc.name}" />`;
      }

      thumb.addEventListener('click', () => {
        this.currentIndex = idx;
        this.zoomLevel = 1;
        this.rotation = 0;
        this.renderCurrentDocument();
        this.renderThumbnails();
      });

      this.thumbContainer.appendChild(thumb);
    });
  }

  /**
   * Download the currently viewed document (Restricted to Page 1 for Guest on NOC records)
   */
  async downloadCurrent() {
    const doc = this.currentDocs[this.currentIndex];
    if (!doc) return;

    const isGuest = window.nocAuth && window.nocAuth.isGuest();
    const isPDF = doc.type === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf');
    const isRestricted = isGuest && isPDF && !this.currentOptions?.allowFullPages;

    if (isRestricted) {
      const baseName = doc.name.replace(/\.pdf$/i, '');
      const page1FileName = `${baseName}_Page_1.pdf`;

      if (window.showToast) {
        window.showToast('Extracting Page 1 for download...', 'info');
      }

      const singlePageBlob = await this.getFirstPagePdfBlob(doc.dataUrl);
      if (singlePageBlob) {
        this.triggerFileDownload(singlePageBlob, page1FileName);
      } else {
        const page1Url = await this.getFirstPagePdfDataUrl(doc.dataUrl);
        this.triggerFileDownload(page1Url, page1FileName);
      }
    } else {
      this.triggerFileDownload(doc.dataUrl, doc.name);
    }
  }

  /**
   * Helper to initiate browser file download
   */
  triggerFileDownload(dataOrUrl, fileName) {
    if (!dataOrUrl) {
      if (window.showToast) window.showToast('No file data to download.', 'error');
      return;
    }

    let url = dataOrUrl;
    let isTempUrl = false;

    if (dataOrUrl instanceof Blob) {
      url = URL.createObjectURL(dataOrUrl);
      isTempUrl = true;
    } else if (dataOrUrl instanceof Uint8Array || dataOrUrl instanceof ArrayBuffer) {
      const blob = new Blob([dataOrUrl], { type: 'application/pdf' });
      url = URL.createObjectURL(blob);
      isTempUrl = true;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'download.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (isTempUrl) {
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    if (window.showToast) {
      window.showToast(`Downloading "${fileName}"...`, 'success');
    }
  }
}

// Global viewer instance
window.docViewer = new DocumentViewer();
