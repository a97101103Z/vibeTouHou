import os
import random
import sys
import importlib.util
from engine import GameEngine
from config import WINS_REQUIRED, MAX_HITS

def load_module_from_path(path):
    module_name = os.path.splitext(os.path.basename(path))[0]
    spec = importlib.util.spec_from_file_location(module_name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module, module_name

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    tested_dir = os.path.join(script_dir, "tested_patterns")
    
    if not os.path.exists(tested_dir):
        print("Play some patterns in test mode first. tested_patterns directory not found.")
        sys.exit(1)
        
    # Gather tested patterns
    pattern_files = []
    for f in os.listdir(tested_dir):
        if f.endswith(".py") and not f.startswith("__"):
            pattern_files.append(os.path.join(tested_dir, f))
            
    if not pattern_files:
        print("No tested patterns available. Run 'python test_pattern.py patterns/my_pattern.py' first.")
        sys.exit(1)
        
    # Load all patterns into memory
    loaded_patterns = []
    for pf in pattern_files:
        try:
            module, module_name = load_module_from_path(pf)
            loaded_patterns.append((module.Pattern, module_name))
        except Exception as e:
            print(f"Error loading tested pattern {pf}: {e}")
            
    if not loaded_patterns:
        print("Failed to load any tested patterns.")
        sys.exit(1)
        
    engine = GameEngine(is_testing=False)
    
    hp = MAX_HITS
    cleared = 0
    
    # We want to avoid repeats if possible
    # We can shuffle the list of patterns and pop from it. If we run out, reshuffle.
    pattern_queue = list(loaded_patterns)
    random.shuffle(pattern_queue)
    
    while cleared < WINS_REQUIRED and hp > 0:
        if not pattern_queue:
            pattern_queue = list(loaded_patterns)
            random.shuffle(pattern_queue)
            
        PatternClass, p_name = pattern_queue.pop(0)
        pattern_instance = PatternClass()
        
        print(f"Starting Pattern: {p_name}. HP: {hp}/{MAX_HITS}, Cleared: {cleared}/{WINS_REQUIRED}")
        
        hits_taken = engine.run_pattern(
            pattern_instance, 
            pattern_name=p_name, 
            hp_left=hp, 
            patterns_cleared=cleared
        )
        
        if hits_taken is None:
            print("Game closed.")
            sys.exit(0)
            
        hp -= hits_taken
        if hp > 0:
            cleared += 1
            if hits_taken == 0:
                print(f"Flawlessed! Sequence {cleared}/{WINS_REQUIRED}")
            else:
                print(f"Ouch! Took {hits_taken} hits. HP: {hp}/{MAX_HITS}. Sequence {cleared}/{WINS_REQUIRED}")
            
    if cleared >= WINS_REQUIRED:
        print("\n=== YOU WIN! ===")
        print(f"You survived {WINS_REQUIRED} patterns with {hp} HP remaining!")
    else:
        print("\n=== GAME OVER ===")
        print(f"You died after clearing {cleared} patterns.")
        
if __name__ == "__main__":
    main()
