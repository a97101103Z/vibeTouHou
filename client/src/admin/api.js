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

export const adminApi = {
  me() {
    return api("GET", "/api/me");
  },

  async claim(token) {
    return api("POST", "/api/claim", { token });
  },

  async logout() {
    return api("POST", "/api/admin/logout");
  },

  async overview() {
    return api("POST", "/api/admin/overview", {});
  },

  async setPhase(phase, graceSeconds) {
    return api("POST", "/api/admin/set-phase", { phase, grace_seconds: graceSeconds });
  },

  async skipGrace() {
    return api("POST", "/api/admin/skip-grace", {});
  },

  async resetSlot(team, index) {
    return api("POST", "/api/admin/reset-slot", { team, index });
  },

  async addGalleryEntry(title, avgHits, team, index) {
    return api("POST", "/api/admin/gallery", { title, avg_hits: avgHits, team, index });
  },

  async deleteGalleryEntry(id) {
    return api("DELETE", `/api/admin/gallery/${id}`, {});
  },

  slotVideoUrl(team, index) {
    return `/api/admin/slot-video/${team}/${index}`;
  },
};
