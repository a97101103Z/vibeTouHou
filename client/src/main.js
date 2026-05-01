/**
 * main.js — Main application entry point.
 *
 * Responsibilities:
 * - Initialize all managers and coordinate between them.
 * - Set up global error handling.
 */

import { SessionManager } from './managers/SessionManager.js';
import { ToastManager } from './managers/ToastManager.js';
import { SidebarManager } from './managers/SidebarManager.js';
import { PatternManager } from './managers/PatternManager.js';
import { AssetsManager } from './managers/AssetsManager.js';
import { GauntletManager } from './managers/GauntletManager.js';
import { GameManager } from './managers/GameManager.js';
import { LoginManager } from './managers/LoginManager.js';

// Instantiate managers
const toastManager = new ToastManager();
const sessionManager = new SessionManager();
const sidebarManager = new SidebarManager(toastManager);
const patternManager = new PatternManager(sidebarManager, toastManager);
const assetsManager = new AssetsManager(sidebarManager, toastManager);
const gauntletManager = new GauntletManager(toastManager);
const gameManager = new GameManager(
  patternManager,
  gauntletManager,
  sidebarManager,
  toastManager
);
const loginManager = new LoginManager(sessionManager, toastManager);

// Wire up cross-manager events
sessionManager.addEventListener('change', () => {
  document.body.classList.add('team-' + sessionManager.team);
});

// Wire up gauntlet start from gauntlet manager to game manager
gauntletManager.addEventListener('startGauntlet', () => {
  if (!gameManager.isRunning) {
    gameManager.startGauntlet();
  }
});

// Wire up pattern tested event
patternManager.addEventListener('renderComplete', () => {
  sidebarManager.setPatternTested(true);
});

// Global error handling
window.addEventListener('unhandledrejection', (e) => {
  toastManager.toast(e.reason?.message || 'Error', 'error');
});

// Initialize application
async function initApp() {
  await sidebarManager.init();
  await patternManager.render(); // Initialize with current editor content if any
  assetsManager.init();
  await assetsManager.loadGallery();
  gauntletManager.init();
  gameManager.init();
}

// Boot the application
async function boot() {
  loginManager.addEventListener('loginSuccess', initApp, { once: true });
  await loginManager.init();
  
  if (sessionManager.isLoggedIn) {
    await initApp();
  }
}

boot();
