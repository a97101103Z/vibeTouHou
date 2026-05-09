/**
 * PhaseService — polls /api/phase every 5 seconds and fires window events
 * when the phase or lock state changes.
 *
 * Events dispatched on `window`:
 *   "phasechange"  — { detail: { phase, active_at } }   phase changed
 *   "phaselocked"  — fired once when grace period expires and lock becomes active
 */

const POLL_INTERVAL = 5000;

class PhaseService extends EventTarget {
  #phase = "code";
  #active_at = null;
  #locked = false;
  #pollTimer = null;
  #lockTimer = null;

  /** @returns {"code"|"gauntlet"} */
  get phase() {
    return this.#phase;
  }

  /** @returns {number|null} unix timestamp when lock activates */
  get activeAt() {
    return this.#active_at;
  }

  /**
   * True when phase === "gauntlet" AND the grace period has fully expired.
   * @returns {boolean}
   */
  isGauntletActive() {
    if (this.#phase !== "gauntlet") return false;
    if (this.#active_at === null) return true;
    return Date.now() / 1000 >= this.#active_at;
  }

  /** Begin polling. Call once after login. */
  start() {
    this.#poll();
    this.#pollTimer = setInterval(() => this.#poll(), POLL_INTERVAL);
  }

  stop() {
    if (this.#pollTimer) clearInterval(this.#pollTimer);
    if (this.#lockTimer) clearTimeout(this.#lockTimer);
  }

  async #poll() {
    try {
      const res = await fetch("/api/phase");
      if (!res.ok) return;
      const data = await res.json();
      this.#handleUpdate(data);
    } catch (_) {
      // Silently ignore network errors during polling
    }
  }

  #handleUpdate({ phase, active_at }) {
    const phaseChanged =
      phase !== this.#phase || active_at !== this.#active_at;

    this.#phase = phase;
    this.#active_at = active_at ?? null;

    if (phaseChanged) {
      window.dispatchEvent(
        new CustomEvent("phasechange", { detail: { phase, active_at } }),
      );
    }

    // Schedule the "phaselocked" event at the exact moment grace expires
    if (this.#lockTimer) clearTimeout(this.#lockTimer);

    if (phase === "gauntlet" && active_at !== null) {
      const msUntilLock = active_at * 1000 - Date.now();
      if (msUntilLock > 0) {
        this.#lockTimer = setTimeout(() => {
          this.#locked = true;
          window.dispatchEvent(new CustomEvent("phaselocked"));
        }, msUntilLock);
      } else if (!this.#locked) {
        // Already past the lock time (e.g. page loaded mid-gauntlet)
        this.#locked = true;
        // Dispatch asynchronously so listeners have time to register
        setTimeout(
          () => window.dispatchEvent(new CustomEvent("phaselocked")),
          0,
        );
      }
    } else if (phase === "code") {
      this.#locked = false;
    }
  }
}

/** Singleton exported for use across the app. */
export const phaseService = new PhaseService();
