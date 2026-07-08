import os
import sys
import shutil
import time
from pathlib import Path

# Add server/ to path so we can import config
_server_dir = Path(__file__).parent / "server"
if str(_server_dir) not in sys.path:
    sys.path.insert(0, str(_server_dir))


def reset_environment():
    base_dir = Path(__file__).parent.resolve()
    data_dir = base_dir / "data"

    if not data_dir.exists():
        print("Data directory doesn't exist. Nothing to reset.")
        return

    # Determine archive location
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    _tmp2 = Path("/tmp2")
    if _tmp2.exists():
        archive_base = _tmp2 / "b14902002"
        archive_base.mkdir(parents=True, exist_ok=True)
        archive_dir = archive_base / f"data_archive_{timestamp}"
        print(f"ℹ️  /tmp2 detected — archiving to {archive_dir}")
    else:
        archive_dir = base_dir / f"data_archive_{timestamp}"
        print(f"ℹ️  /tmp2 not found — archiving locally to {archive_dir.name}")

    try:
        shutil.move(str(data_dir), str(archive_dir))
        print(f"✅ Archived old data to: {archive_dir}")

        data_dir.mkdir(exist_ok=True)
        print("✅ Created fresh empty 'data/' directory.")
    except Exception as e:
        print(f"❌ Error archiving data: {e}")
        print("Hint: Stop the FastAPI server first, then retry.")
        return

    # Delete history (videos are large; no need to archive)
    try:
        from config import HISTORY_DIR
        if HISTORY_DIR.exists():
            shutil.rmtree(HISTORY_DIR, ignore_errors=True)
            print(f"✅ Cleared render history: {HISTORY_DIR}")
        else:
            print("ℹ️  No history directory found — skipping.")
    except Exception as e:
        print(f"⚠️  Could not clear history: {e}")

    print("\nAll user accounts have been unlocked!")
    print("All code, patterns, and scores have been wiped from the live server!")
    print("Please restart the server (Ctrl+C then uvicorn main:app again) to clear memory caches.")


if __name__ == "__main__":
    reset_environment()
