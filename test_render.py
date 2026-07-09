import sys
import os
sys.path.append(r"c:\Users\white\Desktop\vibeTouHou\server")
import renderer

script = """
import math
import imageio
import numpy as np
import gizeh
WIDTH, HEIGHT = 800, 600
FPS = 30
DURATION = 1 # 影片長度（秒）

PELLETS = 24 # 圓環上的子彈數量
PELLET_RADIUS = 5 # 每顆子彈的半徑（像素）
SPEED = 130 # 子彈向外擴散的速度（像素/秒）
COLOR = (1, 1, 1) # 白色 (1,1,1) 代表亮度最高，絕對有傷害判定

frames = []
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
    frames.append(surface.get_npimage())

imageio.mimwrite("output.mp4", frames, fps=FPS, macro_block_size=None,
    output_params=["-preset", "ultrafast", "-crf", "28"])
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
