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
PLAYER_SPEED = 350        # max player movement px/s (used for trajectory validation)
BRIGHTNESS_THRESHOLD = 128  # Y > this = hit zone  (Y = 0.299R + 0.587G + 0.114B)

# ── Sandbox ────────────────────────────────────────────────────────────────────
MAX_RENDER_SECONDS = 20   # kill runaway student scripts after this many seconds
MAX_RENDER_WORKERS = int(os.getenv("MAX_RENDER_WORKERS", "3"))
MAX_RENDER_QUEUE = int(os.getenv("MAX_RENDER_QUEUE", "48"))

# Imports that student scripts are allowed to use
ALLOWED_IMPORTS = {
    "math", "random", "colorsys", "itertools", "functools",
    "imageio", "numpy", "np", "PIL", "Pillow",
    "os", "sys", "time", "gizeh",
}

# ── Path prefix ────────────────────────────────────────────────────────────────
# ROOT_PATH is baked in at Docker build time via _build_config.py.
# When running outside Docker (local dev) the defaults below apply.
try:
    from _build_config import ROOT_PATH, API_PREFIX  # type: ignore
except ImportError:
    ROOT_PATH = ""
    API_PREFIX = "/api"

# ── Storage ────────────────────────────────────────────────────────────────────
# DATA_DIR lives at the project root (one level above server/) so that
# uvicorn's --reload watcher (which watches server/) never sees data/ writes
# and doesn't restart the server mid-render.
DATA_DIR   = Path(__file__).parent.parent / "data"
STATIC_DIR = Path(__file__).parent / "static"

# When running inside Docker with /var/run/docker.sock mounted,
# sandbox containers need bind-mount paths resolved on the HOST,
# not inside this container.  Set HOST_DATA_DIR to the absolute
# host path of the ./data directory (e.g. /data/code/vibeTouHou/data).
# Falls back to DATA_DIR (works for local subprocess mode or when
# sandbox containers aren't sibling Docker containers).
HOST_DATA_DIR = Path(os.getenv("HOST_DATA_DIR", str(DATA_DIR)))

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

# ── History ───────────────────────────────────────────────────────────────────
MAX_HISTORY_ENTRIES = int(os.getenv("MAX_HISTORY_ENTRIES", "100"))
# Store history in /tmp2 if available (saves project disk space)
_tmp2 = Path("/tmp2")
if _tmp2.exists():
    _tmp2_base = _tmp2 / "b14902002"
    _tmp2_base.mkdir(parents=True, exist_ok=True)
    HISTORY_DIR = _tmp2_base / "vibeTouHou_history"
else:
    HISTORY_DIR = DATA_DIR / "history"
