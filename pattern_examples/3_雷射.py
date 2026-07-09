import math
import imageio
import numpy as np
import gizeh

# ─────────────────────────────────────────────────────────────
# vibeTouHou — 旋轉雷射腳本
# ─────────────────────────────────────────────────────────────
# 畫布設定
WIDTH, HEIGHT = 800, 600
FPS = 30
DURATION = 10  # 影片長度（秒）

# 雷射設定
LASER_LENGTH = 2000    # 超長長度，確保任何角度都不會露出兩端邊角
LASER_WIDTH = 20       # 雷射的粗細
COLOR = (1, 0, 0)      # 改為紅色，更有東方彈幕的 Vibe (也可以改回白色 1,1,1)

# 旋轉中心設定（這裡設在畫面正中心）
CENTER_X = WIDTH / 2
CENTER_Y = HEIGHT / 2

# 渲染循環
frames = []
for frame_num in range(FPS * DURATION):
    t = frame_num / FPS  # 當前時間（秒）

    # 建立黑色背景畫布
    surface = gizeh.Surface(width=WIDTH, height=HEIGHT, bg_color=(0, 0, 0))

    # ---------------------------------------------------------
    # 超長雷射：定點旋轉
    # ---------------------------------------------------------
    # 讓雷射隨時間旋轉，角速度可自行調整（例如 1.2 * t）
    laser_angle = 1.2 * t  
    
    # 使用 gizeh.rectangle 建立雷射，並將旋轉中心設定在它的 xy 座標上
    laser = gizeh.rectangle(
        lx=LASER_LENGTH, 
        ly=LASER_WIDTH, 
        xy=(CENTER_X, CENTER_Y), 
        fill=COLOR
    ).rotate(laser_angle, center=(CENTER_X, CENTER_Y))
    
    laser.draw(surface)

    # ---------------------------------------------------------
    # 擷取當前幀
    frames.append(surface.get_npimage())

# 輸出影片檔
imageio.mimwrite("output.mp4", frames, fps=FPS, macro_block_size=None,
                 output_params=["-preset", "ultrafast", "-crf", "28"])
print("Done! output.mp4 created.")