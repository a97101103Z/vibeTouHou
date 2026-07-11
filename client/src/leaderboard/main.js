/**
 * Leaderboard page entry point.
 *
 * Public (no auth required). Fetches leaderboard data and renders:
 *  - Left: all entries (red + blue) sorted by points descending
 *  - Right: two avg cards for red and blue
 */

import { applyStrings } from "../i18n.js";
import { API_BASE } from "../constants.js";
import { NO_SCORES, LB_MEMBER, SECTION_GAUNTLET } from "../strings.js";

// Patch fetch to use the configured API base path
if (API_BASE !== "/api") {
  const origFetch = window.fetch;
  window.fetch = (input, init) => {
    if (typeof input === "string" && input.startsWith("/api/")) {
      return origFetch(API_BASE + input.slice(4), init);
    }
    return origFetch(input, init);
  };
}

const POLL_INTERVAL = 5000;
const HITS_TO_POINTS = { 0: 3, 1: 2, 2: 1 };
const pointsForHits = (h) => HITS_TO_POINTS[h] ?? 0;

let pollTimer = null;

applyStrings();

// ── Phase ────────────────────────────────────────────────────────────────────

const PHASE_LABELS = {
  code: { emoji: "✏️", text: "Coding Phase" },
  gauntlet: { emoji: "⚔️", text: "Gauntlet Active" },
};

let countdownInterval = null;
let currentTimerAt = null;

function tickCountdown() {
  const timerEl = document.getElementById("lb-phase-timer");
  if (!timerEl || !currentTimerAt) return;

  const secsLeft = Math.max(0, Math.ceil(currentTimerAt - Date.now() / 1000));
  if (secsLeft <= 0) {
    timerEl.textContent = "Time's up!";
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    return;
  }
  const mins = Math.floor(secsLeft / 60);
  const secs = String(secsLeft % 60).padStart(2, "0");
  timerEl.textContent = `${mins}:${secs}`;
}

async function fetchPhase() {
  try {
    const res = await fetch("/api/phase");
    const data = await res.json();
    const el = document.getElementById("lb-phase");
    const textEl = document.getElementById("lb-phase-text");
    const timerEl = document.getElementById("lb-phase-timer");
    if (!el || !textEl) return;

    const info = PHASE_LABELS[data.phase] ?? { emoji: "❓", text: data.phase };
    textEl.innerHTML = `<span class="lb-phase-emoji">${info.emoji}</span> ${info.text}`;
    el.setAttribute("data-phase", data.phase);

    const timerAt = data.timer_at;
    if (timerAt) {
      // Always show timer once set — keep ticking or show expired state
      if (currentTimerAt !== timerAt) {
        currentTimerAt = timerAt;
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(tickCountdown, 500);
      }
      tickCountdown();
      if (timerEl) timerEl.style.display = "";
    } else {
      // No timer set — hide it
      currentTimerAt = null;
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      if (timerEl) timerEl.style.display = "none";
    }
  } catch (_) {}
}

// ── Leaderboard rendering ────────────────────────────────────────────────────

function renderLeaderboard(data) {
  const entriesEl = document.getElementById("lb-entries");
  const avgRedEl = document.getElementById("lb-avg-red");
  const avgBlueEl = document.getElementById("lb-avg-blue");
  if (!entriesEl) return;

  // Collect all members with points
  const allMembers = [];
  const teamStats = { red: { total: 0, count: 0 }, blue: { total: 0, count: 0 } };

  for (const team of ["red", "blue"]) {
    const teamData = data.scores?.[team] ?? {};

    for (const [idx, slotData] of Object.entries(teamData)) {
      const scores = slotData.scores ?? {};
      let total = 0;
      for (const s of Object.values(scores)) {
        const bh = s.best_hits;
        if (bh != null) total += pointsForHits(bh);
      }
      allMembers.push({ slot: `${team}-${idx}`, team, total_points: total });
      teamStats[team].total += total;
      teamStats[team].count++;
    }
  }

  // Sort descending by points
  allMembers.sort((a, b) => b.total_points - a.total_points);

  // Update avg cards
  for (const team of ["red", "blue"]) {
    const st = teamStats[team];
    const avg = st.count ? Math.round(st.total / st.count * 10) / 10 : 0;
    const el = team === "red" ? avgRedEl : avgBlueEl;
    if (el) el.textContent = `${avg} pts`;
  }

  // Render entries
  if (allMembers.length === 0) {
    entriesEl.innerHTML = `<div class="lb-empty">${NO_SCORES}</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (let rank = 0; rank < allMembers.length; rank++) {
    const m = allMembers[rank];
    const row = document.createElement("div");
    row.className = `lb-row lb-${m.team}`;
    row.innerHTML = `<span class="lb-rank">${rank + 1}</span><span class="lb-slot">${m.slot}</span><span class="lb-points">${m.total_points} pts</span>`;
    fragment.appendChild(row);
  }

  entriesEl.innerHTML = "";
  entriesEl.appendChild(fragment);
}

async function fetchLeaderboard() {
  try {
    const res = await fetch("/api/leaderboard", { credentials: "include" });
    const data = await res.json();
    renderLeaderboard(data);
  } catch (_) {}
}

// ── Init ─────────────────────────────────────────────────────────────────────

fetchPhase();
fetchLeaderboard();
pollTimer = setInterval(() => {
  fetchPhase();
  fetchLeaderboard();
}, POLL_INTERVAL);
