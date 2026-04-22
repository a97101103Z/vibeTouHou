import math
import random
from pattern_base import BasePattern
from entities import Bullet

class Pattern(BasePattern):
    def __init__(self):
        super().__init__()
        # Wait 1 second before starting to shoot
        self.spawn_timer = -1.0
        self.angle = 0
        
    def start(self, engine):
        self.center_x = 400
        self.center_y = 300

    def update(self, engine, dt):
        self.spawn_timer += dt
        
        # Fire quickly
        if self.spawn_timer > 0.05:
            self.spawn_timer = 0
            
            # 3 arms for the spiral
            for i in range(3):
                offset = (i / 3.0) * math.pi * 2
                vx = math.cos(self.angle + offset) * 150
                vy = math.sin(self.angle + offset) * 150
                
                engine.bullets.append(
                    Bullet(self.center_x, self.center_y, vx, vy, radius=6, color=(255, 100, 200))
                )
                
            # Increase angle
            self.angle += 0.3
