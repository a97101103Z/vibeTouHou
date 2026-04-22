/**
 * login.js — Team picker + slot grid + claim flow.
 */

import { activateApp } from '../main.js';

const TEAM_SIZE = 12;
let selectedTeam = null;
let selectedIndex = null;

export function initLogin(onSuccess) {
  const overlay   = document.getElementById('login-overlay');
  const slotSec   = document.getElementById('slot-section');
  const slotGrid  = document.getElementById('slot-grid');
  const statusEl  = document.getElementById('login-status');
  const btnRed    = document.getElementById('btn-red');
  const btnBlue   = document.getElementById('btn-blue');

  // ── Team selection ───────────────────────────────────────────────────────
  async function pickTeam(team) {
    selectedTeam  = team;
    selectedIndex = null;

    btnRed.classList.toggle('active',  team === 'red');
    btnBlue.classList.toggle('active', team === 'blue');

    // Apply provisional accent so grid highlights match
    document.body.classList.remove('team-red', 'team-blue');
    document.body.classList.add('team-' + team);

    slotSec.style.display = '';
    statusEl.textContent  = '';

    // Fetch already-claimed slots
    let claimed = { red: [], blue: [] };
    try {
      const res = await fetch('/api/slots', { credentials: 'include' });
      claimed   = await res.json();
    } catch (_) {}

    renderGrid(claimed[team] || []);
  }

  btnRed.addEventListener('click',  () => pickTeam('red'));
  btnBlue.addEventListener('click', () => pickTeam('blue'));

  // ── Slot grid ────────────────────────────────────────────────────────────
  function renderGrid(takenIndices) {
    slotGrid.innerHTML = '';
    for (let i = 1; i <= TEAM_SIZE; i++) {
      const cell = document.createElement('button');
      cell.className = 'slot-cell';
      cell.textContent = i;

      if (takenIndices.includes(i)) {
        cell.classList.add('taken');
        cell.disabled = true;
      } else {
        cell.addEventListener('click', () => selectSlot(i, cell));
      }
      slotGrid.appendChild(cell);
    }
  }

  function selectSlot(idx, cell) {
    selectedIndex = idx;
    slotGrid.querySelectorAll('.slot-cell').forEach(c => c.classList.remove('selected'));
    cell.classList.add('selected');

    // Auto-claim on click (no extra button needed)
    tryClaim();
  }

  // ── Claim ────────────────────────────────────────────────────────────────
  async function tryClaim() {
    if (!selectedTeam || !selectedIndex) return;

    statusEl.className = 'login-status';
    statusEl.textContent = 'Claiming slot…';

    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: selectedTeam, index: selectedIndex }),
      });

      if (res.ok) {
        statusEl.className   = 'login-status success';
        statusEl.textContent = `✓ Claimed ${selectedTeam.toUpperCase()}-${selectedIndex}!`;
        setTimeout(() => onSuccess(selectedTeam, selectedIndex), 500);
      } else {
        const err = await res.json();
        statusEl.className   = 'login-status error';
        statusEl.textContent = `✗ ${err.detail || 'Slot taken. Please pick another.'}`;
        // Re-render grid with updated taken list
        await pickTeam(selectedTeam);
      }
    } catch (_) {
      statusEl.className   = 'login-status error';
      statusEl.textContent = '✗ Could not reach server.';
    }
  }
}
