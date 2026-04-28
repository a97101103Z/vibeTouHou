/**
 * assets.js — Page 2: Upload custom images, view gallery, download video.
 */

import { toast } from '../main.js';

export function initAssets(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">🖼️ Assets</h1>
      <p class="page-subtitle">Upload images your script can use, or download your latest rendered video.</p>
    </div>

    <div class="row" style="gap:24px; align-items:flex-start">

      <!-- Upload + gallery -->
      <div class="grow col">
        <div class="card col">
          <div class="card-title">Upload Image</div>
          <div id="drop-zone" class="drop-zone">
            <div class="drop-icon">📁</div>
            <div>Drag &amp; drop images here, or <strong>click to browse</strong></div>
            <div style="font-size:0.75rem;margin-top:6px;color:var(--text-muted)">PNG, JPG, GIF, BMP, WebP — max 10 MB each</div>
          </div>
          <input id="file-input" type="file" multiple accept="image/*" style="display:none" />
        </div>

        <div class="card col">
          <div class="row center">
            <div class="card-title" style="margin:0">Your Assets</div>
            <button id="btn-refresh-assets" class="btn btn-outline" style="margin-left:auto;padding:6px 14px">↻ Refresh</button>
          </div>
          <div id="asset-gallery" class="asset-grid">
            <div style="color:var(--text-muted);font-size:0.82rem;grid-column:1/-1">Loading…</div>
          </div>
        </div>
      </div>

      <!-- Download video -->
      <div style="width:280px;flex-shrink:0" class="col">
        <div class="card col">
          <div class="card-title">Download Video</div>
          <p style="color:var(--text-dim);font-size:0.82rem;line-height:1.7">
            Download your latest rendered <code>output.mp4</code> for local preview or sharing.
          </p>
          <a id="btn-dl-video" class="btn btn-primary" style="text-align:center" href="/api/video/my" target="_blank">
            ⬇ Download My Video
          </a>
        </div>

        <div class="card">
          <div class="card-title">How to use assets in your script</div>
          <pre style="color:var(--text-dim);font-size:0.76rem;line-height:1.8;white-space:pre-wrap">
# Assets are in the current directory
# when your script runs on the server.

# Read as a numpy array (H, W, 3):
import imageio
img = imageio.v3.imread("my_image.png")

# Or use it as a gizeh pattern:
import gizeh, imageio
raw = imageio.v3.imread("my_image.png")
# raw is already (H, W, RGBA/RGB) numpy array</pre>
        </div>
      </div>
    </div>
  `;

  // ── Drop zone ─────────────────────────────────────────────────────────────
  const dropZone  = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('click',      () => fileInput.click());
  dropZone.addEventListener('dragover',   e  => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave',  ()  => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop',       e  => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    uploadFiles([...e.dataTransfer.files]);
  });
  fileInput.addEventListener('change', () => uploadFiles([...fileInput.files]));

  // ── Gallery ───────────────────────────────────────────────────────────────
  document.getElementById('btn-refresh-assets').addEventListener('click', loadGallery);

  loadGallery();

  async function loadGallery() {
    const gallery = document.getElementById('asset-gallery');
    gallery.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;grid-column:1/-1">Loading…</div>';
    try {
      const res  = await fetch('/api/assets/list', { credentials: 'include' });
      const data = await res.json();
      if (!data.files.length) {
        gallery.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;grid-column:1/-1">No assets uploaded yet.</div>';
        return;
      }
      gallery.innerHTML = '';
      data.files.forEach(f => gallery.appendChild(makeThumb(f)));
    } catch (_) {
      gallery.innerHTML = '<div style="color:var(--red);font-size:0.82rem;grid-column:1/-1">Could not load assets.</div>';
    }
  }

  function makeThumb({ name }) {
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
        method: 'DELETE', credentials: 'include',
      });
      wrap.remove();
      toast(`Deleted ${name}.`);
    });
    wrap.appendChild(del);

    return wrap;
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  async function uploadFiles(files) {
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res  = await fetch('/api/assets/upload', {
          method: 'POST', credentials: 'include', body: fd,
        });
        const data = await res.json();
        if (res.ok) {
          toast(`Uploaded ${data.filename}`, 'success');
        } else {
          toast(`${file.name}: ${data.detail}`, 'error');
        }
      } catch (_) {
        toast(`Upload failed for ${file.name}.`, 'error');
      }
    }
    loadGallery();
    fileInput.value = '';
  }
}
