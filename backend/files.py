from __future__ import annotations

from pathlib import Path

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
# ponytail: only the containers browsers play natively; .mkv/.avi would need transcoding.
VIDEO_EXTENSIONS = {".mp4", ".webm"}
SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS


def resolve_library_file(root: Path, relative_path: str, allowed_extensions: set[str]) -> Path:
    resolved_root = root.resolve()
    candidate = (resolved_root / relative_path).resolve()
    if not candidate.is_relative_to(resolved_root):
        raise ValueError("Path escapes the configured library")
    if candidate.suffix.lower() not in allowed_extensions:
        raise ValueError("File type is not allowed")
    if not candidate.is_file():
        raise FileNotFoundError(candidate)
    return candidate
