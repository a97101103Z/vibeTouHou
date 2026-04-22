import random
import pygame
from pattern_base import BasePattern
from entities import Bullet

class Pattern(BasePattern):
    def __init__(self):
        super().__init__()
        self.spawn_timer = -0.5
        # 子彈速度加倍: 800 -> 1600
        self.speed = 1600
        self.warnings = [] 
        
    def start(self, engine):
        pass

    def update(self, engine, dt):
        self.spawn_timer += dt
        
        # 發射頻率變三倍長: 0.12 -> 0.36 秒
        if self.spawn_timer > 0.36:
            self.spawn_timer = 0
            
            # 每次發射數量再變兩倍 (6發)
            for _ in range(6):
                direction = random.randint(0, 3)
                
                if direction == 0:
                    tx = random.uniform(0, 800)
                    self.warnings.append({
                        'start': (tx, 0),
                        'end': (tx, 600),
                        'bullet': Bullet(tx, -10, 0, self.speed, radius=5, color=(100, 200, 255)),
                        'timer': 0.5
                    })
                elif direction == 1:
                    bx = random.uniform(0, 800)
                    self.warnings.append({
                        'start': (bx, 600),
                        'end': (bx, 0),
                        'bullet': Bullet(bx, 610, 0, -self.speed, radius=5, color=(255, 100, 100)),
                        'timer': 0.5
                    })
                elif direction == 2:
                    ly = random.uniform(0, 600)
                    self.warnings.append({
                        'start': (0, ly),
                        'end': (800, ly),
                        'bullet': Bullet(-10, ly, self.speed, 0, radius=5, color=(100, 255, 100)),
                        'timer': 0.5
                    })
                else:
                    ry = random.uniform(0, 600)
                    self.warnings.append({
                        'start': (800, ry),
                        'end': (0, ry),
                        'bullet': Bullet(810, ry, -self.speed, 0, radius=5, color=(255, 255, 100)),
                        'timer': 0.5
                    })
            
        # Update warnings and fire bullets when timers expire
        active_warnings = []
        for w in self.warnings:
            w['timer'] -= dt
            if w['timer'] <= 0:
                engine.bullets.append(w['bullet'])
            else:
                active_warnings.append(w)
        self.warnings = active_warnings

    def draw(self, surface):
        """Draw telegraph laser lines for incoming bullets."""
        for w in self.warnings:
            thickness = 3 if w['timer'] < 0.15 else 1
            color_intensity = min(255, int(255 - (w['timer'] * 200)))
            color = (color_intensity, color_intensity, color_intensity)
            pygame.draw.line(surface, color, w['start'], w['end'], thickness)
