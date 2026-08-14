from __future__ import annotations

from pathlib import Path
from typing import Any

from PIL import Image

from .a1111 import parse_parameters
from .comfyui import parse_comfy


def extract_metadata(path: Path) -> tuple[dict[str, Any], int, int]:
    with Image.open(path) as image:
        width, height = image.size
        info = dict(image.info)

    parameters = info.get("parameters")
    if isinstance(parameters, str):
        metadata = parse_parameters(parameters)
    elif "prompt" in info:
        metadata = parse_comfy(info.get("prompt"), info.get("workflow"))
    else:
        metadata = {"source": "unknown", "prompt": "", "negative_prompt": "", "extras": {}}

    metadata.setdefault("width", width)
    metadata.setdefault("height", height)
    return metadata, width, height
