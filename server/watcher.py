#!/usr/bin/env python3
"""
VibeTouHou sandbox watcher.

Runs inside the sandbox container as the main process (CMD).
Polls /work/trigger every 50 ms; when found:
  - deletes trigger so it doesn't re-fire on restart
  - runs /work/script.py as a fresh subprocess
  - writes /work/result: JSON with keys "status" ("ok"|"error"|"timeout"),
    "stdout" (captured program output), and "stderr" (structured errors)
"""
import json
import os
import subprocess
import sys
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
            [sys.executable, str(SCRIPT)],
            cwd=str(WORK),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        try:
            stdout_bytes, stderr_bytes = proc.communicate(timeout=TIMEOUT)
            stdout_text = stdout_bytes.decode(errors="replace")
            stderr_text = stderr_bytes.decode(errors="replace")
            if proc.returncode == 0 and (WORK / "output.mp4").exists():
                result = {"status": "ok", "stdout": stdout_text, "stderr": stderr_text}
            else:
                result = {"status": "error", "stdout": stdout_text, "stderr": stderr_text}
            RESULT.write_text(json.dumps(result), encoding="utf-8")
        except subprocess.TimeoutExpired:
            import signal
            proc.send_signal(signal.SIGINT)
            try:
                stdout_bytes, stderr_bytes = proc.communicate(timeout=2)
                stdout_text = stdout_bytes.decode(errors="replace")
                stderr_text = stderr_bytes.decode(errors="replace")
                result = {"status": "error", "stdout": stdout_text, "stderr": stderr_text}
                RESULT.write_text(json.dumps(result), encoding="utf-8")
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.communicate()
                result = {"status": "timeout", "stdout": "", "stderr": f"Script exceeded {TIMEOUT}s limit and failed to exit."}
                RESULT.write_text(json.dumps(result), encoding="utf-8")

    time.sleep(0.05)  # 50 ms poll — low CPU, fast enough response
