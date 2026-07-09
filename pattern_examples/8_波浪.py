import math
import imageio
import numpy as np
import gizeh

# ─────────────────────────────────────────────────────────────
# vibeTouHou — 數學函數彈幕腳本 (波浪抖動流)
# ─────────────────────────────────────────────────────────────

# 畫布設定 (保持原樣)
WIDTH, HEIGHT = 800, 600
FPS = 30
DURATION = 10 # 影片長度 10 秒

# 彈幕參數設定
NUM_WAVES = 8          # 同時存在的波浪線條數
PELLETS_PER_WAVE = 60  # 每條波浪由多少個彈幕顆粒組成
PELLET_RADIUS = 4      # 彈幕顆粒的大小 (像素)
MOVE_SPEED = 120       # 彈幕向左移動的速度 (像素/秒)

# 渲染迴圈
frames = []

for frame_num in range(FPS * DURATION):
    t = frame_num / FPS # 當前時間 (秒)

    # 建立黑色背景畫布
    surface = gizeh.Surface(width=WIDTH, height=HEIGHT, bg_color=(0, 0, 0))

    # 繪製每一條波浪
    for w in range(NUM_WAVES):
        # 讓不同波浪在垂直方向(Y軸)有一個基礎的間距與交錯感
        y_base = HEIGHT / 2 + (w - NUM_WAVES / 2) * 25
        
        # 讓不同波浪的相位(抖動節奏)錯開
        wave_offset = w * 0.5 

        # 繪製單條波浪中的每個彈幕顆粒
        for i in range(PELLETS_PER_WAVE):
            # 1. 基礎水平分佈 (從右側不斷生成並排隊)
            # 使用 mod 運算讓彈幕超出左邊界後，能重新從右邊循環出現
            x_start = (i * 20 - t * MOVE_SPEED) % (WIDTH + 100) - 50
            x = x_start

            # 2. 計算波浪抖動 (Sin 函數)
            # 這裡的 math.sin 內部結合了空間位置(x)與時間(t)，形成前進的波浪
            # 乘以 50 是波浪的振幅(高度)，加上 t*8 則是讓它快速抖動
            wave_angle = (x * 0.015) + (t * 8) + wave_offset
            y = y_base + math.sin(wave_angle) * 50

            # 3. 動態顏色與亮度計算 (讓不同部分有不同顏色/亮度)
            # 利用當前顆粒的 wave_angle 或是 x 座標來產生漸變
            # 這裡使用 Sin 函數將數值映射到 0.2 ~ 1.0 之間，避免完全變黑
            r = 0.5 + 0.5 * math.sin(wave_angle)
            g = 0.5 + 0.5 * math.cos(wave_angle + 1.0)
            b = 0.5 + 0.5 * math.sin(wave_angle * 0.5 + 2.0)
            
            # 透過 X 座標來改變整體亮度 (例如越往左邊越暗，營造消逝感)
            brightness = max(0.2, min(1.0, x / WIDTH))
            color = (r * brightness, g * brightness, b * brightness)

            # 4. 畫出彈幕顆粒
            # 如果彈幕還在畫布可見範圍內，就繪製它
            if -10 < x < WIDTH + 10:
                circle = gizeh.circle(r=PELLET_RADIUS, xy=(x, y), fill=color)
                circle.draw(surface)

    # 擷取當前影格
    frames.append(surface.get_npimage())

# ─────────────────────────────────────────────────────────────
# 輸出影片 (請勿更改檔名 output.mp4)
# ─────────────────────────────────────────────────────────────
imageio.mimwrite("output.mp4", frames, fps=FPS, macro_block_size=None,
                 output_params=["-preset", "ultrafast", "-crf", "28"])
print("Done! output.mp4 created.")