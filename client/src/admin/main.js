/**
 * Admin panel entry point.
 *
 * 1. Check for existing admin session (cookie)
 * 2. If none, show login overlay
 * 3. Once authenticated, start polling overview + render dashboard
 */

import { adminApi } from "./api.js";
import { startPolling, stopPolling, setupPhaseControl, setupGalleryAdd, renderLoading } from "./dashboard.js";

async function main() {
  // Check existing session
  let hasSession = false;
  try {
    const me = await adminApi.me();
    if (me.slot === "admin") {
      hasSession = true;
    }
  } catch (_) {
    // No session — show login
  }

  if (hasSession) {
    showDashboard();
    return;
  }

  // Show login form
  document.getElementById("login-overlay").style.display = "flex";
  document.getElementById("admin-token-input").focus();

  const tokenInput = document.getElementById("admin-token-input");
  const loginBtn = document.getElementById("btn-admin-login");
  const errorEl = document.getElementById("admin-login-error");

  const tryLogin = async () => {
    const token = tokenInput.value.trim();
    if (!token) {
      errorEl.textContent = "Please enter an admin token.";
      errorEl.style.display = "block";
      return;
    }
    try {
      const result = await adminApi.claim(token);
      if (result.admin) {
        // Session cookie has been set; reload to pick it up
        window.location.reload();
      } else {
        errorEl.textContent = "That token is not an admin token.";
        errorEl.style.display = "block";
      }
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = "block";
    }
  };

  loginBtn.addEventListener("click", tryLogin);
  tokenInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryLogin();
  });
}

function showDashboard() {
  document.getElementById("login-overlay").style.display = "none";
  const app = document.getElementById("admin-app");
  app.classList.add("visible");

  renderLoading();
  setupPhaseControl();
  setupGalleryAdd();
  startPolling();

  // Logout
  document.getElementById("btn-admin-logout").addEventListener("click", () => {
    sessionStorage.removeItem("admin_token");
    document.cookie = "session=; Max-Age=0; path=/;";
    window.location.reload();
  });
}

main();
