import os
import shutil
import time
from pathlib import Path

def reset_environment():
    base_dir = Path(__file__).parent.resolve()
    data_dir = base_dir / "data"
    
    if not data_dir.exists():
        print("Data directory doesn't exist. Nothing to reset.")
        return

    # Create a unique timestamped archive folder
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    archive_dir = base_dir / f"data_archive_{timestamp}"
    
    try:
        # Move the entire data folder to the archive
        shutil.move(str(data_dir), str(archive_dir))
        print(f"✅ Successfully archived old data to: {archive_dir.name}")
        
        # Recreate an empty data directory so the server can start fresh immediately
        data_dir.mkdir(exist_ok=True)
        print("✅ Created fresh empty 'data/' directory.")
        
        print("\nAll user accounts have been unlocked!")
        print("All code, patterns, and scores have been wiped from the live server!")
        print("If the server is currently running, please restart it (Ctrl+C then uvicorn main:app again) just to be safe so it forgets any memory caches.")
        
    except Exception as e:
        print(f"❌ Error moving data: {e}")
        print("Hint: If there's a file lock error, stop your FastAPI server first, then try running this script again.")

if __name__ == "__main__":
    reset_environment()
