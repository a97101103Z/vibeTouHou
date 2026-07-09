import math
import imageio
import numpy as np
import gizeh
import random

# ─────────────────────────────────────────────────────────────
# vibeTouHou — Just Shapes & Beats "Milky Ways" Style
# ─────────────────────────────────────────────────────────────
# 畫布設定
WIDTH, HEIGHT = 800, 600
FPS = 30
DURATION = 10  # 影片長度（秒）

# 方形與軌跡設定
SQUARE_SIZE = 20       # 方形邊長
GAP = 10               # 方形之間的間隔距離
STEP = SQUARE_SIZE + GAP # 每次跳躍的總步長

# 建立一個存放上一幀畫面的「歷史緩衝區」 
# (使用 float32 以確保小數點衰減計算精準，不會有色塊)
frame_buffer = np.zeros((HEIGHT, WIDTH, 3), dtype=np.float32)

# 隨機生成幾條「流星」的初始參數
random.seed(42)  # 固定隨機種子，讓每次產生的軌跡一致
meteors = []
for _ in range(15):
    y_pos = random.randint(50, HEIGHT - 50)
    # 速度與方向 (向左或向右)
    speed = random.choice([150, 200, 250, 300]) * random.choice([1, -1]) 
    start_x = random.randint(0, WIDTH) if speed < 0 else random.randint(-WIDTH, 0)
    # 經典 JS&B 配色：青藍色 (Cyan) 與 亮粉色 (Pink)
    color = random.choice([(0.1, 0.8, 1.0), (1.0, 0.2, 0.6)]) 
    
    meteors.append({
        "y": y_pos, 
        "start_x": start_x, 
        "speed": speed, 
        "color": color
    })

# 渲染循環
frames = []
for frame_num in range(FPS * DURATION):
    t = frame_num / FPS  # 當前時間（秒）

    # 1. 建立「當前幀」的純黑畫布（只畫最新的方塊頭部）
    surface = gizeh.Surface(width=WIDTH, height=HEIGHT, bg_color=(0, 0, 0))

    # 2. 畫出所有流星的「頭部」
    for m in meteors:
        # 計算理論上的連續 X 座標
        continuous_x = m["start_x"] + m["speed"] * t
        
        # 【關鍵 1】離散化座標：利用整數除法將連續座標「網格化」
        # 這樣方塊就會是一格一格跳躍，留下間隔
        discrete_x = (continuous_x // STEP) * STEP

        # 簡單的循環效果：讓超出畫面的方塊從另一邊回來
        discrete_x = discrete_x % (WIDTH + 200) - 100

        square = gizeh.rectangle(
            lx=SQUARE_SIZE, ly=SQUARE_SIZE,
            xy=(discrete_x, m["y"]),
            fill=m["color"]
        )
        square.draw(surface)

    # 取得當前最新方塊的像素矩陣
    current_img = surface.get_npimage().astype(np.float32)

    # ---------------------------------------------------------
    # 【關鍵 2】殘影魔法：幀緩衝衰減 (Frame Buffer Decay)
    # ---------------------------------------------------------
    DECAY_RATE = 0.95  # 衰減率（數字越接近 1，尾巴越長；越接近 0 尾巴越短）
    
    # 將上一幀的畫面乘上衰減率（變暗），並與當前幀「取最大值」疊加
    # 用 np.maximum 是為了防止顏色數值相加超過 255 而產生奇怪的過曝顏色
    frame_buffer = np.maximum(frame_buffer * DECAY_RATE, current_img)

    # 轉換回 8-bit 色彩並存入影片幀中
    frames.append(frame_buffer.astype(np.uint8))

# 輸出影片檔
imageio.mimwrite("output.mp4", frames, fps=FPS, macro_block_size=None,
                 output_params=["-preset", "ultrafast", "-crf", "28"])
print("Done! output.mp4 created.")