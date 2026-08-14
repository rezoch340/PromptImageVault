from __future__ import annotations

import os as operating_system
import threading
from pathlib import Path

from PIL import Image, ImageOps


class ThumbnailCache:
    def __init__(self, directory: Path, size: int = 400):
        self.directory = directory / "thumbnails"
        self.directory.mkdir(parents=True, exist_ok=True)
        self.size = size
        self._locks: dict[str, threading.Lock] = {}
        self._guard = threading.Lock()

    def _lock_for(self, image_identifier: str) -> threading.Lock:
        with self._guard:
            return self._locks.setdefault(image_identifier, threading.Lock())

    def get_or_create(self, image_identifier: str, source: Path) -> Path:
        destination = self.directory / f"{image_identifier}.webp"
        with self._lock_for(image_identifier):
            if destination.exists() and destination.stat().st_mtime_ns >= source.stat().st_mtime_ns:
                return destination
            temporary = destination.with_suffix(".tmp.webp")
            with Image.open(source) as image:
                image = ImageOps.exif_transpose(image)
                image.thumbnail((self.size, self.size), Image.Resampling.LANCZOS)
                if image.mode not in {"RGB", "RGBA"}:
                    image = image.convert("RGB")
                image.save(temporary, "WEBP", quality=82, method=4)
            operating_system.replace(temporary, destination)
        return destination
