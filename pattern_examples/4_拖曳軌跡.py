import math
import imageio
import numpy as np
import gizeh

# ─────────────────────────────────────────────────────────────
# vibeTouHou — JSAB Milky Ways 風格彈幕腳本
# ─────────────────────────────────────────────────────────────
# 畫布設定
WIDTH, HEIGHT = 800, 600
FPS = 30
DURATION = 10  # 影片長度（秒）

# 方形基本設定
SQUARE_SIZE = 40       
COLOR = (0, 0.9, 1)    # 經典的 JSAB 亮青色 / 核心色

# 拖尾衰減率 (0.0 ~ 1.0)
# 數值越大，尾巴越長。0.85 左右會有非常漂亮的流星感
TAIL_DECAY = 0.85

# 初始化一個全黑的 NumPy 陣列，用來儲存上一幀的殘影
accumulated_frame = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)

frames = []
for frame_num in range(FPS * DURATION):
    t = frame_num / FPS  # 當前時間

    # 1. 建立當前幀的畫布（背景設為全黑）
    surface = gizeh.Surface(width=WIDTH, height=HEIGHT, bg_color=(0, 0, 0))

    # 2. 計算主方形（核心）的位置與運動
    # Milky Ways 風格：上下大範圍擺動，並緩慢地在螢幕中橫移或繞圈
    # 這裡我們用複雜的三角函數讓它動得更像電音節奏
    core_x = 400 + 250 * math.sin(2 * math.pi * 0.2 * t)
    core_y = 300 + 180 * math.sin(2 * math.pi * 0.5 * t) + 50 * math.cos(2 * math.pi * 1.1 * t)
    core_angle = 3.0 * t  # 自轉

    # 3. 階梯式生成：在主方形的「左邊一點點間隔」創造一系列子方形
    # 我們讓子方形的數量隨著時間或節奏產生動態變化
    num_squares = 6 
    spacing = 50  # 每個方形之間的間隔像素

    for i in range(num_squares):
        # i = 0 是主方形，i > 0 是往左延伸的子方形
        # 這裡我們加上一點點 sine 波的延遲，讓延伸的方形看起來像蛇一樣扭動
        offset_x = -i * spacing
        offset_y = 30 * math.sin(2 * math.pi * 0.4 * t - i * 0.5) 
        
        sq_x = core_x + offset_x
        sq_y = core_y + offset_y
        
        # 讓後面的方形稍微小一點，更有層次感
        current_size = SQUARE_SIZE * (1 - (i * 0.12))
        
        # 只有大小大於 0 才可以畫
        if current_size > 0:
            # 讓子方形的旋轉有一點時間差 (Delay)
            sq_angle = core_angle - (i * 0.2)
            
            # 繪製方形
            square = gizeh.rectangle(
                lx=current_size, ly=current_size, 
                xy=(sq_x, sq_y), 
                fill=COLOR
            ).rotate(sq_angle, center=(sq_x, sq_y))
            
            square.draw(surface)

    # 4. 關鍵核心：實現「每幀繼承自上一幀，但變暗一點」的流星尾巴
    current_np = surface.get_npimage()  # 取得當前畫好的方形陣列
    
    if frame_num == 0:
        # 第一幀，直接初始化
        accumulated_frame = current_np
    else:
        # 將上一幀的畫面乘以衰減率（變暗），並與當前幀進行「最大值混合 (Maximum Blending)」
        # 這樣可以確保亮的地方（主體和尾巴）完美融合，不會越疊越白
        tail_frame = (accumulated_frame * TAIL_DECAY).astype(np.uint8)
        accumulated_frame = np.maximum(current_np, tail_frame)

    # 將最終融合了殘影的畫面存入影片幀中
    frames.append(accumulated_frame)

# 輸出影片檔
imageio.mimwrite("output.mp4", frames, fps=FPS, macro_block_size=None,
                 output_params=["-preset", "ultrafast", "-crf", "28"])
print("Done! Milky Ways style output.mp4 created.")