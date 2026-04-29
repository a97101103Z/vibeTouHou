from pathlib import Path
import os
import warnings

# ── Canvas / video ─────────────────────────────────────────────────────────────
WIDTH  = 800
HEIGHT = 600
FPS    = 30            # render fps (30 keeps file sizes reasonable)
DURATION = 10.0        # pattern duration in seconds

# ── Game rules ─────────────────────────────────────────────────────────────────
PLAYER_RADIUS_TEST = 14   # larger hitbox used in playtest / verify-to-publish
PLAYER_RADIUS_REAL = 8    # real hitbox used in the competition gauntlet
BRIGHTNESS_THRESHOLD = 128  # Y > this = hit zone  (Y = 0.299R + 0.587G + 0.114B)

# ── Sandbox ────────────────────────────────────────────────────────────────────
MAX_RENDER_SECONDS = 60   # kill runaway student scripts after this many seconds
MAX_RENDER_WORKERS = int(os.getenv("MAX_RENDER_WORKERS", "3"))
MAX_RENDER_QUEUE = int(os.getenv("MAX_RENDER_QUEUE", "48"))

# Imports that student scripts are allowed to use
ALLOWED_IMPORTS = {
    "math", "random", "colorsys", "itertools", "functools",
    "imageio", "numpy", "np", "pygame", "PIL", "Pillow",
    "os", "sys", "time", "gizeh",
}

# ── Storage ────────────────────────────────────────────────────────────────────
# DATA_DIR lives at the project root (one level above server/) so that
# uvicorn's --reload watcher (which watches server/) never sees data/ writes
# and doesn't restart the server mid-render.
DATA_DIR   = Path(__file__).parent.parent / "data"
STATIC_DIR = Path(__file__).parent / "static"

# ── HTTP ───────────────────────────────────────────────────────────────────────
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")
    if origin.strip()
]

# ── Teams ──────────────────────────────────────────────────────────────────────
TEAMS = ("red", "blue")
TEAM_SIZE = 12 # slots per team (1 – TEAM_SIZE)

# ── Tokens ─────────────────────────────────────────────────────────────────────
_RED_DEFAULT   = "RED-TOKEN-DEV-HD4G9GKN"
_BLUE_DEFAULT  = "BLUE-TOKEN-DEV-EL3O9BW8"
_ADMIN_DEFAULT = "ADMIN-TOKEN-DEV-K2M8N3PQ"

RED_TEAM_TOKEN  = os.getenv("RED_TEAM_TOKEN",  _RED_DEFAULT)
BLUE_TEAM_TOKEN = os.getenv("BLUE_TEAM_TOKEN", _BLUE_DEFAULT)
ADMIN_TOKEN     = os.getenv("ADMIN_TOKEN",     _ADMIN_DEFAULT)

for _var, _val, _default in (
    ("RED_TEAM_TOKEN",  RED_TEAM_TOKEN,  _RED_DEFAULT),
    ("BLUE_TEAM_TOKEN", BLUE_TEAM_TOKEN, _BLUE_DEFAULT),
    ("ADMIN_TOKEN",     ADMIN_TOKEN,     _ADMIN_DEFAULT),
):
    if _val == _default:
        warnings.warn(
            f"{_var} is using its insecure default value. "
            "Set this environment variable before deploying to production.",
            UserWarning,
            stacklevel=2,
        )

# Token-to-team mapping for validation
TEAM_TOKENS = {
    RED_TEAM_TOKEN: "red",
    BLUE_TEAM_TOKEN: "blue",
}

# ── Token startup validation ────────────────────────────────────────────────────
_all_tokens = {
    "RED_TEAM_TOKEN": RED_TEAM_TOKEN,
    "BLUE_TEAM_TOKEN": BLUE_TEAM_TOKEN,
    "ADMIN_TOKEN": ADMIN_TOKEN,
}

for _name, _tok in _all_tokens.items():
    if not _tok:
        raise ValueError(f"{_name} must not be empty.")

_token_values = list(_all_tokens.values())
if len(set(_token_values)) != len(_token_values):
    raise ValueError(
        "RED_TEAM_TOKEN, BLUE_TEAM_TOKEN, and ADMIN_TOKEN must all be unique."
    )
