import sys
import os
sys.path.append(r"c:\Users\white\Desktop\vibeTouHou\server")
import renderer

script = """
import math
import time
import os
import imageio
import numpy as np
import gizeh
WIDTH, HEIGHT = 800, 600
FPS = 30
DURATION = 1

PELLETS = 24
PELLET_RADIUS = 5
SPEED = 130
COLOR = (1, 1, 1)

_render_start = time.time()
_TIMEOUT = int(os.environ.get("RENDER_TIMEOUT", "20"))
with imageio.get_writer("output.mp4", fps=FPS, macro_block_size=None,
    output_params=["-preset", "ultrafast", "-crf", "28"]) as _writer:
    for frame_num in range(FPS * DURATION):
        t = frame_num / FPS 
        surface = gizeh.Surface(width=WIDTH, height=HEIGHT, bg_color=(0, 0, 0))
        for i in range(PELLETS):
            angle = (2 * math.pi / PELLETS) * i
            dist = SPEED * t
            x = WIDTH / 2 + math.cos(angle) * dist
            y = HEIGHT / 2 + math.sin(angle) * dist
            circle = gizeh.circle(r=PELLET_RADIUS, xy=(x, y), fill=COLOR)
            circle.draw(surface)
        _writer.append_data(surface.get_npimage())
        if time.time() - _render_start > _TIMEOUT - 5:
            break
print("Done! output.mp4 created.")
"""

renderer._start_workers()
renderer.start_render("test", 1, script)

import time
while True:
    status = renderer.get_status("test", 1)
    print(status)
    if status["status"] in ("done", "error"):
        break
    time.sleep(1)
