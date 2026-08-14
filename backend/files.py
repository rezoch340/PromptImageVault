from __future__ import annotations

from pathlib import Path


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
