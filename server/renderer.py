"""
Sandboxed student script runner.

Execution model:
  1. Docker (preferred) — one persistent watcher container per slot:
       • No network access
       • 1 GB RAM cap (no swap)
       • 2 CPU cores (fast ffmpeg encoding)
       • 64 process limit (blocks fork-bombs)
       • Non-root sandbox user (uid 1000)
       • /work is writable; /work/assets is read-only
       • Container stays alive between renders — no startup cost after first run

  The server writes script.py then drops /work/trigger.
  The in-container watcher.py detects trigger, runs script.py as a subprocess,
  and writes /work/result ("ok"/"error"/"timeout" + stderr).
  The server polls result and reads output.mp4.

  2. Subprocess fallback — used when Docker is unavailable.
       Less safe but still has: timeout, SDL_VIDEODRIVER=dummy,
       and the AST import allowlist (first line of defence for both paths).

Build the Docker image once:
    docker build -f Dockerfile.sandbox -t vibetouhou-sandbox .
"""

import ast
import json
import os
import shutil
import sys
import subprocess
import threading
import time
from queue import Empty, Full, Queue
from pathlib import Path
from typing import Any, Optional

from config import (
    DATA_DIR,
    MAX_RENDER_SECONDS,
    ALLOWED_IMPORTS,
    MAX_RENDER_WORKERS,
    MAX_RENDER_QUEUE,
)

DOCKER_IMAGE = "vibetouhou-sandbox:latest"

# ── Job tracking (in-memory) ───────────────────────────────────────────────────
# slot_key → {"status": "queued"|"running"|"done"|"error", "stderr": str}
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()
_render_queue: Queue[tuple[str, str, int, str]] = Queue(maxsize=MAX_RENDER_QUEUE)
_workers_started = False
_workers_lock = threading.Lock()
_ASSET_LINKS_META = ".asset_links.json"
_RESERVED_RUNTIME_NAMES = {"script.py", "output.mp4", "published.mp4", _ASSET_LINKS_META, "trigger", "result"}


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
    with _jobs_lock:
        return dict(_jobs.get(key, {"status": "idle", "stderr": ""}))


def _set_status(key: str, status: str, stderr: str = "") -> None:
    with _jobs_lock:
        _jobs[key] = {"status": status, "stderr": stderr}


def _start_workers() -> None:
    global _workers_started
    with _workers_lock:
        if _workers_started:
            return
        count = max(1, MAX_RENDER_WORKERS)
        for i in range(count):
            t = threading.Thread(target=_worker_loop, name=f"render-worker-{i+1}", daemon=True)
            t.start()
        _workers_started = True


def _worker_loop() -> None:
    while True:
        try:
            key, team, index, script = _render_queue.get(timeout=1)
        except Empty:
            continue
        try:
            _run_job(key, team, index, script)
        finally:
            _render_queue.task_done()


def _run_job(key: str, team: str, index: int, script: str) -> None:
    _set_status(key, "running")
    d = slot_dir(team, index)
    script_path = d / "script.py"
    script_path.write_text(script, encoding="utf-8")
    _stage_assets_for_runtime(d)

    if _docker_available():
        _run_docker(key, d)
    else:
        _run_subprocess(key, d)


def _read_staged_asset_names(meta_path: Path) -> set[str]:
    if not meta_path.exists():
        return set()
    try:
        payload = json.loads(meta_path.read_text(encoding="utf-8"))
        if isinstance(payload, dict) and isinstance(payload.get("names"), list):
            return {str(x) for x in payload["names"]}
    except Exception:
        pass
    return set()


def _stage_assets_for_runtime(slot_path: Path) -> None:
    """
    Make uploaded assets available from the script cwd (/work), so scripts can do
    pygame.image.load("my_asset.png") without prefixing assets/.
    """
    assets_dir = slot_path / "assets"
    assets_dir.mkdir(exist_ok=True)
    meta_path = slot_path / _ASSET_LINKS_META

    old_names = _read_staged_asset_names(meta_path)
    for name in old_names:
        target = slot_path / name
        if target.exists() or target.is_symlink():
            try:
                target.unlink()
            except Exception:
                pass

    staged_names: list[str] = []
    for src in sorted(assets_dir.iterdir()):
        if not src.is_file():
            continue
        name = src.name
        if name in _RESERVED_RUNTIME_NAMES:
            continue
        dst = slot_path / name
        if dst.exists() or dst.is_symlink():
            # Avoid clobbering non-staged runtime files.
            continue
        try:
            dst.symlink_to(Path("assets") / name)
        except Exception:
            shutil.copy2(src, dst)
        staged_names.append(name)

    meta_path.write_text(json.dumps({"names": staged_names}, indent=2), encoding="utf-8")


