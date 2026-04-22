import math
import random
from pattern_base import BasePattern
from entities import Bullet

class Pattern(BasePattern):
    def __init__(self):
        super().__init__()
        # Wait 0.5 seconds before starting to shoot
        self.spawn_timer = -0.5
        
    def start(self, engine):
        pass

    def update(self, engine, dt):
        self.spawn_timer += dt
        
        # Rain from top to bottom
        if self.spawn_timer > 0.15:
            self.spawn_timer = 0
            
            # Spawn multiple bullets across the top
            for i in range(3):
                x = random.uniform(0, 800)
                y = 0
                
                vx = random.uniform(-20, 20)
                vy = random.uniform(100, 220)
                
                engine.bullets.append(
                    Bullet(x, y, vx, vy, radius=5, color=(100, 255, 100))
                )
