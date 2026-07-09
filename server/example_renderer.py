"""
Pre-render example scripts from pattern_examples/ at server startup.

Cached MP4s are stored in data/examples/ and served via the examples API.
"""

import logging
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from config import EXAMPLES_DIR, DATA_DIR, MAX_RENDER_SECONDS, ALLOWED_IMPORTS

EXAMPLES_CACHE = DATA_DIR / "examples"
_RENDER_ENV = {
    "SDL_VIDEODRIVER": "dummy",
    "SDL_AUDIODRIVER": "dummy",
    "HOME": "/tmp",
    "PYTHONUNBUFFERED": "1",
    "OPENBLAS_NUM_THREADS": "1",
    "MKL_NUM_THREADS": "1",
    "OMP_NUM_THREADS": "1",
}


def _render_one(source_path: Path, out_path: Path) -> bool:
    """Render a single example script. Returns True on success."""
    with tempfile.TemporaryDirectory(prefix="vibe_example_") as tmp:
        script_dst = Path(tmp) / "script.py"
        shutil.copy2(source_path, script_dst)

        env = os.environ.copy()
        env.update(_RENDER_ENV)
        env.pop("DISPLAY", None)

        try:
            proc = subprocess.Popen(
                [sys.executable, str(script_dst)],
                cwd=tmp,
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                text=True,
            )
            _, stderr_text = proc.communicate(timeout=MAX_RENDER_SECONDS)

            output_path = Path(tmp) / "output.mp4"
            if proc.returncode != 0 or not output_path.exists():
                logging.warning(
                    "Example render failed [%s]: exit=%d stderr=%.200s",
                    source_path.name, proc.returncode, stderr_text or "",
                )
                return False

            out_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(output_path), str(out_path))
            logging.info("Pre-rendered example: %s", source_path.name)
            return True

        except subprocess.TimeoutExpired:
            proc.kill()
            proc.communicate()
            logging.warning("Example render timed out [%s]", source_path.name)
            return False
        except Exception as exc:
            logging.warning("Example render error [%s]: %s", source_path.name, exc)
            return False


def pre_render_all():
    """Iterate pattern_examples/ and render any uncached scripts."""
    if not EXAMPLES_DIR.is_dir():
        logging.warning("EXAMPLES_DIR %s not found; skipping pre-render.", EXAMPLES_DIR)
        return

    EXAMPLES_CACHE.mkdir(parents=True, exist_ok=True)

    for f in sorted(EXAMPLES_DIR.iterdir()):
        if f.suffix != ".py":
            continue
        out_path = EXAMPLES_CACHE / f"{f.stem}.mp4"
        if out_path.exists():
            continue
        _render_one(f, out_path)