def start_render(team: str, index: int, script: str) -> Optional[str]:
    """
    Validate and kick off a render job.
    Returns an error string on validation failure, None on success (job started).
    """
    err = check_imports(script)
    if err:
        return err

    key = f"{team}-{index}"
    current = get_status(team, index)
    if current["status"] in {"queued", "running"}:
        return "A render is already running for this slot. Wait for it to finish before submitting again."

    _set_status(key, "queued")
    _start_workers()
    try:
        _render_queue.put_nowait((key, team, index, script))
    except Full:
        _set_status(key, "error")
        return "Render queue is full. Please retry in a few moments."
    return None


# ── Watcher container pool ────────────────────────────────────────────────────
# One persistent container per slot; stays alive between renders.
# Communication via files in the mounted /work volume:
#   server writes  /work/trigger  → watcher runs script.py
#   watcher writes /work/result   → server reads outcome
_watcher_containers: dict[str, Any] = {}
_watcher_lock = threading.Lock()

_SANDBOX_ENV = {
    "SDL_VIDEODRIVER": "dummy",
    "SDL_AUDIODRIVER": "dummy",
    "HOME": "/work",
    "PYTHONUNBUFFERED": "1",
}


def _get_or_create_watcher(key: str, d: Path) -> Any:
    """Return the running watcher container for this slot, creating it if needed."""
    import docker as docker_sdk
    with _watcher_lock:
        c = _watcher_containers.get(key)
        if c is not None:
            try:
                c.reload()
                if c.status == "running":
                    return c
            except Exception:
                pass
            try: c.remove(force=True)
            except Exception: pass

        assets_dir = d / "assets"
        assets_dir.mkdir(exist_ok=True)

        c = docker_sdk.from_env().containers.run(
            DOCKER_IMAGE,
            volumes={
                str(d.resolve()):           {"bind": "/work",        "mode": "rw"},
                str(assets_dir.resolve()):  {"bind": "/work/assets", "mode": "ro"},
            },
            working_dir="/work",
            network_disabled=True,
            mem_limit="1g",
            memswap_limit="1g",
            cpu_period=100_000,
            cpu_quota=200_000,
            pids_limit=64,
            user="1000",
            environment={**_SANDBOX_ENV, "RENDER_TIMEOUT": str(MAX_RENDER_SECONDS)},
            detach=True,
            remove=False,
        )
        _watcher_containers[key] = c
        return c


# ── Docker execution (preferred) ───────────────────────────────────────────────

def _run_docker(key: str, d: Path) -> None:
    import docker as docker_sdk

    try:
        container = _get_or_create_watcher(key, d)
    except docker_sdk.errors.ImageNotFound:
        _set_status(
            key, "error",
            f"Docker image '{DOCKER_IMAGE}' not found.\n"
            "Run: docker build -f Dockerfile.sandbox -t vibetouhou-sandbox .",
        )
        return
    except Exception as exc:
        _set_status(key, "error", f"Docker error starting watcher: {exc}")
        return

    result_path  = d / "result"
    trigger_path = d / "trigger"

    # Clean up any leftover result from a previous run
    try: result_path.unlink(missing_ok=True)
    except Exception: pass

    # Signal the watcher to start execution
    trigger_path.write_text("go", encoding="utf-8")

    # Poll for the result file (watcher writes it when the script finishes)
    deadline = time.monotonic() + MAX_RENDER_SECONDS + 10  # +10s buffer
    while time.monotonic() < deadline:
        if result_path.exists():
            break
        time.sleep(0.1)
    else:
        _set_status(key, "error", f"Script timed out after {MAX_RENDER_SECONDS}s.")
        return

    try:
        content = result_path.read_text(encoding="utf-8")
        result_path.unlink(missing_ok=True)
    except Exception as exc:
        _set_status(key, "error", f"Could not read watcher result: {exc}")
        return

    status_line, _, stderr_text = content.partition("\n")
    if status_line == "ok":
        _set_status(key, "done", stderr_text)
    elif status_line == "timeout":
        _set_status(key, "error", stderr_text or f"Script timed out after {MAX_RENDER_SECONDS}s.")
    else:
        _set_status(key, "error", stderr_text or "Script did not produce output.mp4.")


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
            _set_status(key, "error", WARNING + (result.stderr or "No output.mp4 was created."))
        else:
            _set_status(key, "done", WARNING + result.stderr)

    except subprocess.TimeoutExpired:
        _set_status(key, "error", WARNING + f"Script timed out after {MAX_RENDER_SECONDS} seconds.")
    except Exception as exc:
        _set_status(key, "error", WARNING + str(exc))
