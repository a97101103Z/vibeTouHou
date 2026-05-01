/**
 * LoginManager - Handles login flow and session activation.
 * @extends EventTarget
 */

export class LoginManager extends EventTarget {
  // Dependencies
  #sessionManager;
  #toastManager;

  // DOM references
  #tokenInput;
  #statusEl;
  #claimBtn;

  /**
   * @param {import('./SessionManager.js').SessionManager} sessionManager
   * @param {import('./ToastManager.js').ToastManager} toastManager
   */
  constructor(sessionManager, toastManager) {
    super();
    this.#sessionManager = sessionManager;
    this.#toastManager = toastManager;
  }

  async init() {
    const existingSession = await this.#sessionManager.checkSession();

    if (existingSession) {
      this.activateApp(existingSession.team, existingSession.index);
      return;
    }

    this.#setupLoginUI();

    return new Promise((resolve) => {
      // The promise will resolve when login is successful
      this.addEventListener('loginSuccess', () => resolve(), { once: true });
    });
  }

  #setupLoginUI() {
    this.#tokenInput = document.getElementById('token-input');
    this.#statusEl = document.getElementById('login-status');
    this.#claimBtn = document.getElementById('btn-claim');

    if (!this.#tokenInput) {
      return;
    }

    this.#tokenInput.focus();

    this.#tokenInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.#tryClaim();
    });

    if (this.#claimBtn) {
      this.#claimBtn.addEventListener('click', () => this.#tryClaim());
    }
  }

  async #tryClaim() {
    const token = this.#tokenInput.value.trim();
    if (!token) {
      this.#statusEl.className = 'login-status error';
      this.#statusEl.textContent = 'Please enter your team token.';
      return;
    }

    this.#statusEl.className = 'login-status';
    this.#statusEl.textContent = 'Claiming slot…';

    try {
      const { team, index } = await this.#sessionManager.login(token);
      this.#statusEl.className = 'login-status success';
      this.#statusEl.textContent = `✓ Assigned to ${this.#sessionManager.slot.toUpperCase()}!`;
      setTimeout(() => {
        this.activateApp(team, index);
      }, 500);
    } catch (err) {
      this.#statusEl.className = 'login-status error';
      this.#statusEl.textContent = `✗ ${err.message}`;
    }
  }

  /**
   * @param {string} team
   * @param {number} index
   */
  activateApp(team, index) {
    this.#sessionManager.setSession(team, index, `${team}-${index}`);

    document.body.classList.add('team-' + team);

    const badge = document.getElementById('player-badge');
    if (badge) {
      badge.textContent = this.#sessionManager.slot.toUpperCase();
    }

    document.querySelectorAll('.logo-tou, .logo-hou').forEach(el => {
      el.style.color = team === 'red' ? 'var(--red)' : 'var(--blue)';
    });

    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app').style.display = '';

    this.dispatchEvent(new CustomEvent('loginSuccess'));
  }
}
