# VibeTouHou 1v1 Metagame Rules

VibeTouHou is not just a game; it is a collaborative competitive sport played between a human and an AI (or two humans) through the art of "Vibecoding". 

The game operates as a back-and-forth escalation of creating and surviving bullet patterns.

## The Loop

1. **The Challenge:** Player A designs and codes a new bullet hell pattern in Python and places it into the `game/patterns` directory.
2. **The Test:** Player B must now play that specific pattern using the test harness (`python test_pattern.py patterns/the_pattern.py`).
3. **The Clear:**
   - If Player B gets hit *even once*, they fail the test and must try again.
   - If Player B survives the full 10 seconds with **0 hits** (A Flawless Clear), the pattern is considered conquered!
   - Upon a flawless clear, the pattern is automatically copied into the `tested_patterns` directory, adding it to the game's permanent global pool.
4. **The Turnover:** Because Player B conquered the challenge, it is now Player B's turn to act as the architect! Player B codes a new pattern... and Player A is forced to flawless it.
5. **The Escalation:** The difficulty, speed, and geometric complexity should naturally escalate round after round.

## Main Game

At any point, a player can run the main arcade gauntlet by executing `python game.py`. This drops the player in the arena to face 6 randomly selected patterns from the vast, ever-growing pool of previously conquered (`tested_patterns/`) challenges. In the Arcade Mode, a slight amount of damage is allowed (3 HP total) to account for consecutive pattern fatigue.
