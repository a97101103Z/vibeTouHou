# Sogean/VibeTouHou Pattern Architecture

## Pattern Lifecycle
Every bullet pattern is dynamically loaded as a Python file. 
When a pattern starts, it runs for **exactly 10 seconds**. 
The objective of the pattern is to override the `update` method and spawn instances of `Bullet` into the `engine.bullets` list.

## Writing a Pattern
To create a new pattern, create a file in `game/patterns/` (e.g., `game/patterns/my_pattern.py`).

Your file must contain a class named `Pattern` that dictates logic. It can inherit from `pattern_base.BasePattern`.

### Example
```python
import math
from entities import Bullet
from pattern_base import BasePattern

class Pattern(BasePattern):
    def __init__(self):
        super().__init__()
        self.spawn_timer = 0
        
    def update(self, engine, dt):
        self.spawn_timer += dt
        
        # Spawn a bullet every 0.1 seconds
        if self.spawn_timer > 0.1:
            self.spawn_timer = 0
            
            # Use engine.pattern_time to know how far into the 10-second pattern we are
            t = engine.pattern_time
            
            x = 400 + math.cos(t) * 100
            y = 100 + math.sin(t) * 100
            vx = 0
            vy = 200
            
            engine.bullets.append(Bullet(x, y, vx, vy, radius=5, color=(255, 100, 100)))
```
