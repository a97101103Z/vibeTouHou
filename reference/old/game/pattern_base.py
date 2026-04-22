class BasePattern:
    def __init__(self):
        pass

    def start(self, engine):
        """Called when the pattern is loaded and starts playing."""
        pass

    def update(self, engine, dt):
        """
        Called every frame.
        Use engine.pattern_time to determine progress (0.0 to config.PATTERN_DURATION).
        Spawn bullets into engine.bullets.
        """
        pass

    def draw(self, surface):
        """
        Optional: Custom drawing logic for the pattern (telegraphs, lasers, etc.).
        """
        pass
