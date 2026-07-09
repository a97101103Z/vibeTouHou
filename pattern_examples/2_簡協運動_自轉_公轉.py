import math
import imageio
import numpy as np
import gizeh

# ─────────────────────────────────────────────────────────────
# vibeTouHou — 彈幕腳本
# ─────────────────────────────────────────────────────────────
# 畫布設定（保持不變）
WIDTH, HEIGHT = 800, 600
FPS = 30
DURATION = 10  # 影片長度（秒）

# 方形基本設定
SQUARE_SIZE = 50       # 方形邊長
COLOR = (1, 1, 1)      # 白色

# 渲染循環
frames = []
for frame_num in range(FPS * DURATION):
    t = frame_num / FPS  # 當前時間（秒，從 0 到 10）

    # 建立黑色背景畫布
    surface = gizeh.Surface(width=WIDTH, height=HEIGHT, bg_color=(0, 0, 0))

    # ---------------------------------------------------------
    # 1. 左邊的方形：進行上下左右的簡諧運動 (Simple Harmonic Motion)
    # ---------------------------------------------------------
    left_center_x = 200 + 80 * math.sin(2 * math.pi * 0.5 * t)  # 週期為 2 秒
    left_center_y = 300 + 120 * math.cos(2 * math.pi * 0.3 * t) # 週期約為 3.3 秒
    
    left_square = gizeh.rectangle(
        lx=SQUARE_SIZE, ly=SQUARE_SIZE, 
        xy=(left_center_x, left_center_y), 
        fill=COLOR
    )
    left_square.draw(surface)

    # ---------------------------------------------------------
    # 2. 中間的方形：定點自轉
    # ---------------------------------------------------------
    mid_center_x = WIDTH / 2
    mid_center_y = HEIGHT / 2
    mid_angle = 1.5 * t  # 旋轉角速度
    
    # 修正：先建立方形，再呼叫 .rotate 方法，並指定旋轉中心為它的位置
    mid_square = gizeh.rectangle(
        lx=SQUARE_SIZE, ly=SQUARE_SIZE, 
        xy=(mid_center_x, mid_center_y), 
        fill=COLOR
    ).rotate(mid_angle, center=(mid_center_x, mid_center_y))
    
    mid_square.draw(surface)

    # ---------------------------------------------------------
    # 3. 右邊的方形：一邊自轉，一邊繞著畫面中心公轉
    # ---------------------------------------------------------
    orbit_radius = 200
    orbit_angle = 1.0 * t  # 公轉角速度
    
    right_center_x = (WIDTH / 2) + orbit_radius * math.cos(orbit_angle)
    right_center_y = (HEIGHT / 2) + orbit_radius * math.sin(orbit_angle)
    
    right_self_angle = 3.0 * t  # 自轉速度
    
    # 修正：同樣使用 .rotate 並以當前的公轉座標作為自轉中心
    right_square = gizeh.rectangle(
        lx=SQUARE_SIZE, ly=SQUARE_SIZE, 
        xy=(right_center_x, right_center_y), 
        fill=COLOR
    ).rotate(right_self_angle, center=(right_center_x, right_center_y))
    
    right_square.draw(surface)

    # ---------------------------------------------------------
    # 擷取當前幀
    frames.append(surface.get_npimage())

# 輸出影片檔（請勿更改檔名）
imageio.mimwrite("output.mp4", frames, fps=FPS, macro_block_size=None,
                 output_params=["-preset", "ultrafast", "-crf", "28"])
print("Done! output.mp4 created.")