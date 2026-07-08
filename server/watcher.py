#!/usr/bin/env python3
"""
VibeTouHou sandbox watcher.

Runs inside the sandbox container as the main process (CMD).
Polls /work/trigger every 50 ms; when found:
  - deletes trigger so it doesn't re-fire on restart
  - runs /work/script.py as a fresh subprocess
  - writes /work/result: first line is "ok" | "error" | "timeout",
    remaining lines are the script's stderr
"""
import os
import subprocess
import time
from pathlib import Path

WORK    = Path("/work")
TRIGGER = WORK / "trigger"
RESULT  = WORK / "result"
SCRIPT  = WORK / "script.py"
TIMEOUT = int(os.environ.get("RENDER_TIMEOUT", "20"))

while True:
    if TRIGGER.exists():
        # Consume the trigger immediately so a container restart won't re-run it
        try:
            TRIGGER.unlink()
        except OSError:
            pass

        proc = subprocess.Popen(
            ["python", str(SCRIPT)],
            cwd=str(WORK),
            stderr=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
        )
        try:
            _, stderr_bytes = proc.communicate(timeout=TIMEOUT)
            stderr_text = stderr_bytes.decode(errors="replace")
            if proc.returncode == 0 and (WORK / "output.mp4").exists():
                RESULT.write_text("ok\n" + stderr_text, encoding="utf-8")
            else:
                RESULT.write_text("error\n" + stderr_text, encoding="utf-8")
        except subprocess.TimeoutExpired:
            import signal
            proc.send_signal(signal.SIGINT)
            try:
                _, stderr_bytes = proc.communicate(timeout=2)
                stderr_text = stderr_bytes.decode(errors="replace")
                RESULT.write_text("error\n" + stderr_text, encoding="utf-8")
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.communicate()
                RESULT.write_text(
                    f"timeout\nScript exceeded {TIMEOUT}s limit and failed to exit.",
                    encoding="utf-8",
                )

    time.sleep(0.05)  # 50 ms poll — low CPU, fast enough response
