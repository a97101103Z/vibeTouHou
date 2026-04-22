import docker
import os
from pathlib import Path

client = docker.from_env()
d = Path(r"c:\Users\white\Desktop\Project\vibeTouHou\data\red\1").resolve()

d.mkdir(parents=True, exist_ok=True)
(d / "script.py").write_text('''
import pygame, imageio, numpy as np
frames=[np.zeros((600,800,3),dtype='uint8')]*5
imageio.mimwrite('output.mp4',frames,fps=30)
''', encoding='utf-8')

try:
    print(f"Volume path: {str(d)}")
    container = client.containers.run(
        "vibetouhou-sandbox:latest",
        command=["python", "/work/script.py"],
        volumes={str(d): {"bind": "/work", "mode": "rw"}},
        working_dir="/work",
        user="1000",
        remove=True,
    )
    print("Success. Logs:", container.decode() if isinstance(container, bytes) else "none")
except Exception as e:
    print(f"Docker Error: {type(e).__name__} - {e}")
