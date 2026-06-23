/**
 * Admin API helpers.
 *
 * All requests include `credentials: "include"` for cookie-based admin auth.
 * When the admin_token is available in sessionStorage, it is also included
 * in POST/PUT/DELETE request bodies for backward compatibility.
 */

function adminToken() {
  return sessionStorage.getItem("admin_token") || "";
}

async function api(method, path, body) {
  const opts = {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `HTTP ${res.status}`);
  }
  return data;
}

function withToken(payload) {
  return { ...payload, admin_token: adminToken() };
}

export const adminApi = {
  /** Check existing session — returns {slot} or throws */
  me() {
    return api("GET", "/api/me");
  },

  /** Claim with admin token — stores in sessionStorage on success */
  async claim(token) {
    const data = await api("POST", "/api/claim", { token });
    if (data.admin) {
      sessionStorage.setItem("admin_token", token);
    }
    return data;
  },

  /** Fetch full dashboard overview */
  async overview() {
    return api("POST", "/api/admin/overview", withToken({}));
  },

  /** Set phase: 'code' or 'gauntlet' with optional grace seconds */
  async setPhase(phase, graceSeconds) {
    return api("POST", "/api/admin/set-phase", withToken({ phase, grace_seconds: graceSeconds }));
  },

  /** Immediately reset to code phase */
  async resetPhase() {
    return api("POST", "/api/admin/reset-phase", withToken({}));
  },

  /** Reset a slot's data */
  async resetSlot(team, index) {
    return api("POST", "/api/admin/reset-slot", withToken({ team, index }));
  },

  /** Add a slot's output video to the gallery */
  async addGalleryEntry(title, avgHits, team, index) {
    return api("POST", "/api/admin/gallery", withToken({ title, avg_hits: avgHits, team, index }));
  },

  /** Delete a gallery entry by id */
  async deleteGalleryEntry(id) {
    return api("DELETE", "/api/admin/gallery", withToken({ id }));
  },

  /** Build slot video URL for the admin video player */
  slotVideoUrl(team, index) {
    return `/api/admin/slot-video/${team}/${index}`;
  },
};
