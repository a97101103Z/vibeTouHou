/**
 * main.js — SPA router and app bootstrap.
 *
 * Responsibilities:
 *  - Check if the user already has a session; skip login if so.
 *  - Drive the login flow (team pick → slot pick → claim).
 *  - Switch between the 4 pages on navbar clicks.
 *  - Provide a global toast notification helper.
 */

import { initLogin } from './pages/login.js';
import { initSubmit } from './pages/submit.js';
import { initAssets } from './pages/assets.js';
import { initPlaytest } from './pages/playtest.js';
import { initGauntlet } from './pages/gauntlet.js';

// ── Session state (set by login, persisted as a module-level object) ──────────
export const session = { slot: null, team: null, index: null };

// ── Toast helper ──────────────────────────────────────────────────────────────
const toastContainer = document.createElement('div');
toastContainer.id = 'toast-container';
document.body.appendChild(toastContainer);

export function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast${type ? ' toast-' + type : ''}`;
  el.textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Page switching ────────────────────────────────────────────────────────────
const pages = ['submit', 'assets', 'playtest', 'gauntlet'];
const inited = {};
const pageFromPath = () => {
  const name = window.location.pathname.replace(/^\/+/, '').split('/')[0];
  return pages.includes(name) ? name : 'submit';
};

function showPage(name, push = true) {
  if (!pages.includes(name)) name = 'submit';
  pages.forEach(p => {
    document.getElementById('page-' + p).classList.toggle('active', p === name);
    document.getElementById('tab-' + p).classList.toggle('active', p === name);
  });

  const nextPath = name === 'submit' ? '/' : `/${name}`;
  if (push && window.location.pathname !== nextPath) {
    history.pushState({ page: name }, '', nextPath);
  }

  if (!inited[name]) {
    inited[name] = true;
    const el = document.getElementById('page-' + name);
    if (name === 'submit') initSubmit(el);
    else if (name === 'assets') initAssets(el);
    else if (name === 'playtest') initPlaytest(el);
    else if (name === 'gauntlet') initGauntlet(el);
  }
}

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});

window.addEventListener('popstate', () => showPage(pageFromPath(), false));

// ── App boot ──────────────────────────────────────────────────────────────────
async function boot() {
  // Check if we already have a valid session cookie
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    const data = await res.json();

    if (data.slot) {
      const [team, idx] = data.slot.split('-');
      activateApp(team, parseInt(idx));
      return;
    }
  } catch (_) { /* server may not be up yet */ }

  // Show login
  initLogin(activateApp);
}

export function activateApp(team, index) {
  session.slot = `${team}-${index}`;
  session.team = team;
  session.index = index;

  // Apply team theme
  document.body.classList.add('team-' + team);

  // Update player badge
  const badge = document.getElementById('player-badge');
  badge.textContent = session.slot.toUpperCase();

  // Update logo colors to match team
  document.querySelectorAll('.logo-tou, .logo-hou').forEach(el => {
    el.style.color = team === 'red' ? 'var(--red)' : 'var(--blue)';
  });


  // Hide login overlay, show app
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('app').style.display = '';

  showPage(pageFromPath(), false);
}

boot();
