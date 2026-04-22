"""
Backend trajectory re-validation.

Reads the stored MP4 frame by frame and checks whether any trajectory
point places the player's circle on a bright pixel (Y > threshold).

This is the anti-cheat layer that prevents clients from faking a pass.
"""

from pathlib import Path

import imageio
import numpy as np

from config import PLAYER_RADIUS_REAL, BRIGHTNESS_THRESHOLD, FPS


def validate(video_path: Path, trajectory: list[dict]) -> tuple[bool, str]:
    """
    trajectory: list of {"x": float, "y": float, "t": float}

    Returns (ok, reason).
      ok=True  → no collisions found  → safe to publish
      ok=False → collision detected   → reject with reason
    """
    if not video_path.exists():
        return False, "Video file not found on server."

    try:
        reader = imageio.get_reader(str(video_path), format="ffmpeg")
        meta   = reader.get_meta_data()
        fps    = float(meta.get("fps", FPS))
    except Exception as exc:
        return False, f"Could not open video: {exc}"

    # Pre-index trajectory by frame number so we only check frames we need
    frame_hits: dict[int, list[tuple[float, float]]] = {}
    for pt in trajectory:
        fidx = int(pt["t"] * fps)
        frame_hits.setdefault(fidx, []).append((float(pt["x"]), float(pt["y"])))

    r = PLAYER_RADIUS_REAL

    try:
        for fidx, frame in enumerate(reader):
            if fidx not in frame_hits:
                continue
            # frame shape: (H, W, 3) uint8
            h, w = frame.shape[:2]
            for px, py in frame_hits[fidx]:
                # Sample every pixel inside the player's circle
                for dy in range(-r, r + 1):
                    for dx in range(-r, r + 1):
                        if dx * dx + dy * dy > r * r:
                            continue
                        fx, fy = int(px + dx), int(py + dy)
                        if not (0 <= fx < w and 0 <= fy < h):
                            continue
                        R, G, B = int(frame[fy, fx, 0]), int(frame[fy, fx, 1]), int(frame[fy, fx, 2])
                        Y = 0.299 * R + 0.587 * G + 0.114 * B
                        if Y > BRIGHTNESS_THRESHOLD:
                            reader.close()
                            return False, (
                                f"Collision detected at t={trajectory[0]['t']:.2f}s "
                                f"near pixel ({fx},{fy}) with brightness {Y:.1f}."
                            )
    finally:
        reader.close()

    return True, "OK"
