/**
 * main.js — Main application entry point.
 *
 * Responsibilities:
 * - Initialize all managers and coordinate between them.
 * - Set up global error handling.
 */

import { ToastManager } from "./managers/ToastManager.js";
import { SidebarManager } from "./managers/SidebarManager.js";
import { GauntletManager } from "./managers/GauntletManager.js";
import { GameManager } from "./managers/GameManager.js";
import { login } from "./login.js";

// Instantiate managers
const toastManager = new ToastManager();
const sidebarManager = new SidebarManager(toastManager);
const gauntletManager = new GauntletManager();
const gameManager = new GameManager(
  gauntletManager,
  sidebarManager,
);

// Global error handling
window.addEventListener("unhandledrejection", (e) => {
  toastManager.toast(e.reason?.message || "Error", "error");
});

async function main() {
  await login();

  // Initialize after login
  await sidebarManager.init();
  gauntletManager.init();
  gameManager.init();
}

main();
