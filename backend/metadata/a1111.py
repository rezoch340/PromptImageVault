from __future__ import annotations

import re
from typing import Any


KNOWN_FIELDS = {
    "Steps": "steps",
    "Sampler": "sampler",
    "Schedule type": "scheduler",
    "Scheduler": "scheduler",
    "CFG scale": "cfg",
    "Seed": "seed",
    "Size": "size",
    "Model": "model",
    "Model hash": "model_hash",
    "Clip skip": "clip_skip",
    "VAE": "vae",
    "Hires upscale": "hires_upscale",
    "Hires upscaler": "hires_upscaler",
    "Denoising strength": "denoising_strength",
}


def _coerce(name: str, value: str) -> Any:
    value = value.strip()
    if name in {"steps", "clip_skip"}:
        try:
            return int(value)
        except ValueError:
            return value
    if name in {"cfg", "hires_upscale", "denoising_strength"}:
        try:
            return float(value)
        except ValueError:
            return value
    return value


def parse_parameters(text: str) -> dict[str, Any]:
    text = text.strip()
    if not text:
        return {"source": "a1111", "raw": text}

    parameter_start = re.search(r"(?:^|\n)Steps:\s*", text)
    body = text[: parameter_start.start()].rstrip() if parameter_start else text
    parameter_line = text[parameter_start.start() :].strip() if parameter_start else ""

    negative_marker = re.search(r"(?:^|\n)Negative prompt:\s*", body)
    if negative_marker:
        prompt = body[: negative_marker.start()].strip()
        negative_prompt = body[negative_marker.end() :].strip()
    else:
        prompt = body.strip()
        negative_prompt = ""

    result: dict[str, Any] = {
        "source": "a1111",
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "extras": {},
        "raw": text,
    }

    field_pattern = re.compile(r"(?:^|,\s)([^,]+?):\s")
    matches = list(field_pattern.finditer(parameter_line))
    for index, match in enumerate(matches):
        label = match.group(1).strip()
        value_start = match.end()
        value_end = matches[index + 1].start() if index + 1 < len(matches) else len(parameter_line)
        value = parameter_line[value_start:value_end].strip().rstrip(",")
        key = KNOWN_FIELDS.get(label)
        if key:
            result[key] = _coerce(key, value)
        else:
            result["extras"][label] = value

    size = result.pop("size", None)
    if isinstance(size, str) and re.fullmatch(r"\d+\s*[xX]\s*\d+", size):
        width, height = re.split(r"[xX]", size)
        result["width"] = int(width.strip())
        result["height"] = int(height.strip())
    return result
