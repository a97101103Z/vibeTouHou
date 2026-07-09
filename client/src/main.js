/**
 * main.js — Main application entry point.
 *
 * Responsibilities:
 * - Initialize all modules and coordinate between them.
 * - Set up global error handling.
 * - Manage phase transitions (countdown banner, lock/unlock widgets).
 */

import { ToastService } from "./ToastService.js";
import { SidebarWidget } from "./SidebarWidget.js";
import { GauntletWidget } from "./GauntletWidget.js";
import { GameWidget } from "./GameWidget.js";
import { GalleryWidget } from "./GalleryWidget.js";
import { login } from "./helpers/login.js";
import { phaseService } from "./helpers/phase.js";
import { applyStrings } from "./i18n.js";
import { API_BASE } from "./constants.js";

// Patch fetch to use the configured API base path
if (API_BASE !== "/api") {
  const origFetch = window.fetch;
  window.fetch = (input, init) => {
    if (typeof input === "string" && input.startsWith("/api/")) {
      return origFetch(API_BASE + input.slice(4), init);
    }
    return origFetch(input, init);
  };
}

// Apply translations immediately before anything else renders
applyStrings();

// Instantiate widgets
const toast = new ToastService();
const sidebar = new SidebarWidget(toast);
const gauntlet = new GauntletWidget();
const gallery = new GalleryWidget();
const game = new GameWidget(gauntlet, gallery, sidebar, toast);

// Global error handling
window.addEventListener("unhandledrejection", (e) => {
  toast.toast(e.reason?.message || "Error", "error");
});

// ── Apply phase state to UI ───────────────────────────────────────────────────

function applyPhase(phase, activeAt, immediate = false) {
  if (phase === "gauntlet") {
    const msUntilLock = activeAt ? activeAt * 1000 - Date.now() : 0;
    const isAlreadyActive = msUntilLock <= 0;

    if (isAlreadyActive || immediate) {
      sidebar.setLocked(true);
      gauntlet.setLocked(false);
    } else {
      sidebar.setLocked(false);
      gauntlet.setLocked(true);
    }
  } else {
    // code phase
    const msUntilUnlock = activeAt ? activeAt * 1000 - Date.now() : 0;
    const isAlreadyActive = msUntilUnlock <= 0;

    if (isAlreadyActive || immediate) {
      sidebar.setLocked(false);
      gauntlet.setLocked(true);
    } else {
      // Grace period for code transition — keep gauntlet active, coding locked
      sidebar.setLocked(true);
      gauntlet.setLocked(false);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await login(toast);

  // Initialize after login
  await sidebar.init();
  gauntlet.init();
  gallery.init();
  game.init();

  // Start polling and apply initial phase (no countdown on page load)
  phaseService.start();
  const initial = phaseService.phase;
  const initialActiveAt = phaseService.activeAt;
  applyPhase(initial, initialActiveAt, /* immediate */ true);
  
  const initialTimerAt = phaseService.timerAt;
  if (initialTimerAt) gauntlet.showCountdown(initialTimerAt);

  phaseService.addEventListener("timerchange", (e) => {
    const { timer_at } = e.detail;
    if (timer_at) {
      gauntlet.showCountdown(timer_at);
    } else {
      gauntlet.hideCountdown();
    }
  });

  // Phase polling detected a change (e.g. admin just switched)
  phaseService.addEventListener("phasechange", (e) => {
    const { phase, active_at } = e.detail;
    gauntlet.hideCountdown();
    applyPhase(phase, active_at);
  });

  // Grace period expired — lock coding, start gauntlet unlock sequence
  phaseService.addEventListener("phaselocked", () => {
    gauntlet.hideCountdown();
    sidebar.setLocked(true);
    gauntlet.setLocked(false);
  });

  // Code transition grace expired — unlock coding, go back to code mode
  phaseService.addEventListener("phaseunlocked", () => {
    gauntlet.hideCountdown();
    sidebar.setLocked(false);
    gauntlet.setLocked(true);
  });
}

main();
