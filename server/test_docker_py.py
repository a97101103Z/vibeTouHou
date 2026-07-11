import os
from pathlib import Path

import pytest


@pytest.mark.skipif(
    os.getenv("RUN_DOCKER_SANDBOX_TEST") != "1",
    reason="Docker sandbox smoke test is opt-in.",
)
def test_docker_sandbox_smoke(tmp_path):
    import docker

    client = docker.from_env()
    d = Path(tmp_path / "sandbox").resolve()

    d.mkdir(parents=True, exist_ok=True)
    (d / "script.py").write_text(
        """
import imageio
import numpy as np
with imageio.get_writer('output.mp4', fps=30) as w:
    for _ in range(5):
        w.append_data(np.zeros((600,800,3),dtype='uint8'))
""",
        encoding="utf-8",
    )

    container = client.containers.run(
        "vibetouhou-sandbox:latest",
        command=["python", "/work/script.py"],
        volumes={str(d): {"bind": "/work", "mode": "rw"}},
        working_dir="/work",
        user="1000",
        remove=True,
    )
    assert (d / "output.mp4").exists()
