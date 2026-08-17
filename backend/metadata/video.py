from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import av

from .a1111 import parse_parameters
from .comfyui import parse_comfy

# ComfyUI (core SaveVideo) writes prompt/workflow as separate container tags; VideoHelperSuite
# packs them into one JSON blob under comment/description. Both shapes appear in the wild.
PAYLOAD_TAGS = ("comment", "description")


def _container_tags(container: av.container.InputContainer) -> dict[str, str]:
    # Matroska upper-cases every tag key, mp4 keeps them lower-case: normalise before lookup.
    tags: dict[str, str] = {}
    for stream in container.streams:
        tags.update({key.lower(): value for key, value in stream.metadata.items()})
    tags.update({key.lower(): value for key, value in container.metadata.items()})
    return tags


def _json_dict(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _is_node_graph(payload: dict[str, Any]) -> bool:
    return any(
        isinstance(node, dict) and "class_type" in node for node in payload.values()
    )


def _comfy_graphs(tags: dict[str, str]) -> tuple[Any, Any] | None:
    prompt = _json_dict(tags.get("prompt"))
    if prompt is not None:
        return prompt, _json_dict(tags.get("workflow"))
    for key in PAYLOAD_TAGS:
        payload = _json_dict(tags.get(key))
        if payload is None:
            continue
        if "prompt" in payload or "workflow" in payload:
            return payload.get("prompt"), payload.get("workflow")
        if _is_node_graph(payload):
            return payload, None
    return None


def extract_video_metadata(path: Path) -> tuple[dict[str, Any], int, int]:
    try:
        with av.open(str(path)) as container:
            stream = next((item for item in container.streams if item.type == "video"), None)
            if stream is None:
                raise ValueError(f"No video stream in {path}")
            width = stream.codec_context.width
            height = stream.codec_context.height
            tags = _container_tags(container)
    except av.FFmpegError as error:
        raise ValueError(f"Unreadable video {path}: {error}") from error

    graphs = _comfy_graphs(tags)
    parameters = tags.get("parameters")
    if graphs is not None:
        metadata = parse_comfy(*graphs)
    elif isinstance(parameters, str):
        metadata = parse_parameters(parameters)
    else:
        metadata = {"source": "unknown", "prompt": "", "negative_prompt": "", "extras": {}}

    return metadata, width, height
