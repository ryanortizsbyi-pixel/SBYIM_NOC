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
   * Open the viewer with an array of documents and starting index.
   */
  open(docs = [], startIndex = 0) {
    if (!docs || docs.length === 0) {
      if (window.showToast) window.showToast('No documents available to view.', 'info');
      return;
    }

    this.currentDocs = docs;
    this.currentIndex = Math.min(Math.max(0, startIndex), docs.length - 1);
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
   * Render the active document in the stage.
   */
  renderCurrentDocument() {
    if (!this.stage) return;
    const doc = this.currentDocs[this.currentIndex];
    if (!doc) return;

    // Update Header info
    if (this.titleEl) this.titleEl.textContent = `${doc.name} (${this.currentIndex + 1}/${this.currentDocs.length})`;
    
    const isPDF = doc.type === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf');
    
    if (this.badgeEl) {
      this.badgeEl.className = `viewer-badge ${isPDF ? 'pdf' : 'image'}`;
      this.badgeEl.textContent = isPDF ? 'PDF Document' : 'Image';
    }

    // Toggle controls visibility based on format
    if (this.zoomInBtn) this.zoomInBtn.style.display = isPDF ? 'none' : 'inline-flex';
    if (this.zoomOutBtn) this.zoomOutBtn.style.display = isPDF ? 'none' : 'inline-flex';
    if (this.rotateBtn) this.rotateBtn.style.display = isPDF ? 'none' : 'inline-flex';
    if (this.resetBtn) this.resetBtn.style.display = isPDF ? 'none' : 'inline-flex';

    // Update Nav buttons
    if (this.prevBtn) this.prevBtn.disabled = this.currentIndex === 0;
    if (this.nextBtn) this.nextBtn.disabled = this.currentIndex === this.currentDocs.length - 1;

    // Render Content
    this.stage.innerHTML = '';

    if (isPDF) {
      // PDF Render via object / iframe
      const iframe = document.createElement('iframe');
      iframe.className = 'viewer-pdf-frame';
      iframe.src = doc.dataUrl;
      iframe.title = doc.name;
      this.stage.appendChild(iframe);
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
   * Download the currently viewed document
   */
  downloadCurrent() {
    const doc = this.currentDocs[this.currentIndex];
    if (!doc) return;
    this.triggerFileDownload(doc.dataUrl, doc.name);
  }

  /**
   * Helper to initiate browser file download
   */
  triggerFileDownload(dataUrl, fileName) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (window.showToast) {
      window.showToast(`Downloading "${fileName}"...`, 'success');
    }
  }
}

// Global viewer instance
window.docViewer = new DocumentViewer();
