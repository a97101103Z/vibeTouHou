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

// Instantiate widgets
const toast = new ToastService();
const sidebar = new SidebarWidget(toast);
const gauntlet = new GauntletWidget();
const gallery = new GalleryWidget();
const game = new GameWidget(gauntlet, sidebar, toast);

// Global error handling
window.addEventListener("unhandledrejection", (e) => {
  toast.toast(e.reason?.message || "Error", "error");
});

// ── Phase countdown banner ────────────────────────────────────────────────────

let countdownInterval = null;

function mountCountdownBanner(activeAt) {
  removeCountdownBanner();

  const section = document.getElementById("gauntlet-section");
  if (!section) return;

  // Switch to 'pending' state so the ::after lock overlay doesn't overlap
  section.setAttribute("data-locked", "pending");

  const banner = document.createElement("div");
  banner.id = "phase-countdown";
  banner.innerHTML = `
    <div class="phase-countdown-icon">⚔️</div>
    <div class="phase-countdown-label">Gauntlet starts in</div>
    <div class="phase-countdown-timer" id="phase-countdown-timer">1:00</div>
    <div class="phase-countdown-sub">Finish what you're doing!</div>
  `;

  section.appendChild(banner);

  function tick() {
    const secsLeft = Math.max(0, Math.ceil(activeAt - Date.now() / 1000));
    const mins = Math.floor(secsLeft / 60);
    const secs = String(secsLeft % 60).padStart(2, "0");
    const timerEl = document.getElementById("phase-countdown-timer");
    if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    if (secsLeft === 0) removeCountdownBanner();
  }

  tick();
  countdownInterval = setInterval(tick, 500);
}

function removeCountdownBanner() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  document.getElementById("phase-countdown")?.remove();
  // Restore data-locked to 'true' so the lock overlay comes back until phaselocked fires
  const section = document.getElementById("gauntlet-section");
  if (section && section.getAttribute("data-locked") === "pending") {
    section.setAttribute("data-locked", "true");
  }
}

// ── Apply phase state to UI ───────────────────────────────────────────────────

function applyPhase(phase, activeAt, immediate = false) {
  if (phase === "gauntlet") {
    const msUntilLock = activeAt ? activeAt * 1000 - Date.now() : 0;
    const isAlreadyActive = msUntilLock <= 0;

    if (isAlreadyActive || immediate) {
      // Grace period already expired — lock coding immediately
      sidebar.setLocked(true);
      gauntlet.setLocked(false);
      removeCountdownBanner();
    } else {
      // Still in grace window — show countdown, don't lock yet
      mountCountdownBanner(activeAt);
    }
  } else {
    // Back to code phase
    sidebar.setLocked(false);
    gauntlet.setLocked(true);
    removeCountdownBanner();
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

  // Gallery entry clicked → play the video in the game canvas (view-only)
  gallery.addEventListener("playGalleryEntry", (e) => {
    game.playGalleryVideo(e.detail.url);
  });

  // Start polling and apply initial phase (no countdown on page load)
  phaseService.start();
  const initial = phaseService.phase;
  const initialActiveAt = phaseService.activeAt;
  applyPhase(initial, initialActiveAt, /* immediate */ true);

  // Phase polling detected a change (e.g. admin just switched)
  window.addEventListener("phasechange", (e) => {
    const { phase, active_at } = e.detail;
    applyPhase(phase, active_at);
  });

  // Grace period expired — lock coding, start gauntlet unlock sequence
  window.addEventListener("phaselocked", () => {
    sidebar.setLocked(true);
    gauntlet.setLocked(false); // triggers the 1–3s loading delay internally
    removeCountdownBanner();
  });

  // Playtest finished during gauntlet phase — auto-launch gauntlet
  window.addEventListener("autoStartGauntlet", () => {
    gauntlet.dispatchEvent(new CustomEvent("startGauntlet"));
  });
}

main();
