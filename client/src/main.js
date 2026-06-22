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
      // Grace period already expired — lock coding immediately
      sidebar.setLocked(true);
      gauntlet.setLocked(false);
      gauntlet.hideCountdown();
    } else {
      // Still in grace window — show countdown, don't lock yet
      gauntlet.showCountdown(activeAt);
    }
  } else {
    // Back to code phase
    sidebar.setLocked(false);
    gauntlet.setLocked(true);
    gauntlet.hideCountdown();
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

  // Phase polling detected a change (e.g. admin just switched)
  phaseService.addEventListener("phasechange", (e) => {
    const { phase, active_at } = e.detail;
    applyPhase(phase, active_at);
  });

  // Grace period expired — lock coding, start gauntlet unlock sequence
  phaseService.addEventListener("phaselocked", () => {
    sidebar.setLocked(true);
    gauntlet.setLocked(false); // triggers the 1–3s loading delay internally
    gauntlet.hideCountdown();
  });
}

main();
