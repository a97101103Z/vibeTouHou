/**
 * SidebarManager - Manages sidebar UI state and behavior.
 * @extends EventTarget
 */

export class SidebarManager extends EventTarget {
  #isExpanded = false;
  #activeTab = 'pattern';
  #patternTested = false;
  #assetsCount = 0;
  #assetsSize = 0;
  #editor = null;

  // DOM references
  #sidebar;
  #btnExpand;
  #sidebarTabs;
  #tabPanes;
  #btnPlaytest;
  #patternStatus;
  #assetsCountEl;
  #assetsSizeEl;
  #renderStatusEl;

  // Dependencies
  #toastManager;

  get isExpanded() {
    return this.#isExpanded;
  }

  get activeTab() {
    return this.#activeTab;
  }

  get patternTested() {
    return this.#patternTested;
  }

  get assetsCount() {
    return this.#assetsCount;
  }

  get assetsSize() {
    return this.#assetsSize;
  }

  /**
   * @param {import('./ToastManager.js').ToastManager} toastManager
   */
  constructor(toastManager) {
    super();
    this.#toastManager = toastManager;
  }

  async init() {
    this.#cacheDOM();
    await this.#initEditor();
    this.#setupEventListeners();
    this.updateDisplay();
  }

  #cacheDOM() {
    this.#sidebar = document.getElementById('sidebar');
    this.#btnExpand = document.getElementById('btn-expand');
    this.#sidebarTabs = document.querySelectorAll('.sidebar-tab');
    this.#tabPanes = document.querySelectorAll('.tab-pane');
    this.#btnPlaytest = document.getElementById('btn-playtest');
    this.#patternStatus = document.getElementById('pattern-status-text');
    this.#assetsCountEl = document.getElementById('assets-count');
    this.#assetsSizeEl = document.getElementById('assets-size');
    this.#renderStatusEl = document.getElementById('render-status');
  }

  async #initEditor() {
    if (!document.getElementById('pattern-tab')) return;

    const SAMPLE = `import math
import imageio
import numpy as np
import gizeh

# vibeTouHou — Bullet Pattern Script
# This script generates a 10-second bullet-hell pattern video.
# Edit the PATTERN SETTINGS section below to create your own!
# The script should produce a file called "output.mp4".

# Canvas settings (keep these as-is)
WIDTH, HEIGHT = 800, 600
FPS = 30
DURATION = 10 # seconds

# Pattern settings — edit freely!
PELLETS = 24 # number of pellets in the ring
PELLET_RADIUS = 5 # size of each pellet (pixels)
SPEED = 130 # expansion speed (pixels / second)
COLOR = (1, 1, 1) # white = always a hit zone

# Render loop
frames = []

for frame_num in range(FPS * DURATION):
    t = frame_num / FPS # current time in seconds (0 → 10)
    
    surface = gizeh.Surface(width=WIDTH, height=HEIGHT, bg_color=(0, 0, 0))
    
    # Draw each pellet evenly spaced around a ring that grows over time
    for i in range(PELLETS):
        angle = (2 * math.pi / PELLETS) * i # even spacing
        dist = SPEED * t # ring expands with time
        x = WIDTH / 2 + math.cos(angle) * dist
        y = HEIGHT / 2 + math.sin(angle) * dist
        
        circle = gizeh.circle(r=PELLET_RADIUS, xy=(x, y), fill=COLOR)
        circle.draw(surface)
    
    # Capture frame
    frames.append(surface.get_npimage())

# DO NOT CHANGE THE FILENAME BELOW
imageio.mimwrite("output.mp4", frames, fps=FPS, macro_block_size=None,
    output_params=["-preset", "ultrafast", "-crf", "28"])
print("Done! output.mp4 created.")
`;

    try {
      const { EditorView, basicSetup } = await import('codemirror');
      const { python } = await import('@codemirror/lang-python');
      const { oneDark } = await import('@codemirror/theme-one-dark');

      this.#editor = new EditorView({
        doc: SAMPLE,
        extensions: [
          basicSetup,
          python(),
          oneDark,
          EditorView.theme({
            '&': { height: '400px' },
            '.cm-scroller': { overflow: 'auto' }
          }),
        ],
        parent: document.getElementById('editor-wrap'),
      });
    } catch (e) {
      console.error('Failed to initialize editor:', e);
    }
  }

  #setupEventListeners() {
    if (this.#btnExpand) {
      this.#btnExpand.addEventListener('click', () => this.toggle());
    }

    this.#sidebarTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });

    if (this.#btnPlaytest) {
      this.#btnPlaytest.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('startPlaytest'));
      });
    }
  }

  toggle() {
    this.#isExpanded = !this.#isExpanded;
    this.updateDisplay();
    this.dispatchEvent(new CustomEvent('toggle'));
  }

  /**
   * @param {'pattern'|'assets'} tabName
   */
  switchTab(tabName) {
    this.#activeTab = tabName;

    this.#sidebarTabs.forEach(tab => {
      tab.setAttribute('data-active', tab.dataset.tab === tabName ? 'true' : 'false');
    });

    this.#tabPanes.forEach(pane => {
      pane.setAttribute('data-active', pane.id === `${tabName}-tab` ? 'true' : 'false');
    });

    this.updateDisplay();
    this.dispatchEvent(new CustomEvent('tabChange', { detail: { tab: tabName } }));
  }

  updateDisplay() {
    if (!this.#sidebar) return;

    this.#sidebar.setAttribute('data-expanded', this.#isExpanded ? 'true' : 'false');

    if (this.#btnExpand && this.#btnExpand.querySelector('.expand-icon')) {
      this.#btnExpand.querySelector('.expand-icon').textContent = this.#isExpanded ? '◀' : '▶';
    }

    this.#updatePatternStatus();
    this.#updateAssetsStatus();
  }

  #updatePatternStatus() {
    if (this.#patternStatus) {
      this.#patternStatus.textContent = this.#patternTested ? '✓ Tested' : 'Not tested';
      this.#patternStatus.setAttribute('data-tested', this.#patternTested ? 'true' : 'false');
    }
  }

  #updateAssetsStatus() {
    if (this.#assetsCountEl) {
      this.#assetsCountEl.textContent = `${this.#assetsCount} asset${this.#assetsCount !== 1 ? 's' : ''}`;
    }
    if (this.#assetsSizeEl) {
      const sizeMB = (this.#assetsSize / (1024 * 1024)).toFixed(1);
      this.#assetsSizeEl.textContent = `(${sizeMB} MB)`;
    }
  }

  /**
   * @param {boolean} tested
   */
  setPatternTested(tested) {
    this.#patternTested = tested;
    this.#updatePatternStatus();
    this.dispatchEvent(new CustomEvent('patternTested'));
  }

  /**
   * @param {number} count
   * @param {number} size
   */
  setAssetsStatus(count, size) {
    this.#assetsCount = count;
    this.#assetsSize = size;
    this.#updateAssetsStatus();
  }

  /**
   * @param {string} status
   * @param {string} [stderr='']
   * @param {string} [durationStr='']
   */
  setRenderStatus(status, stderr = '', durationStr = '') {
    if (!this.#renderStatusEl) return;

    const STATUS_LABELS = {
      idle: '● IDLE',
      queued: '◌ QUEUED',
      running: '◉ RENDERING…',
      done: '✓ DONE',
      error: '✗ ERROR',
    };

    this.#renderStatusEl.setAttribute('data-status', status);
    this.#renderStatusEl.textContent = (STATUS_LABELS[status] ?? status.toUpperCase()) + (durationStr ? ` (${durationStr})` : '');

    const errEl = document.getElementById('render-stderr');
    if (stderr && errEl) {
      errEl.setAttribute('data-visible', 'true');
      errEl.textContent = stderr;
    } else if (errEl) {
      errEl.setAttribute('data-visible', 'false');
    }
  }

  getEditorScript() {
    return this.#editor ? this.#editor.state.doc.toString() : '';
  }
}
