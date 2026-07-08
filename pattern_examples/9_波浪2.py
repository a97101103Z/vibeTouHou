import math
import imageio
import numpy as np
import gizeh

# ─────────────────────────────────────────────────────────────
# vibeTouHou — 動態簡諧振幅的物理波浪 
# ─────────────────────────────────────────────────────────────
WIDTH, HEIGHT = 800, 600
FPS = 30
DURATION = 10  # 影片長度（秒）

WAVES_COUNT = 7    # 不同高度的波浪數量
X_STEP = 5         # 點的間隔（數字越小曲線越平滑）

frames = []
for frame_num in range(FPS * DURATION):
    t = frame_num / FPS  # 當前時間（秒）

    surface = gizeh.Surface(width=WIDTH, height=HEIGHT, bg_color=(0, 0, 0))

    for i in range(WAVES_COUNT):
        # 均勻分佈每條波浪的基礎 Y 高度 (從 Y=100 到 Y=500)
        base_y = 100 + i * (HEIGHT - 200) / (WAVES_COUNT - 1)
        
        # 波的基本物理參數
        max_amplitude = 25 + i * 5    # 最大振幅
        speed = 200 + i * 15          # 向左傳遞的速度
        wavelength = 150 + i * 20     # 波長 (S 型的寬度)
        k = 2 * math.pi / wavelength  # 波數
        
        # ---------------------------------------------------------
        # 【關鍵修改】讓振幅在 最大值 * 1 到 最大值 * -1 之間做簡諧運動
        # ---------------------------------------------------------
        # 設定這層波浪的簡諧角速度（數字越大，上下翻轉的速度越快）
        # 這裡利用 i 讓每一層的頻率都不同，例如: 1.5, 1.9, 2.3...
        shm_freq = 1.5 + i * 0.4
        
        # 計算當下這一幀的動態振幅
        current_amplitude = max_amplitude * math.cos(shm_freq * t)
        
        # 計算當前的「波前」位置
        wave_front = WIDTH - speed * t
        
        points = []
        for x in range(0, WIDTH + X_STEP, X_STEP):
            if x >= wave_front:
                # 結合動態振幅與原本的 S 型傳遞相位
                phase = k * (x - wave_front)
                y = base_y + current_amplitude * math.sin(phase)
                points.append((x, y))
                
        # 只有當波前已經進入畫面，且有點可以連線時才繪製
        if len(points) >= 2:
            # 漸層藍色調設定
            r = 0.0 + i * 0.02
            g = 0.4 + i * 0.08
            b = 0.8 + i * 0.03
            
            # 為了避免振幅變為 0 時線條消失，將線條粗細設定為固定的基礎值
            line = gizeh.polyline(
                points=points,
                stroke=(r, g, b),
                stroke_width=4 + i * 0.5  
            )
            line.draw(surface)

    # 擷取當前幀
    frames.append(surface.get_npimage())

# 輸出影片檔
imageio.mimwrite("output.mp4", frames, fps=FPS, macro_block_size=None,
                 output_params=["-preset", "ultrafast", "-crf", "28"])
print("Done! output.mp4 created.")