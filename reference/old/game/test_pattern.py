import sys
import os
import importlib.util
import shutil
from engine import GameEngine

def load_module_from_path(path):
    module_name = os.path.splitext(os.path.basename(path))[0]
    spec = importlib.util.spec_from_file_location(module_name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module, module_name

def main():
    if len(sys.argv) < 2:
        print("Usage: python test_pattern.py patterns/some_pattern.py")
        sys.exit(1)
        
    pattern_path = sys.argv[1]
    
    if not os.path.exists(pattern_path):
        print(f"Error: Could not find file {pattern_path}")
        sys.exit(1)
        
    try:
        module, module_name = load_module_from_path(pattern_path)
        pattern_instance = module.Pattern()
    except Exception as e:
        print(f"Error loading pattern '{pattern_path}'. Make sure it has a 'Pattern' class.")
        print(f"Exception: {e}")
        sys.exit(1)
        
    print(f"Testing pattern: {module_name}")
    print("Objective: Survive for 10 seconds!")
    print("Note: Player hitbox is slightly larger in testing mode.")
    
    engine = GameEngine(is_testing=True)
    hits_taken = engine.run_pattern(pattern_instance, pattern_name=module_name)
    
    if hits_taken == 0:
        print(f"SUCCESS! Flawlessed {module_name}.")
        
        # Move file to tested_patterns
        source_dir = os.path.dirname(os.path.abspath(pattern_path))
        target_dir = os.path.join(os.path.dirname(source_dir), "tested_patterns")
        
        target_path = os.path.join(target_dir, os.path.basename(pattern_path))
        
        # Don't fail if target_dir somehow missing
        os.makedirs(target_dir, exist_ok=True)
        
        shutil.copy2(pattern_path, target_path)
        print(f"Copied securely to {target_path}")
        
    elif hits_taken is None:
        print("Test cancelled by user.")
    else:
        print(f"GAME OVER! You were hit {hits_taken} times. Practice more and try again.")

if __name__ == "__main__":
    main()
