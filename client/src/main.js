/**
 * main.js — Main application entry point.
 *
 * Responsibilities:
 * - Initialize all modules and coordinate between them.
 * - Set up global error handling.
 */

import { ToastService } from "./ToastService.js";
import { SidebarWidget } from "./SidebarWidget.js";
import { GauntletWidget } from "./GauntletWidget.js";
import { GameWidget } from "./GameWidget.js";
import { login } from "./helpers/login.js";

// Instantiate widgets
const toast = new ToastService();
const sidebar = new SidebarWidget(toast);
const gauntlet = new GauntletWidget();
const game = new GameWidget(gauntlet, sidebar, toast);

// Global error handling
window.addEventListener("unhandledrejection", (e) => {
  toast.toast(e.reason?.message || "Error", "error");
});

async function main() {
  await login(toast);

  // Initialize after login
  await sidebar.init();
  gauntlet.init();
  game.init();
}

main();
