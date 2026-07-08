import math
import imageio
import numpy as np
import gizeh

# ─────────────────────────────────────────────────────────────
# vibeTouHou — 靜態幾何彈幕腳本
# ─────────────────────────────────────────────────────────────

# === 畫布與影片基本設定 ===
WIDTH, HEIGHT = 800, 600      # 畫布寬度與高度 (像素)
FPS = 30                      # 每秒幀數
DURATION = 10                 # 影片長度 (秒)

# === 圖形超參數設定 (可在這裡自由調整) ===
BG_COLOR = (0, 0, 0)          # 背景顏色 (黑色)

# 1. 圓形設定
CIRCLE_RADIUS = 80            # 圓形半徑
CIRCLE_POS = (200, 300)       # 圓形中心座標 (X, Y)
CIRCLE_COLOR = (1, 0.3, 0.3)  # 圓形顏色 (粉紅/淡紅)

# 2. 方形設定
SQUARE_SIZE = 140             # 方形邊長
SQUARE_POS = (400, 300)       # 方形中心座標 (X, Y)
SQUARE_COLOR = (0.3, 1, 0.3)  # 方形顏色 (粉綠)

# 3. N邊形設定
POLYGON_N = 5                 # N邊形的邊數 (例如：5 代表五邊形)
POLYGON_RADIUS = 85           # N邊形的外接圓半徑 (決定大小)
POLYGON_POS = (600, 300)      # N邊形中心座標 (X, Y)
POLYGON_COLOR = (0.3, 0.3, 1) # N邊形顏色 (粉藍)


# === 影片渲染循環 ===
frames = []

for frame_num in range(FPS * DURATION):
    # 建立該幀的靜態畫布背景
    surface = gizeh.Surface(width=WIDTH, height=HEIGHT, bg_color=BG_COLOR)

    # ---------------------------------------------------------
    # 繪製圖形 1：圓形
    # ---------------------------------------------------------
    circle = gizeh.circle(
        r=CIRCLE_RADIUS, 
        xy=CIRCLE_POS, 
        fill=CIRCLE_COLOR
    )
    circle.draw(surface)

    # ---------------------------------------------------------
    # 繪製圖形 2：方形 (利用 gizeh.rectangle)
    # ---------------------------------------------------------
    square = gizeh.rectangle(
        lx=SQUARE_SIZE, 
        ly=SQUARE_SIZE, 
        xy=SQUARE_POS, 
        fill=SQUARE_COLOR
    )
    square.draw(surface)

    # ---------------------------------------------------------
    # 繪製圖形 3：N 邊形
    # 透過數學公式計算出 N 個頂點的相對座標，並連成一個多邊形
    # ---------------------------------------------------------
    poly_points = []
    for i in range(POLYGON_N):
        # 計算每個頂點的角度
        angle = (2 * math.pi / POLYGON_N) * i
        # 計算頂點相對於中心點的 X, Y 座標
        px = POLYGON_POS[0] + POLYGON_RADIUS * math.cos(angle)
        py = POLYGON_POS[1] + POLYGON_RADIUS * math.sin(angle)
        poly_points.append((px, py))
    
    # 建立多邊形物件並繪製
    polygon = gizeh.polyline(
        points=poly_points, 
        close_path=True, 
        fill=POLYGON_COLOR
    )
    polygon.draw(surface)

    # ---------------------------------------------------------
    # 擷取當前幀畫面並儲存
    # ---------------------------------------------------------
    frames.append(surface.get_npimage())

# === 輸出影片檔案 ===
# 請勿更動下方的檔名 'output.mp4'，以免伺服器評分失敗
imageio.mimwrite("output.mp4", frames, fps=FPS, macro_block_size=None,
                 output_params=["-preset", "ultrafast", "-crf", "28"])
print("Done! output.mp4 created.")