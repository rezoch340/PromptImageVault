from __future__ import annotations

import os as operating_system
from dataclasses import dataclass
from pathlib import Path

import yaml


@dataclass(frozen=True)
class ServerConfig:
    host: str = "127.0.0.1"
    port: int = 8000


@dataclass(frozen=True)
class LibraryConfig:
    name: str
    path: Path
    recursive: bool = True


@dataclass(frozen=True)
class ScannerConfig:
    watch: bool = True
    interval: int = 60


@dataclass(frozen=True)
class ThumbnailConfig:
    size: int = 400
    format: str = "webp"


@dataclass(frozen=True)
class CacheConfig:
    directory: Path = Path("/cache")


@dataclass(frozen=True)
class ApplicationConfig:
    server: ServerConfig
    libraries: tuple[LibraryConfig, ...]
    scanner: ScannerConfig
    thumbnail: ThumbnailConfig
    cache: CacheConfig


def load_config(path: str | Path | None = None) -> ApplicationConfig:
    config_path = Path(
        path or operating_system.getenv("PROMPT_IMAGE_VAULT_CONFIG", "config.yaml")
    )
    raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}

    server = ServerConfig(**raw.get("server", {}))
    scanner = ScannerConfig(**raw.get("scanner", {}))
    thumbnail = ThumbnailConfig(**raw.get("thumbnail", {}))
    cache = CacheConfig(directory=Path(raw.get("cache", {}).get("directory", "/cache")))

    libraries = tuple(
        LibraryConfig(
            name=item["name"],
            path=Path(item["path"]).expanduser().resolve(),
            recursive=item.get("recursive", True),
        )
        for item in raw.get("libraries", [])
    )
    if not libraries:
        raise ValueError("config.yaml must define at least one library")
    if len({library.name for library in libraries}) != len(libraries):
        raise ValueError("library names must be unique")
    if scanner.interval < 5:
        raise ValueError("scanner.interval must be at least 5 seconds")
    if thumbnail.size < 64:
        raise ValueError("thumbnail.size must be at least 64 pixels")
    if thumbnail.format.lower() != "webp":
        raise ValueError("thumbnail.format currently supports only webp")

    cache.directory.mkdir(parents=True, exist_ok=True)
    return ApplicationConfig(server, libraries, scanner, thumbnail, cache)
