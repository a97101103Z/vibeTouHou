/**
 * main.js — Main application entry point.
 *
 * Responsibilities:
 * - Initialize all managers and coordinate between them.
 * - Set up global error handling.
 */

import { ToastManager } from "./managers/ToastManager.js";
import { SidebarManager } from "./managers/SidebarManager.js";
import { PatternManager } from "./managers/PatternManager.js";
import { AssetsManager } from "./managers/AssetsManager.js";
import { GauntletManager } from "./managers/GauntletManager.js";
import { GameManager } from "./managers/GameManager.js";
import { login } from "./login.js";

// Instantiate managers
const toastManager = new ToastManager();
const sidebarManager = new SidebarManager(toastManager, loginManager);
const patternManager = new PatternManager(sidebarManager, toastManager);
const assetsManager = new AssetsManager(sidebarManager, toastManager);
const gauntletManager = new GauntletManager(toastManager);
const gameManager = new GameManager(
  patternManager,
  gauntletManager,
  sidebarManager,
  toastManager,
);

// Wire up cross-manager events
gauntletManager.addEventListener("startGauntlet", () => {
  if (!gameManager.isRunning) {
    gameManager.startGauntlet();
  }
});

// Wire up pattern tested event
patternManager.addEventListener("renderComplete", () => {
  sidebarManager.setPatternTested(true);
});

// Global error handling
window.addEventListener("unhandledrejection", (e) => {
  toastManager.toast(e.reason?.message || "Error", "error");
});

async function main() {
  await login();

  // Initialize after login
  await sidebarManager.init();
  assetsManager.init();
  await assetsManager.loadGallery();
  gauntletManager.init();
  gameManager.init();
}

main();
