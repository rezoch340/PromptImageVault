from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from pathlib import Path
from typing import Any

from PIL import UnidentifiedImageError

from .config import ApplicationConfig, LibraryConfig
from .database import Database
from .files import SUPPORTED_EXTENSIONS
from .metadata import extract_metadata

LOGGER = logging.getLogger(__name__)

__all__ = ["Scanner", "SUPPORTED_EXTENSIONS", "make_image_identifier"]


def make_image_identifier(library: str, relative_path: str) -> str:
    value = f"{library}:{relative_path}".encode("utf-8")
    return hashlib.blake2b(value, digest_size=16).hexdigest()


class Scanner:
    def __init__(self, config: ApplicationConfig, database: Database):
        self.config = config
        self.database = database
        self._lock = threading.Lock()
        self.is_scanning = False
        self.watching = False
        self.last_scan_time: float | None = None
        self.last_error: str | None = None

    def _files(self, library: LibraryConfig):
        if not library.path.exists():
            LOGGER.warning("Library does not exist: %s", library.path)
            return
        iterator = library.path.rglob("*") if library.recursive else library.path.glob("*")
        for path in iterator:
            if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
                yield path

    def scan(self) -> list[dict[str, Any]]:
        if not self._lock.acquire(blocking=False):
            return []
        self.is_scanning = True
        changes: list[dict[str, Any]] = []
        pending_records: list[dict[str, Any]] = []
        try:
            existing = self.database.existing_files()
            seen: set[tuple[str, str]] = set()
            scanned_libraries = {
                library.name for library in self.config.libraries if library.path.is_dir()
            }
            for library in self.config.libraries:
                for path in self._files(library) or ():
                    relative = path.relative_to(library.path).as_posix()
                    key = (library.name, relative)
                    seen.add(key)
                    try:
                        stat = path.stat()
                    except FileNotFoundError:
                        continue
                    previous = existing.get(key)
                    if (
                        previous
                        and previous["file_size"] == stat.st_size
                        and previous["modified_ns"] == stat.st_mtime_ns
                    ):
                        continue
                    try:
                        metadata, width, height = extract_metadata(path)
                    except (OSError, ValueError, UnidentifiedImageError) as error:
                        LOGGER.warning("Skipping unreadable image %s: %s", path, error)
                        continue

                    identifier = make_image_identifier(library.name, relative)
                    created_time = getattr(stat, "st_birthtime", stat.st_mtime)
                    record = {
                        "image_identifier": identifier,
                        "library": library.name,
                        "relative_path": relative,
                        "filename": path.name,
                        "extension": path.suffix.lower().lstrip("."),
                        "file_size": stat.st_size,
                        "width": width,
                        "height": height,
                        "modified_ns": stat.st_mtime_ns,
                        "created_time": created_time,
                        "indexed_time": time.time(),
                        "prompt": metadata.get("prompt") or None,
                        "negative_prompt": metadata.get("negative_prompt") or None,
                        "seed": str(metadata["seed"]) if metadata.get("seed") is not None else None,
                        "model": metadata.get("model"),
                        "steps": (
                            metadata.get("steps")
                            if isinstance(metadata.get("steps"), int)
                            else None
                        ),
                        "sampler": metadata.get("sampler"),
                        "scheduler": metadata.get("scheduler"),
                        "cfg": (
                            metadata.get("cfg")
                            if isinstance(metadata.get("cfg"), (int, float))
                            else None
                        ),
                        "metadata_json": json.dumps(metadata, ensure_ascii=False),
                    }
                    pending_records.append(record)
                    changes.append(
                        {
                            "type": "image.updated" if previous else "image.created",
                            "image_identifier": identifier,
                        }
                    )

            self.database.upsert_many(pending_records)
            for identifier in self.database.delete_missing(seen, scanned_libraries):
                changes.append(
                    {"type": "image.deleted", "image_identifier": identifier}
                )
            self.last_scan_time = time.time()
            self.last_error = None
            return changes
        except Exception as error:
            self.last_error = str(error)
            LOGGER.exception("Image scan failed")
            return changes
        finally:
            self.is_scanning = False
            self._lock.release()
