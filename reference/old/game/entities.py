import pygame
import math
from config import *

class Player:
    def __init__(self, x, y, is_testing=False):
        self.x = x
        self.y = y
        self.is_testing = is_testing
        # Larger hitbox during testing for leeway
        self.radius = PLAYER_SIZE_TEST if is_testing else PLAYER_SIZE_NORMAL
        self.speed = PLAYER_SPEED
        self.color = COLOR_PLAYER_TEST if is_testing else COLOR_PLAYER
        self.invincible_timer = 0.0

    def update(self, keys, dt):
        if self.invincible_timer > 0:
            self.invincible_timer -= dt
            
        dx, dy = 0, 0
        if keys[pygame.K_LEFT] or keys[pygame.K_a]:
            dx -= 1
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            dx += 1
        if keys[pygame.K_UP] or keys[pygame.K_w]:
            dy -= 1
        if keys[pygame.K_DOWN] or keys[pygame.K_s]:
            dy += 1

        if dx != 0 and dy != 0:
            # Normalize diagonal movement
            length = math.hypot(dx, dy)
            dx /= length
            dy /= length

        # Focus mode
        current_speed = PLAYER_SPEED_FOCUS if (keys[pygame.K_LSHIFT] or keys[pygame.K_RSHIFT]) else self.speed
        
        self.x += dx * current_speed * dt
        self.y += dy * current_speed * dt

        # Clamp to screen
        self.x = max(self.radius, min(WIDTH - self.radius, self.x))
        self.y = max(self.radius, min(HEIGHT - self.radius, self.y))

    def draw(self, surface):
        if self.invincible_timer > 0 and int(self.invincible_timer * 10) % 2 == 0:
            return  # Blink effect while invincible
            
        rect = pygame.Rect(0, 0, self.radius * 2, self.radius * 2)
        rect.center = (self.x, self.y)
        pygame.draw.rect(surface, self.color, rect)


class Bullet:
    def __init__(self, x, y, vx, vy, radius=5, color=(255, 100, 100)):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.radius = radius
        self.color = color

    def update(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt

    def draw(self, surface):
        pygame.draw.circle(surface, self.color, (int(self.x), int(self.y)), self.radius)

    def is_offscreen(self):
        # A bit of padding so they fully leave the screen
        pad = 50
        return (self.x < -pad or self.x > WIDTH + pad or
                self.y < -pad or self.y > HEIGHT + pad)

    def collides_with(self, player):
        dx = self.x - player.x
        dy = self.y - player.y
        distance = math.hypot(dx, dy)
        return distance < (self.radius + player.radius)
