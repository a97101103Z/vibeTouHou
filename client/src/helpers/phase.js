/**
 * PhaseService — polls /api/phase every 5 seconds and fires window events
 * when the phase or lock state changes.
 *
 * Events dispatched on `this` (PhaseService):
 *   "phasechange"  — { detail: { phase, active_at } }   phase changed
 *   "phaselocked"  — fired once when grace period expires and lock becomes active
 */

const POLL_INTERVAL = 5000;

class PhaseService extends EventTarget {
  #phase = "code";
  #active_at = null;
  #timer_at = null;
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

  /** @returns {number|null} unix timestamp for reference timer */
  get timerAt() {
    return this.#timer_at;
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

  /**
   * True when coding/publishing should be blocked (mirrors backend phase.is_locked()).
   * @returns {boolean}
   */
  isLocked() {
    if (this.#phase === "gauntlet") {
      return this.#active_at === null || Date.now() / 1000 >= this.#active_at;
    }
    return this.#active_at !== null && Date.now() / 1000 < this.#active_at;
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

  #handleUpdate({ phase, active_at, timer_at }) {
    const phaseChanged =
      phase !== this.#phase || active_at !== this.#active_at;
    const timerChanged = timer_at !== this.#timer_at;

    this.#phase = phase;
    this.#active_at = active_at ?? null;
    this.#timer_at = timer_at ?? null;

    if (phaseChanged) {
      this.dispatchEvent(
        new CustomEvent("phasechange", { detail: { phase, active_at } }),
      );
    }
    
    if (timerChanged) {
      this.dispatchEvent(
        new CustomEvent("timerchange", { detail: { timer_at } }),
      );
    }

    // Schedule lock/unlock events at the exact moment grace expires
    if (this.#lockTimer) clearTimeout(this.#lockTimer);

    if (phase === "gauntlet" && active_at !== null) {
      const msUntilLock = active_at * 1000 - Date.now();
      if (msUntilLock > 0) {
        this.#lockTimer = setTimeout(() => {
          this.#locked = true;
          this.dispatchEvent(new CustomEvent("phaselocked"));
        }, msUntilLock);
      } else if (!this.#locked) {
        this.#locked = true;
        setTimeout(
          () => this.dispatchEvent(new CustomEvent("phaselocked")),
          0,
        );
      } else {
        this.#locked = true;
      }
    } else if (phase === "code") {
      if (active_at !== null) {
        const msUntilUnlock = active_at * 1000 - Date.now();
        if (msUntilUnlock > 0) {
          // Grace period for code transition — keep locked until it expires
          this.#locked = true;
          this.#lockTimer = setTimeout(() => {
            this.#locked = false;
            this.dispatchEvent(new CustomEvent("phaseunlocked"));
          }, msUntilUnlock);
        } else {
          this.#locked = false;
        }
      } else {
        this.#locked = false;
      }
    }
  }
}

/** Singleton exported for use across the app. */
export const phaseService = new PhaseService();
