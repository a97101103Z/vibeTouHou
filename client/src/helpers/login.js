/**
 * @typedef {Object} SessionInfo
 * @property {string} slot - The user's slot (e.g., "red-0")
 * @property {string} team - The user's team ("red" or "blue")
 * @property {number} index - The user's index within the team
 */

/**
 * Attempts to establish a session, either by checking existing credentials
 * or by showing the login UI and waiting for user input.
 * @returns {Promise<SessionInfo>}
 */
/**
 * @param {import("../ToastService.js").ToastService} toastService
 */
import { TOAST_ENTER_TOKEN, TOAST_ASSIGNED, TOAST_CLAIM_FAIL } from "../strings.js";

export async function login(toastService) {
  // First, check for existing session
  const existingSession = await checkSession();
  if (existingSession) {
    activateApp(existingSession);
    return existingSession;
  }

  // No existing session, show login UI
  return new Promise((resolve, reject) => {
    const { tokenInput, claimBtn } = setupLoginUI();

    const tryClaim = async () => {
      const token = tokenInput.value.trim();
      if (!token) {
        toastService.toast(TOAST_ENTER_TOKEN, "error");
        return;
      }

      try {
        const result = await claimSlot(token);
        if (result.admin) {
          // Admin token detected — redirect to admin panel
          sessionStorage.setItem("admin_token", token);
          window.location.href = "/admin.html";
          return;
        }
        toastService.toast(TOAST_ASSIGNED(result.slot.toUpperCase()), "success");
        activateApp(result);
        resolve(result);
      } catch (err) {
        toastService.toast(err.message, "error");
      }
    };

    tokenInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryClaim();
    });

    if (claimBtn) {
      claimBtn.addEventListener("click", tryClaim);
    }
  });
}

/**
 * @returns {Promise<SessionInfo|null>}
 */
async function checkSession() {
  try {
    const res = await fetch("/api/me", { credentials: "include" });
    const data = await res.json();
    if (data.slot) {
      // Admin sessions redirect to admin page
      if (data.slot === "admin") {
        sessionStorage.setItem("admin_token", "");
        window.location.href = "/admin.html";
        return null;
      }
      const [team, idx] = data.slot.split("-");
      return {
        slot: data.slot,
        team,
        index: parseInt(idx),
      };
    }
  } catch (_) {}
  return null;
}

/**
 * @param {string} token
 * @returns {Promise<SessionInfo>}
 */
async function claimSlot(token) {
  const res = await fetch("/api/claim", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || TOAST_CLAIM_FAIL);
  }

  const data = await res.json();

  // Admin token detected — return early with no slot info
  if (data.admin) {
    return { admin: true };
  }

  const [team, idx] = data.slot.split("-");
  return {
    slot: data.slot,
    team,
    index: parseInt(idx),
  };
}

function setupLoginUI() {
  const tokenInput = document.getElementById("token-input");
  const claimBtn = document.getElementById("btn-claim");

  if (!tokenInput) {
    throw new Error("Token input element not found");
  }

  tokenInput.focus();

  return { tokenInput, claimBtn };
}

/**
 * @param {SessionInfo} session
 */
function activateApp(session) {
  if (!session) {
    throw new Error("Cannot activate app without a session");
  }

  document.body.classList.add("team-" + session.team);

  const badge = document.getElementById("player-badge");
  if (badge) {
    badge.textContent = session.slot.toUpperCase();
  }

  document.querySelectorAll(".logo-tou, .logo-hou").forEach((el) => {
    el.style.color = session.team === "red" ? "var(--red)" : "var(--blue)";
  });

  document.getElementById("login-overlay").style.display = "none";
  document.getElementById("app").style.display = "";
}
