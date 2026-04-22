import math
import random
from pattern_base import BasePattern
from entities import Bullet

class Pattern(BasePattern):
    def __init__(self):
        super().__init__()
        # 預留 0.5 秒鐘讓玩家準備
        self.spawn_timer = -0.5
        
    def start(self, engine):
        pass

    def update(self, engine, dt):
        self.spawn_timer += dt
        
        # 每 0.2 秒發射一次子彈
        if self.spawn_timer > 0.2:
            self.spawn_timer = 0
            
            # 從畫面頂端發射一排子彈
            for i in range(4):
                x = random.uniform(50, 750)
                y = 0
                
                speed = 250
                # 隨機決定一開始是往左下(120度)還是右下(60度)
                # 90度是直直往下
                if random.choice([True, False]):
                    angle = math.radians(120) # 左下
                else:
                    angle = math.radians(60)  # 右下
                    
                vx = math.cos(angle) * speed
                vy = math.sin(angle) * speed
                
                b = Bullet(x, y, vx, vy, radius=6, color=(255, 200, 50))
                # 我們可以利用 Python 的動態特性，在 pattern 裡幫 bullet 加上自定義屬性
                b.has_switched = False
                # 隨機決定在多少 Y 座標時切換方向 (例如畫面中間偏上到偏下的範圍)
                b.switch_y = random.uniform(150, 450)
                
                engine.bullets.append(b)
                
        # 處理我們特製的子彈轉向邏輯
        for b in engine.bullets:
            # 檢查這個子彈是不是我們帶有 has_switched 屬性的子彈
            if hasattr(b, 'has_switched') and not b.has_switched:
                # 當子彈落到指定的 Y 座標時，X 軸速度反轉 (向左下變成向右下，反之亦然)
                if b.y > b.switch_y:
                    b.vx *= -1
                    b.has_switched = True
