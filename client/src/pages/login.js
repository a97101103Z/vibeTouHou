/**
 * login.js — Token-based team claiming flow.
 */

import { activateApp } from '../main.js';

let claimedSlot = null;

export function initLogin(onSuccess) {
  const overlay = document.getElementById('login-overlay');
  const tokenInput = document.getElementById('token-input');
  const statusEl = document.getElementById('login-status');
  const claimBtn = document.getElementById('btn-claim');

  if (!tokenInput) {
    // Fallback: create input if not in DOM
    console.error('Token input element not found');
    return;
  }

  // Focus on input
  tokenInput.focus();

  // Handle Enter key
  tokenInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      tryClaim();
    }
  });

  // Handle claim button
  if (claimBtn) {
    claimBtn.addEventListener('click', tryClaim);
  }

  // ── Claim ────────────────────────────────────────────────────────────────
  async function tryClaim() {
    const token = tokenInput.value.trim();
    if (!token) {
      statusEl.className = 'login-status error';
      statusEl.textContent = 'Please enter your team token.';
      return;
    }

    statusEl.className = 'login-status';
    statusEl.textContent = 'Claiming slot…';

    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (res.ok) {
        const data = await res.json();
        claimedSlot = data.slot;
        statusEl.className = 'login-status success';
        statusEl.textContent = `✓ Assigned to ${claimedSlot.toUpperCase()}!`;
        setTimeout(() => onSuccess(claimedSlot.split('-')[0], parseInt(claimedSlot.split('-')[1])), 500);
      } else {
        const err = await res.json();
        statusEl.className = 'login-status error';
        statusEl.textContent = `✗ ${err.detail || 'Could not claim slot.'}`;
      }
    } catch (_) {
      statusEl.className = 'login-status error';
      statusEl.textContent = '✗ Could not reach server.';
    }
  }
}
