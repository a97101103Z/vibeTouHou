/**
 * SessionManager - Manages user session state.
 * @extends EventTarget
 */
export class SessionManager extends EventTarget {
  #slot = null;
  #team = null;
  #index = null;

  get slot() {
    return this.#slot;
  }

  get team() {
    return this.#team;
  }

  get index() {
    return this.#index;
  }

  get isLoggedIn() {
    return this.#slot !== null;
  }

  /**
   * @param {string} slot
   * @param {string} team
   * @param {number} index
   */
  setSession(slot, team, index) {
    this.#slot = slot;
    this.#team = team;
    this.#index = index;
    this.dispatchEvent(new CustomEvent('change'));
  }

  clearSession() {
    this.#slot = null;
    this.#team = null;
    this.#index = null;
    this.dispatchEvent(new CustomEvent('logout'));
  }

  /**
   * @returns {Promise<{team: string, index: number}|null>}
   */
  async checkSession() {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      const data = await res.json();
      if (data.slot) {
        const [team, idx] = data.slot.split('-');
        return { team, index: parseInt(idx) };
      }
    } catch (_) {}
    return null;
  }

  /**
   * @param {string} token
   * @returns {Promise<{team: string, index: number}>}
   */
  async login(token) {
    const res = await fetch('/api/claim', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Could not claim slot.');
    }

    const data = await res.json();
    const [team, idx] = data.slot.split('-');
    return { team, index: parseInt(idx) };
  }
}
