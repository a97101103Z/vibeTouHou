import { ERR_EDITOR_EMPTY, ERR_SUBMISSION_FAIL, ERR_RENDER_TIMEOUT, ERR_RENDER_FAIL, TOAST_PUBLISH_OK, TOAST_VALIDATION_FAIL } from "../strings.js";
import { API_BASE } from "../constants.js";

/**
 * @param {string} script The pattern script to render
 * @returns {Promise<string>} Resolves with the video URL
 */
export async function render(script) {
  if (!script.trim()) {
    throw new Error(ERR_EDITOR_EMPTY);
  }

  const res = await fetch("/api/render", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script }),
  });

  if (!res.ok) {
    const data = await res.json();
    const err = new Error(data.detail || ERR_SUBMISSION_FAIL);
    err.status = res.status;
    throw err;
  }

  return await pollRenderStatus();
}

/**
 * @returns {Promise<string>} - Resolves with the video URL
 */
async function pollRenderStatus() {
  const timeoutMs = 65000;
  const start = Date.now();
  while (true) {
    if (Date.now() - start >= timeoutMs) {
      throw new Error(ERR_RENDER_TIMEOUT);
    }

    const res = await fetch("/api/render/status", {
      credentials: "include",
    });
    const data = await res.json();

    if (data.status === "done") {
      return data.video_url || `${API_BASE}/video/my`;
    } else if (data.status === "error") {
      const errMsg = data.parsed_error
        ? (data.parsed_error.error_message || data.stderr || ERR_RENDER_FAIL)
        : (data.stderr || data.stdout || ERR_RENDER_FAIL);
      const err = new Error(errMsg);
      if (data.parsed_error) {
        err.parsed_error = data.parsed_error;
      }
      throw err;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Publish a pattern trajectory to the server.
 * @param {object} trajectory The trajectory data to publish
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function publishPattern(trajectory) {
  const res = await fetch("/api/publish", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trajectory }),
  });
  const data = await res.json();

  if (res.ok) {
    return { ok: true, message: TOAST_PUBLISH_OK };
  }
  return { ok: false, message: data.detail || TOAST_VALIDATION_FAIL };
}
