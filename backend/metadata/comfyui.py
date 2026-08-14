from __future__ import annotations

import json
from typing import Any


def _json_object(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def _referenced_node(nodes: dict[str, Any], reference: Any) -> dict[str, Any] | None:
    if isinstance(reference, list) and reference:
        node = nodes.get(str(reference[0]))
        return node if isinstance(node, dict) else None
    return None


def _text_from_reference(
    nodes: dict[str, Any],
    reference: Any,
    polarity: str,
    visited: set[str] | None = None,
) -> str | None:
    if not isinstance(reference, list) or not reference:
        return None
    node_identifier = str(reference[0])
    visited = visited or set()
    if node_identifier in visited:
        return None
    visited.add(node_identifier)
    node = _referenced_node(nodes, reference)
    if not node:
        return None
    inputs = node.get("inputs", {})
    if not isinstance(inputs, dict):
        return None
    text = inputs.get("text")
    if isinstance(text, str):
        return text

    class_type = str(node.get("class_type", ""))
    output_index = reference[1] if len(reference) > 1 and isinstance(reference[1], int) else 0
    if class_type in {"InpaintModelConditioning", "InstructPixToPixConditioning"}:
        key = "negative" if output_index == 1 or polarity == "negative" else "positive"
        return _text_from_reference(nodes, inputs.get(key), polarity, visited)

    preferred = (polarity, "conditioning", "conditioning_1", "conditioning_2")
    for key in preferred:
        candidate = inputs.get(key)
        value = _text_from_reference(nodes, candidate, polarity, visited.copy())
        if value is not None:
            return value
    return None


def _value_from_reference(
    nodes: dict[str, Any],
    value: Any,
    candidate_keys: tuple[str, ...],
    visited: set[str] | None = None,
) -> Any:
    if not isinstance(value, list) or not value:
        return value
    node_identifier = str(value[0])
    visited = visited or set()
    if node_identifier in visited:
        return None
    visited.add(node_identifier)
    node = _referenced_node(nodes, value)
    if not node:
        return None
    inputs = node.get("inputs", {})
    if not isinstance(inputs, dict):
        return None
    for key in (*candidate_keys, "value"):
        if key in inputs:
            return _value_from_reference(nodes, inputs[key], candidate_keys, visited)
    scalar_values = [item for item in inputs.values() if not isinstance(item, (list, dict))]
    return scalar_values[0] if len(scalar_values) == 1 else None


def parse_comfy(prompt_value: Any, workflow_value: Any = None) -> dict[str, Any]:
    nodes = _json_object(prompt_value) or {}
    workflow = _json_object(workflow_value)
    result: dict[str, Any] = {
        "source": "comfyui",
        "prompt": "",
        "negative_prompt": "",
        "extras": {},
        "raw_prompt": nodes,
    }
    if workflow is not None:
        result["workflow"] = workflow

    sampler_node: dict[str, Any] | None = None
    checkpoint: str | None = None
    for node in nodes.values():
        if not isinstance(node, dict):
            continue
        class_type = str(node.get("class_type", ""))
        inputs = node.get("inputs", {})
        if not isinstance(inputs, dict):
            continue
        if class_type in {"KSampler", "KSamplerAdvanced"} and sampler_node is None:
            sampler_node = node
        if "Loader" in class_type:
            for key in ("ckpt_name", "unet_name", "model_name"):
                candidate = inputs.get(key)
                if isinstance(candidate, str):
                    checkpoint = candidate
                    break

    if sampler_node:
        inputs = sampler_node.get("inputs", {})
        result["prompt"] = _text_from_reference(nodes, inputs.get("positive"), "positive") or ""
        result["negative_prompt"] = (
            _text_from_reference(nodes, inputs.get("negative"), "negative") or ""
        )
        mappings = {
            "seed": ("seed", "noise_seed"),
            "steps": ("steps",),
            "cfg": ("cfg",),
            "sampler": ("sampler_name",),
            "scheduler": ("scheduler",),
        }
        for target, candidates in mappings.items():
            for candidate in candidates:
                if candidate in inputs:
                    result[target] = _value_from_reference(nodes, inputs[candidate], candidates)
                    break
    if checkpoint:
        result["model"] = checkpoint
    return result
