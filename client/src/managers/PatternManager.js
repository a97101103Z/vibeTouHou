/**
 * PatternManager - Manages pattern code editing and rendering.
 * @extends EventTarget
 */

export class PatternManager extends EventTarget {
  #script = null;
  #videoUrl = null;
  #status = 'idle';
  #renderStartTime = 0;
  #renderPollInterval = null;

  // Dependencies
  #sidebarManager;
  #toastManager;

  get script() {
    return this.#script || '';
  }

  get videoUrl() {
    return this.#videoUrl || '/api/video/my';
  }

  get status() {
    return this.#status;
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

  async render() {
    const script = this.#sidebarManager.getEditorScript();
    if (!script.trim()) {
      this.#toastManager.toast('Editor is empty.', 'error');
      throw new Error('Editor is empty');
    }

    this.#status = 'queued';
    this.#script = script;
    this.#sidebarManager.setRenderStatus('queued');
    this.dispatchEvent(new CustomEvent('renderStart'));

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      });

      if (!res.ok) {
        const data = await res.json();
        this.#sidebarManager.setRenderStatus('error', data.detail || 'Submission failed.');
        throw new Error(data.detail || 'Submission failed.');
      }

      this.#pollRenderStatus();
    } catch (err) {
      this.#sidebarManager.setRenderStatus('error', 'Could not reach server.');
      throw err;
    }
  }

  #pollRenderStatus() {
    if (this.#renderPollInterval) clearInterval(this.#renderPollInterval);

    this.#renderStartTime = Date.now();

    this.#renderPollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/render/status', { credentials: 'include' });
        const data = await res.json();

        let durationStr = '';
        if (data.status === 'done' || data.status === 'error') {
          const ms = Date.now() - this.#renderStartTime;
          durationStr = (ms / 1000).toFixed(1) + 's';
        }

        this.#sidebarManager.setRenderStatus(data.status, data.stderr || '', durationStr);

        if (data.status === 'done') {
          clearInterval(this.#renderPollInterval);
          this.#status = 'done';
          this.#videoUrl = data.video_url || '/api/video/my';
          this.#sidebarManager.setRenderStatus('done');
          this.#toastManager.toast('Render complete!', 'success');
          this.dispatchEvent(new CustomEvent('renderComplete'));
        } else if (data.status === 'error') {
          clearInterval(this.#renderPollInterval);
          this.#status = 'error';
          this.#sidebarManager.setRenderStatus('error', data.stderr || '');
          this.#toastManager.toast('Render failed.', 'error');
          this.dispatchEvent(new CustomEvent('renderError', { detail: { error: data.stderr } }));
        }
      } catch (_) {}
    }, 500);
  }

  stopRenderPoll() {
    if (this.#renderPollInterval) {
      clearInterval(this.#renderPollInterval);
      this.#renderPollInterval = null;
    }
  }
}
