from fastapi import APIRouter, Cookie, HTTPException
from typing import Optional
import identity

# ── Shared session dependency ──────────────────────────────────────────────────

def require_session(session: Optional[str] = Cookie(None)) -> str:
    """FastAPI dependency: returns 'team-index' or raises 401."""
    if not session:
        raise HTTPException(status_code=401, detail="Not logged in. Claim a slot first.")
    slot = identity.get_slot(session)
    if not slot:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    return slot
