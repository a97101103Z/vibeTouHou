import math 
import imageio 
import numpy as np 
import gizeh 

# ───────────────────────────────────────────────────────────── 
# vibeTouHou — 旋轉雷射與簡諧警告線腳本 
# ───────────────────────────────────────────────────────────── 
# 畫布設定 
WIDTH, HEIGHT = 800, 600 
FPS = 30 
DURATION = 10  # 影片長度（秒） 

# 雷射與警告線設定 
LASER_LENGTH = 2000    # 超長長度
LASER_WIDTH = 20       # 雷射的粗細 
WARNING_WIDTH = 6      # 警告線比較細
COLOR = (1, 0, 0)      # 主雷射顏色：紅色

# 旋轉中心設定（畫面正中心） 
CENTER_X = WIDTH / 2 
CENTER_Y = HEIGHT / 2 

# 渲染循環 
frames = [] 
for frame_num in range(FPS * DURATION): 
    t = frame_num / FPS  # 當前時間（秒） 

    # 建立黑色背景畫布 
    surface = gizeh.Surface(width=WIDTH, height=HEIGHT, bg_color=(0, 0, 0)) 

    # --------------------------------------------------------- 
    # 基礎旋轉角度與簡諧運動控制 
    # --------------------------------------------------------- 
    # 1. 基礎旋轉角度（隨時間線性增加）
    base_angle = 1.2 * t 
    
    # 2. 簡諧運動的角度偏移（例如：振幅 0.5 弧度，頻率每秒 3 弧度）
    # 這樣警告線就會在基礎角度左右「擺動」
    harmonic_offset = 0.5 * math.sin(3.0 * t)
    warning_angle = base_angle + harmonic_offset
    
    # 3. 主雷射亮度的簡諧運動 (修正點：使其在 0.0 ~ 0.9 之間平滑變動)
    # 振幅 0.45，基準值 0.45，這樣範圍會落在 0.45 ± 0.45 -> [0.0, 0.9]
    current_laser_alpha = 0.45 + 0.45 * math.sin(5.0 * t)
    
    # 4. 警告線亮度的簡諧運動 (維持原本 0.1 ~ 0.9 忽明忽暗)
    brightness_alpha = 0.5 + 0.4 * math.sin(5.0 * t)
    
    # 5. 傷害判定 (當主雷射亮度大於 0.502 時判定為有傷害，可供後續邏輯延伸使用)
    has_damage = current_laser_alpha > (128 / 255)

    # --------------------------------------------------------- 
    # 繪製：主雷射 (現在會平滑閃爍，最低會到 0 完全隱形) 
    # --------------------------------------------------------- 
    # 將 COLOR (1, 0, 0) 加上算出來的 current_laser_alpha，變成 RGBA
    laser_rgba = (COLOR[0], COLOR[1], COLOR[2], current_laser_alpha)
    
    laser = gizeh.rectangle( 
        lx=LASER_LENGTH,  
        ly=LASER_WIDTH,  
        xy=(CENTER_X, CENTER_Y),  
        fill=laser_rgba 
    ).rotate(warning_angle, center=(CENTER_X, CENTER_Y)) 
    
    # 直接畫出雷射即可，不需要 Group
    laser.draw(surface) 

    # --------------------------------------------------------- 
    # 繪製：簡諧警告線 (細細一條、高亮閃爍) 
    # --------------------------------------------------------- 
    # 白色 (1, 1, 1) 加上算出來的 brightness_alpha，變成 RGBA
    warning_rgba = (1, 1, 1, brightness_alpha)
    
    warning_line = gizeh.rectangle(
        lx=LASER_LENGTH,
        ly=WARNING_WIDTH,
        xy=(CENTER_X, CENTER_Y),
        fill=warning_rgba
    ).rotate(warning_angle, center=(CENTER_X, CENTER_Y))
    
    # 直接畫出警告線
    warning_line.draw(surface)

    # --------------------------------------------------------- 
    # 擷取當前幀 
    # --------------------------------------------------------- 
    frames.append(surface.get_npimage()) 

# 輸出影片檔 
imageio.mimwrite("output.mp4", frames, fps=FPS, macro_block_size=None, 
                 output_params=["-preset", "ultrafast", "-crf", "28"]) 
print("Done! output.mp4 created.")