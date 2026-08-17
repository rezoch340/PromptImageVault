from __future__ import annotations

import json
from pathlib import Path

import av
import pytest
from PIL import Image

from backend.metadata import extract_metadata
from backend.thumbnail import ThumbnailCache

COMFY_GRAPH = {
    "1": {
        "class_type": "CLIPTextEncode",
        "inputs": {"text": "a cat surfing a wave"},
    },
    "2": {
        "class_type": "CLIPTextEncode",
        "inputs": {"text": "blurry, low quality"},
    },
    "3": {
        "class_type": "UNETLoader",
        "inputs": {"unet_name": "smoothMixWan22I2VT2V_i2vLow.safetensors"},
    },
    "4": {
        "class_type": "KSampler",
        "inputs": {
            "positive": ["1", 0],
            "negative": ["2", 0],
            "seed": 594731366764946,
            "steps": 6,
            "cfg": 1.3,
            "sampler_name": "euler_ancestral",
            "scheduler": "simple",
        },
    },
}


def write_video(path: Path, tags: dict[str, str], width: int = 64, height: int = 48) -> Path:
    codec = "libvpx" if path.suffix == ".webm" else "libx264"
    with av.open(str(path), mode="w") as container:
        container.metadata.update(tags)
        stream = container.add_stream(codec, rate=8)
        stream.width, stream.height, stream.pix_fmt = width, height, "yuv420p"
        for index in range(4):
            frame = av.VideoFrame.from_image(
                Image.new("RGB", (width, height), (index * 40, 90, 160))
            )
            container.mux(stream.encode(frame))
        container.mux(stream.encode())
    return path


@pytest.mark.parametrize(
    ("name", "tags"),
    [
        # mp4 only keeps standard tags, so ComfyUI packs the graph into comment/description.
        ("clip.mp4", {"comment": json.dumps({"prompt": COMFY_GRAPH})}),
        ("clip.mp4", {"description": json.dumps(COMFY_GRAPH)}),
        # matroska keeps arbitrary tags, so prompt/workflow arrive as their own keys.
        ("clip.webm", {"prompt": json.dumps(COMFY_GRAPH)}),
    ],
    ids=["mp4-comment", "mp4-bare-graph", "webm-prompt-tag"],
)
def test_video_metadata_reads_comfy_graph(tmp_path: Path, name: str, tags: dict[str, str]):
    video = write_video(tmp_path / name, tags)

    metadata, width, height = extract_metadata(video)

    assert (width, height) == (64, 48)
    assert metadata["prompt"] == "a cat surfing a wave"
    assert metadata["negative_prompt"] == "blurry, low quality"
    assert metadata["seed"] == 594731366764946
    assert metadata["model"] == "smoothMixWan22I2VT2V_i2vLow.safetensors"


def test_video_without_metadata_still_indexes(tmp_path: Path):
    video = write_video(tmp_path / "plain.mp4", {})

    metadata, width, height = extract_metadata(video)

    assert (width, height) == (64, 48)
    assert metadata["prompt"] == ""


def test_unreadable_video_raises_value_error(tmp_path: Path):
    broken = tmp_path / "broken.mp4"
    broken.write_bytes(b"not a container")

    with pytest.raises(ValueError):
        extract_metadata(broken)


def test_thumbnail_uses_video_poster_frame(tmp_path: Path):
    video = write_video(tmp_path / "clip.mp4", {}, width=800, height=600)
    cache = ThumbnailCache(tmp_path / "cache", size=200)

    thumbnail_path = cache.get_or_create("identifier", video)

    with Image.open(thumbnail_path) as thumbnail:
        assert thumbnail.format == "WEBP"
        assert max(thumbnail.size) == 200
