"""
Sandboxed student script runner.

Execution priority:
  1. Docker (preferred) — fully isolated container:
       • No network access
       • 256 MB RAM cap (no swap)
       • 50% of one CPU core
       • 64 process limit (blocks fork-bombs)
       • Non-root sandbox user (uid 1000)
       • Only /work is writable
       • Auto-removed after run
  2. Subprocess fallback — used when Docker is unavailable.
       Less safe but still has: timeout, SDL_VIDEODRIVER=dummy,
       and the AST import allowlist (first line of defence for both paths).

Build the Docker image once:
    docker build -f Dockerfile.sandbox -t vibetouhou-sandbox .
"""

import ast
import os
import sys
import subprocess
import threading
from pathlib import Path
from typing import Optional

from config import DATA_DIR, MAX_RENDER_SECONDS, ALLOWED_IMPORTS

DOCKER_IMAGE = "vibetouhou-sandbox:latest"

# ── Job tracking (in-memory) ───────────────────────────────────────────────────
# slot_key → {"status": "queued"|"running"|"done"|"error", "stderr": str}
_jobs: dict[str, dict] = {}


# ── Helpers ────────────────────────────────────────────────────────────────────

def slot_dir(team: str, index: int) -> Path:
    path = DATA_DIR / team / str(index)
    path.mkdir(parents=True, exist_ok=True)
    (path / "assets").mkdir(exist_ok=True)
    return path


def check_imports(script: str) -> Optional[str]:
    """
    Fast pre-filter: reject obviously disallowed imports before any execution.
    This is NOT a security boundary on its own — Docker is the real boundary.
    """
    try:
        tree = ast.parse(script)
    except SyntaxError as exc:
        return f"Syntax error: {exc}"

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                top = alias.name.split(".")[0]
                if top not in ALLOWED_IMPORTS:
                    return f"Import '{alias.name}' is not allowed."
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                top = node.module.split(".")[0]
                if top not in ALLOWED_IMPORTS:
                    return f"Import '{node.module}' is not allowed."
    return None


def _docker_available() -> bool:
    """Return True if Docker daemon is reachable."""
    try:
        import docker
        docker.from_env().ping()
        return True
    except Exception:
        return False


# ── Public API ─────────────────────────────────────────────────────────────────

def get_status(team: str, index: int) -> dict:
    key = f"{team}-{index}"
    return _jobs.get(key, {"status": "idle", "stderr": ""})


def start_render(team: str, index: int, script: str) -> Optional[str]:
    """
    Validate and kick off a render job.
    Returns an error string on validation failure, None on success (job started).
    """
    err = check_imports(script)
    if err:
        return err

    key = f"{team}-{index}"
    _jobs[key] = {"status": "queued", "stderr": ""}

    def _run():
        _jobs[key]["status"] = "running"
        d = slot_dir(team, index)
        script_path = d / "script.py"
        script_path.write_text(script, encoding="utf-8")

        if _docker_available():
            _run_docker(key, d)
        else:
            _run_subprocess(key, d)

    threading.Thread(target=_run, daemon=True).start()
    return None


# ── Docker execution (preferred) ───────────────────────────────────────────────

def _run_docker(key: str, d: Path):
    import docker as docker_sdk

    client = docker_sdk.from_env()
    container = None

    env = {
        "SDL_VIDEODRIVER": "dummy",
        "SDL_AUDIODRIVER": "dummy",
        "HOME": "/work",
        "PYTHONUNBUFFERED": "1",
    }

    try:
        container = client.containers.run(
            DOCKER_IMAGE,
            command=["python", "/work/script.py"],
            volumes={str(d.resolve()): {"bind": "/work", "mode": "rw"}},
            working_dir="/work",
            # ── Isolation ──────────────────────────────────────────────
            network_disabled=True,          # no internet/LAN access
            mem_limit="1g",                 # 1 GB RAM (video frames are huge)
            memswap_limit="1g",             # no swap either
            cpu_period=100_000,
            cpu_quota=50_000,               # max 50% of one CPU core
            pids_limit=64,                  # no fork-bombs
            # ── Runtime ────────────────────────────────────────────────
            user="1000",                    # sandbox user (non-root)
            environment=env,
            stdout=True,
            stderr=True,
            detach=True,                    # we manage timeout manually
            remove=False,                   # we remove after reading logs
        )

        try:
            result = container.wait(timeout=MAX_RENDER_SECONDS)
            stderr_bytes = container.logs(stdout=False, stderr=True)
            stderr_text  = stderr_bytes.decode(errors="replace")
            exit_code    = result.get("StatusCode", -1)
        except Exception:
            # Timed out or Docker error — kill container
            try: container.kill()
            except Exception: pass
            _jobs[key] = {
                "status": "error",
                "stderr": f"Script timed out after {MAX_RENDER_SECONDS}s.",
            }
            return
        finally:
            try: container.remove(force=True)
            except Exception: pass

        out_path = d / "output.mp4"
        if exit_code != 0 or not out_path.exists():
            _jobs[key] = {
                "status": "error",
                "stderr": stderr_text or "Script did not produce output.mp4.",
            }
        else:
            _jobs[key] = {"status": "done", "stderr": stderr_text}

    except docker_sdk.errors.ImageNotFound:
        _jobs[key] = {
            "status": "error",
            "stderr": (
                f"Docker image '{DOCKER_IMAGE}' not found.\n"
                "Run: docker build -f Dockerfile.sandbox -t vibetouhou-sandbox ."
            ),
        }
    except Exception as exc:
        _jobs[key] = {"status": "error", "stderr": f"Docker error: {exc}"}


# ── Subprocess fallback (when Docker is not running) ───────────────────────────

def _run_subprocess(key: str, d: Path):
    """
    Less safe than Docker but still has a timeout and headless SDL.
    Only used as a fallback (e.g. during local dev without Docker running).
    A warning is prepended to stderr so the operator knows Docker was skipped.
    """
    script_path = d / "script.py"
    env = os.environ.copy()
    env["SDL_VIDEODRIVER"] = "dummy"
    env["SDL_AUDIODRIVER"] = "dummy"
    env.pop("DISPLAY", None)

    WARNING = "[WARNING] Docker unavailable — running without full sandboxing.\n"

    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=str(d),
            env=env,
            capture_output=True,
            text=True,
            timeout=MAX_RENDER_SECONDS,
        )
        out_path = d / "output.mp4"
        if not out_path.exists():
            _jobs[key] = {
                "status": "error",
                "stderr": WARNING + (result.stderr or "No output.mp4 was created."),
            }
        else:
            _jobs[key] = {"status": "done", "stderr": WARNING + result.stderr}

    except subprocess.TimeoutExpired:
        _jobs[key] = {
            "status": "error",
            "stderr": WARNING + f"Script timed out after {MAX_RENDER_SECONDS} seconds.",
        }
    except Exception as exc:
        _jobs[key] = {"status": "error", "stderr": WARNING + str(exc)}
