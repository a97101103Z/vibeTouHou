import math
import random
import colorsys
from pattern_base import BasePattern
from entities import Bullet

class Pattern(BasePattern):
    def __init__(self):
        super().__init__()
        self.spawn_timer = -1.0 # 1 second warning
        self.pellet_speed = 120
        
    def start(self, engine):
        self.center_x = 400  # assuming WIDTH=800
        self.center_y = 300  # assuming HEIGHT=600
        
        # The coordinates for the anomaly bounce area
        self.bounce_x = random.uniform(150, 650)
        self.bounce_y = random.uniform(100, 400)

    def update(self, engine, dt):
        self.spawn_timer += dt
        
        # Spawn pellets very frequently (Every 0.04s = 25 per second)
        if self.spawn_timer > 0.04:
            self.spawn_timer = 0
            
            # Pick a random edge
            edge = random.randint(0, 3) # 0=top, 1=right, 2=bottom, 3=left
            if edge == 0:
                x = random.uniform(0, 800)
                y = -10
            elif edge == 1:
                x = 810
                y = random.uniform(0, 600)
            elif edge == 2:
                x = random.uniform(0, 800)
                y = 610
            else:
                x = -10
                y = random.uniform(0, 600)
                
            # Initial trajectory roughly towards center
            dx = self.center_x - x
            dy = self.center_y - y
            dist = math.hypot(dx, dy)
            if dist > 0:
                vx = (dx / dist) * self.pellet_speed
                vy = (dy / dist) * self.pellet_speed
            else:
                vx, vy = self.pellet_speed, 0
                
            b = Bullet(x, y, vx, vy, radius=4)
            # Give it a unique hue property to loop
            b.hue = random.random()
            b.is_homing_pellet = True
            b.has_reversed = False
            
            engine.bullets.append(b)
            
        # Update custom bullet properties
        for b in engine.bullets:
            if getattr(b, 'is_homing_pellet', False):
                # 1. Update Colors
                b.hue += dt * 0.5 # shift hues over time
                if b.hue > 1.0:
                    b.hue -= 1.0
                r, g, blue = colorsys.hsv_to_rgb(b.hue, 1.0, 1.0)
                b.color = (int(r*255), int(g*255), int(blue*255))
                
                # 2. Reversal Logic
                bullet_dist_to_bounce = math.hypot(b.x - self.bounce_x, b.y - self.bounce_y)
                if bullet_dist_to_bounce < 50 and not getattr(b, 'has_reversed', False):
                    b.vx *= -1
                    b.vy *= -1
                    b.has_reversed = True
                
                # 3. Homing Logic
                # Target player
                pdx = engine.player.x - b.x
                pdy = engine.player.y - b.y
                pdist = math.hypot(pdx, pdy)
                
                if pdist > 0:
                    tdx = (pdx / pdist) * self.pellet_speed
                    tdy = (pdy / pdist) * self.pellet_speed
                    
                    # Soft steering logic
                    steer_factor = 1.2 * dt # Turn rate
                    new_vx = b.vx + (tdx - b.vx) * steer_factor
                    new_vy = b.vy + (tdy - b.vy) * steer_factor
                    
                    # Re-normalize vector to maintain constant pellet speed
                    ndist = math.hypot(new_vx, new_vy)
                    if ndist > 0:
                        b.vx = (new_vx / ndist) * self.pellet_speed
                        b.vy = (new_vy / ndist) * self.pellet_speed
