import math
import imageio
import numpy as np
import gizeh

# ─────────────────────────────────────────────────────────────
# vibeTouHou — 網格漫步腳本
# ─────────────────────────────────────────────────────────────
# 畫布設定（保持不變）
WIDTH, HEIGHT = 800, 600
FPS = 30
DURATION = 10  # 影片長度（秒）

# 小方形與網格設定
SQUARE_SIZE = 15      # 小方形邊長
GRID_SPACING = 180     # 網格點之間的間隔（每個小方形的距離）
COLOR = (1, 1, 1)     # 白色

# 渲染循環
frames = []
for frame_num in range(FPS * DURATION):
    t = frame_num / FPS  # 當前時間（秒）

    # 建立黑色背景畫布
    surface = gizeh.Surface(width=WIDTH, height=HEIGHT, bg_color=(0, 0, 0))

    # ---------------------------------------------------------
    # 1. 模擬二維平面的慢速隨機漫步 (相機位置)
    # ---------------------------------------------------------
    # 使用不同頻率的正弦波組合，來模擬類似 Perlin Noise 的緩慢隨機曲線
    cam_x = 300 * math.sin(0.4 * t) + 150 * math.cos(0.9 * t)
    cam_y = 250 * math.cos(0.3 * t) + 120 * math.sin(0.7 * t)

    # 畫面中心點
    screen_center_x = WIDTH / 2
    screen_center_y = HEIGHT / 2

    # ---------------------------------------------------------
    # 2. 動態計算當前畫面中應該渲染的網格範圍
    # ---------------------------------------------------------
    # 計算相機視野的邊界（相對於世界座標系統）
    left_bound = cam_x - screen_center_x
    right_bound = cam_x + screen_center_x
    top_bound = cam_y - screen_center_y
    bottom_bound = cam_y + screen_center_y

    # 找出邊界內，第一個與最後一個網格點的索引（Index）
    start_i = int(math.floor(left_bound / GRID_SPACING)) - 1
    end_i = int(math.ceil(right_bound / GRID_SPACING)) + 1
    start_j = int(math.floor(top_bound / GRID_SPACING)) - 1
    end_j = int(math.ceil(bottom_bound / GRID_SPACING)) + 1

    # ---------------------------------------------------------
    # 3. 繪製視野內的所有小方形
    # ---------------------------------------------------------
    for i in range(start_i, end_i):
        for j in range(start_j, end_j):
            # 世界座標系統中的位置
            world_x = i * GRID_SPACING
            world_y = j * GRID_SPACING

            # 轉換到畫布螢幕座標系統 (加上畫面中心做偏置)
            screen_x = world_x - cam_x + screen_center_x
            screen_y = world_y - cam_y + screen_center_y

            # 建立小方形並繪製
            square = gizeh.rectangle(
                lx=SQUARE_SIZE, ly=SQUARE_SIZE,
                xy=(screen_x, screen_y),
                fill=COLOR
            )
            square.draw(surface)

    # ---------------------------------------------------------
    # 擷取當前幀
    frames.append(surface.get_npimage())

# 輸出影片檔（請勿更改檔名）
imageio.mimwrite("output.mp4", frames, fps=FPS, macro_block_size=None,
                 output_params=["-preset", "ultrafast", "-crf", "28"])
print("Done! output.mp4 created.")