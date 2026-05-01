/**
 * AssetsManager - Manages asset uploads and gallery.
 * @extends EventTarget
 */

export class AssetsManager extends EventTarget {
  #files = [];

  // DOM references
  #dropZone;
  #fileInput;
  #assetGallery;
  #btnRefreshAssets;
  #btnUploadAssets;

  // Dependencies
  #sidebarManager;
  #toastManager;

  get files() {
    return this.#files;
  }

  get count() {
    return this.#files.length;
  }

  get size() {
    return this.#files.reduce((sum, f) => sum + (f.size || 0), 0);
  }

  /**
   * @param {import('./SidebarManager.js').SidebarManager} sidebarManager
   * @param {import('./ToastManager.js').ToastManager} toastManager
   */
  constructor(sidebarManager, toastManager) {
    super();
    this.#sidebarManager = sidebarManager;
    this.#toastManager = toastManager;
  }

  init() {
    this.#cacheDOM();
    this.#setupEventListeners();
    this.loadGallery();
  }

  #cacheDOM() {
    this.#dropZone = document.getElementById('drop-zone');
    this.#fileInput = document.getElementById('file-input');
    this.#assetGallery = document.getElementById('asset-gallery');
    this.#btnRefreshAssets = document.getElementById('btn-refresh-assets');
    this.#btnUploadAssets = document.getElementById('btn-upload-assets');
  }

  #setupEventListeners() {
    if (this.#dropZone && this.#fileInput) {
      this.#dropZone.addEventListener('click', () => this.#fileInput.click());
      this.#dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        this.#dropZone.classList.add('drag-over');
      });
      this.#dropZone.addEventListener('dragleave', () => {
        this.#dropZone.classList.remove('drag-over');
      });
      this.#dropZone.addEventListener('drop', e => {
        e.preventDefault();
        this.#dropZone.classList.remove('drag-over');
        this.uploadFiles([...e.dataTransfer.files]);
      });
      this.#fileInput.addEventListener('change', () => {
        this.uploadFiles([...this.#fileInput.files]);
      });
    }

    if (this.#btnRefreshAssets) {
      this.#btnRefreshAssets.addEventListener('click', () => this.loadGallery());
    }
    if (this.#btnUploadAssets) {
      this.#btnUploadAssets.addEventListener('click', () => this.#fileInput.click());
    }
  }

  async loadGallery() {
    if (!this.#assetGallery) return;

    this.#assetGallery.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;grid-column:1/-1">Loading…</div>';

    try {
      const res = await fetch('/api/assets/list', { credentials: 'include' });
      const data = await res.json();

      if (!data.files.length) {
        this.#assetGallery.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;grid-column:1/-1">No assets uploaded yet.</div>';
        this.#files = [];
      } else {
        this.#assetGallery.innerHTML = '';
        data.files.forEach(f => {
          const thumb = this.#makeThumb(f);
          this.#assetGallery.appendChild(thumb);
        });
        this.#files = data.files;
      }

      this.#sidebarManager.setAssetsStatus(this.count, this.size);
      this.dispatchEvent(new CustomEvent('load'));
    } catch (_) {
      this.#assetGallery.innerHTML = '<div style="color:var(--red);font-size:0.82rem;grid-column:1/-1">Could not load assets.</div>';
    }
  }

  #makeThumb({ name }) {
    const wrap = document.createElement('div');
    wrap.className = 'asset-thumb';

    const img = document.createElement('img');
    img.src = `/api/assets/${encodeURIComponent(name)}`;
    img.alt = name;
    wrap.appendChild(img);

    const label = document.createElement('div');
    label.className = 'asset-name';
    label.textContent = name;
    wrap.appendChild(label);

    const del = document.createElement('button');
    del.className = 'asset-del';
    del.title = 'Delete';
    del.textContent = '×';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${name}"?`)) return;
      await fetch(`/api/assets/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      wrap.remove();
      this.#toastManager.toast(`Deleted ${name}.`);
      await this.loadGallery();
      this.dispatchEvent(new CustomEvent('delete', { detail: { name } }));
    });
    wrap.appendChild(del);

    return wrap;
  }

  async uploadFiles(files) {
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch('/api/assets/upload', {
          method: 'POST',
          credentials: 'include',
          body: fd,
        });
        const data = await res.json();
        if (res.ok) {
          this.#toastManager.toast(`Uploaded ${data.filename}`, 'success');
          this.dispatchEvent(new CustomEvent('upload', { detail: { file: data.filename } }));
        } else {
          this.#toastManager.toast(`${file.name}: ${data.detail}`, 'error');
        }
      } catch (_) {
        this.#toastManager.toast(`Upload failed for ${file.name}.`, 'error');
      }
    }
    this.loadGallery();
    if (this.#fileInput) this.#fileInput.value = '';
  }
}
