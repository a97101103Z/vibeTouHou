from pathlib import Path

SANDBOX_SUBDIR = "sandbox"


def test_stage_assets_for_runtime_makes_assets_available_in_cwd(tmp_path):
    import renderer

    slot_path = tmp_path / "red" / "1"
    assets_dir = slot_path / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    (assets_dir / "7.png").write_bytes(b"png")
    (assets_dir / "bg.webp").write_bytes(b"webp")

    sandbox = slot_path / SANDBOX_SUBDIR
    sandbox.mkdir(parents=True, exist_ok=True)
    # Simulate the Docker bind-mount: slot_path/assets → sandbox/assets
    (sandbox / "assets").symlink_to(assets_dir, target_is_directory=True)

    renderer._stage_assets_for_runtime(slot_path, sandbox)

    runtime_img = sandbox / "7.png"
    runtime_bg = sandbox / "bg.webp"
    assert runtime_img.exists()
    assert runtime_bg.exists()
    assert runtime_img.read_bytes() == b"png"
    assert runtime_bg.read_bytes() == b"webp"


def test_stage_assets_for_runtime_cleans_deleted_assets(tmp_path):
    import renderer

    slot_path = tmp_path / "blue" / "2"
    assets_dir = slot_path / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    img = assets_dir / "only.png"
    img.write_bytes(b"one")

    sandbox = slot_path / SANDBOX_SUBDIR
    sandbox.mkdir(parents=True, exist_ok=True)
    # Simulate the Docker bind-mount: slot_path/assets → sandbox/assets
    (sandbox / "assets").symlink_to(assets_dir, target_is_directory=True)

    renderer._stage_assets_for_runtime(slot_path, sandbox)
    assert (sandbox / "only.png").exists()

    img.unlink()
    renderer._stage_assets_for_runtime(slot_path, sandbox)
    assert not (sandbox / "only.png").exists()
