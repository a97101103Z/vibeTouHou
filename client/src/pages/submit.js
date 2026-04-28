/**
 * submit.js — Page 1: Python code editor + render job.
 *
 * Layout:
 *   Left column : CodeMirror editor
 *   Right column: Render button, status badge, stderr, video preview
 */

import { EditorView, basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { toast } from '../main.js';

const SAMPLE = `import math
import imageio
import numpy as np
import gizeh

# ─────────────────────────────────────────────────────────────
#  vibeTouHou — Bullet Pattern Script
#
#  This script generates a 10-second bullet-hell pattern video.
#  Edit the PATTERN SETTINGS section below to create your own!
#  The script should produce a file called "output.mp4".
# ─────────────────────────────────────────────────────────────

# ── Canvas settings (keep these as-is) ──────────────────────
WIDTH, HEIGHT = 800, 600
FPS      = 30
DURATION = 10   # seconds

# ── Pattern settings — edit freely! ─────────────────────────
PELLETS      = 24          # number of pellets in the ring
PELLET_RADIUS = 5          # size of each pellet (pixels)
SPEED        = 130         # expansion speed (pixels / second)
COLOR        = (1, 1, 1)   # white = always a hit zone (gizeh uses 0.0-1.0)

# ── Render loop ───────────────────────────────────────────────
frames  = []

for frame_num in range(FPS * DURATION):
    t = frame_num / FPS       # current time in seconds (0 → 10)

    surface = gizeh.Surface(width=WIDTH, height=HEIGHT, bg_color=(0, 0, 0))

    # Draw each pellet evenly spaced around a ring that grows over time
    for i in range(PELLETS):
        angle = (2 * math.pi / PELLETS) * i   # even spacing
        dist  = SPEED * t                      # ring expands with time
        x = WIDTH  / 2 + math.cos(angle) * dist
        y = HEIGHT / 2 + math.sin(angle) * dist
        
        circle = gizeh.circle(r=PELLET_RADIUS, xy=(x, y), fill=COLOR)
        circle.draw(surface)

    # Capture frame natively without transpose
    frames.append(surface.get_npimage())

# ── DO NOT CHANGE THE FILENAME BELOW ──────────────────────────
# The server explicitly looks for 'output.mp4'. If you change this,
# the submission will fail because the server won't find the file!
imageio.mimwrite("output.mp4", frames, fps=FPS, macro_block_size=None,
                 output_params=["-preset", "ultrafast", "-crf", "28"])
print("Done! output.mp4 created.")
`;

let editor = null;
let pollTimer = null;

export function initSubmit(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">📝 Submit Pattern</h1>
      <p class="page-subtitle">Write a Python script that draws your bullet pattern frame-by-frame and exports it as <code>output.mp4</code>.</p>
    </div>

    <div class="row" style="gap:24px; align-items:flex-start">

      <!-- Editor col -->
      <div class="grow col">
        <div class="card" style="padding:0; overflow:hidden">
          <div id="editor-wrap" style="height:540px"></div>
        </div>
        <div class="row center gap-sm mt-sm">
          <button id="btn-render" class="btn btn-primary">⚡ Render</button>
          <button id="btn-reset-code" class="btn btn-outline">↩ Reset to example</button>
        </div>
      </div>

      <!-- Status col -->
      <div style="width:300px; flex-shrink:0" class="col">
        <div class="card col">
          <div class="card-title">Render Status</div>
          <div id="render-status" class="status-badge status-idle">● IDLE</div>
          <div id="render-stderr" style="display:none"></div>
        </div>

        <div id="video-card" class="card col" style="display:none">
          <div class="card-title">Preview</div>
          <video id="preview-video"
            style="width:100%; border-radius:6px; background:#000"
            controls loop muted></video>
          <a id="btn-download" class="btn btn-outline" style="text-align:center">
            ⬇ Download MP4
          </a>
        </div>

        <div class="card">
          <div class="card-title">Tips</div>
          <ul style="color:var(--text-dim);font-size:0.8rem;padding-left:1.2em;line-height:2">
            <li>Use <code>gizeh.Surface</code> — no display needed</li>
            <li>Bright pixels (Y&gt;128) = collision zone</li>
            <li>Background must be pure black <code>(0,0,0)</code></li>
            <li>Script runs in your <em>assets/</em> folder as cwd</li>
            <li>Allowed: gizeh, imageio, numpy, Pillow, math…</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  // ── CodeMirror ───────────────────────────────────────────────────────────
  editor = new EditorView({
    doc: SAMPLE,
    extensions: [
      basicSetup,
      python(),
      oneDark,
      EditorView.theme({ '&': { height: '540px' }, '.cm-scroller': { overflow: 'auto' } }),
    ],
    parent: document.getElementById('editor-wrap'),
  });

  document.getElementById('btn-reset-code').addEventListener('click', () => {
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: SAMPLE } });
  });

  // ── Render button ────────────────────────────────────────────────────────
  document.getElementById('btn-render').addEventListener('click', async () => {
    const script = editor.state.doc.toString();
    if (!script.trim()) { toast('Editor is empty.', 'error'); return; }

    renderStartTime = Date.now();
    setStatus('queued');
    clearPoll();

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error', data.detail || 'Submission failed.');
        return;
      }
    } catch (_) {
      setStatus('error', 'Could not reach server.');
      return;
    }

    // Start polling
    pollTimer = setInterval(pollStatus, 500);
  });

  // ── Video download link ──────────────────────────────────────────────────
  document.getElementById('btn-download').addEventListener('click', () => {
    window.open('/api/video/my', '_blank');
  });
}

// ── Status helpers ────────────────────────────────────────────────────────────
let renderStartTime = 0;
const STATUS_LABELS = {
  idle:    '● IDLE',
  queued:  '◌ QUEUED',
  running: '◉ RENDERING…',
  done:    '✓ DONE',
  error:   '✗ ERROR',
};

function setStatus(status, stderr = '', durationStr = '') {
  const el = document.getElementById('render-status');
  el.className = `status-badge status-${status}`;
  el.textContent = (STATUS_LABELS[status] ?? status.toUpperCase()) + (durationStr ? ` (${durationStr})` : '');

  const errEl = document.getElementById('render-stderr');
  if (stderr) {
    errEl.style.display = '';
    errEl.className = 'stderr-box';
    errEl.textContent = stderr;
  } else {
    errEl.style.display = 'none';
  }
}

async function pollStatus() {
  try {
    const res  = await fetch('/api/render/status', { credentials: 'include' });
    const data = await res.json();
    
    let durationStr = '';
    if (data.status === 'done' || data.status === 'error') {
      const ms = Date.now() - renderStartTime;
      durationStr = (ms / 1000).toFixed(1) + 's';
    }
    
    setStatus(data.status, data.stderr || '', durationStr);

    if (data.status === 'done') {
      clearPoll();
      showVideoPreview();
      toast('Render complete! Preview is ready.', 'success');
    } else if (data.status === 'error') {
      clearPoll();
      toast('Render failed. Check the error log.', 'error');
    }
  } catch (_) { /* ignore transient network errors */ }
}

function clearPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function showVideoPreview() {
  const card  = document.getElementById('video-card');
  const video = document.getElementById('preview-video');
  card.style.display = '';
  // Force browser to reload the video
  video.src = '/api/video/my?' + Date.now();
  video.load();
}
