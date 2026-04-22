import pygame
import sys
from config import *
from entities import Player

class GameEngine:
    def __init__(self, is_testing=False):
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("VibeTouHou" + (" (TEST MODE)" if is_testing else ""))
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont("Arial", 24)
        
        self.is_testing = is_testing
        
        # Game state for current pattern
        self.player = None
        self.bullets = []
        self.pattern_time = 0.0
        self.flash_timer = 0.0
        self.hits_taken = 0
        
    def reset_pattern_state(self):
        """Reset the bullets before a new pattern, but preserve player if exists."""
        if self.player is None:
            self.player = Player(WIDTH / 2, HEIGHT - 100, is_testing=self.is_testing)
        self.bullets = []
        self.pattern_time = 0.0
        self.hits_taken = 0

    def run_pattern(self, pattern_instance, pattern_name="Unknown", hp_left=None, patterns_cleared=None):
        """
        Runs a pattern for PATTERN_DURATION.
        Returns the number of hits taken (0 means flawless).
        Returns None if user quit the game window.
        """
        self.reset_pattern_state()
        pattern_instance.start(self)
        
        while self.pattern_time < PATTERN_DURATION:
            dt = self.clock.tick(FPS) / 1000.0
            self.pattern_time += dt
            
            if self.flash_timer > 0:
                self.flash_timer -= dt
            
            # 1. Event Handling
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    pygame.quit()
                    return None
            
            keys = pygame.key.get_pressed()
            
            # 2. Logic Update
            self.player.update(keys, dt)
            pattern_instance.update(self, dt)
            
            for b in self.bullets:
                b.update(dt)
                
            # Filter off-screen bullets
            self.bullets = [b for b in self.bullets if not b.is_offscreen()]
            
            # 3. Collision Detection
            for b in self.bullets:
                if b.collides_with(self.player) and self.player.invincible_timer <= 0:
                    self.hits_taken += 1
                    self.player.invincible_timer = 1.0  # 1s invincibility
                    self.flash_timer = 0.1              # 100ms flash
                    if hp_left is not None:
                        hp_left -= 1
                    break
                    
            # 4. Rendering
            if self.flash_timer > 0:
                self.screen.fill((150, 50, 50))
            else:
                self.screen.fill(COLOR_BG)
                
            if hasattr(pattern_instance, 'draw'):
                pattern_instance.draw(self.screen)
            
            for b in self.bullets:
                b.draw(self.screen)
            self.player.draw(self.screen)
            
            # Render UI
            time_left = max(0, PATTERN_DURATION - self.pattern_time)
            ui_text = [
                f"Pattern: {pattern_name}",
                f"Time Left: {time_left:.1f}s"
            ]
            
            if hp_left is not None:
                ui_text.append(f"HP: {hp_left}/{MAX_HITS}")
            if patterns_cleared is not None:
                ui_text.append(f"Cleared: {patterns_cleared}/{WINS_REQUIRED}")
                
            for i, line in enumerate(ui_text):
                surf = self.font.render(line, True, COLOR_UI)
                self.screen.blit(surf, (10, 10 + i * 30))
                
            pygame.display.flip()
            
        return self.hits_taken
