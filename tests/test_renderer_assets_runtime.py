from pathlib import Path


def test_stage_assets_for_runtime_makes_assets_available_in_cwd(tmp_path):
    import renderer

    slot_path = tmp_path / "red" / "1"
    assets_dir = slot_path / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    (assets_dir / "7.png").write_bytes(b"png")
    (assets_dir / "bg.webp").write_bytes(b"webp")

    renderer._stage_assets_for_runtime(slot_path)

    runtime_img = slot_path / "7.png"
    runtime_bg = slot_path / "bg.webp"
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

    renderer._stage_assets_for_runtime(slot_path)
    assert (slot_path / "only.png").exists()

    img.unlink()
    renderer._stage_assets_for_runtime(slot_path)
    assert not (slot_path / "only.png").exists()
