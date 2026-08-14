from pathlib import Path

from PIL import Image
from PIL.PngImagePlugin import PngInfo

from backend.config import (
    ApplicationConfig,
    CacheConfig,
    LibraryConfig,
    ScannerConfig,
    ServerConfig,
    ThumbnailConfig,
)
from backend.database import Database
from backend.scanner import Scanner


def make_config(library: Path, cache: Path) -> ApplicationConfig:
    return ApplicationConfig(
        server=ServerConfig(),
        libraries=(LibraryConfig("test", library),),
        scanner=ScannerConfig(watch=False, interval=60),
        thumbnail=ThumbnailConfig(),
        cache=CacheConfig(cache),
    )


def test_scanner_indexes_incrementally_and_detects_delete(tmp_path: Path):
    library = tmp_path / "library"
    library.mkdir()
    cache = tmp_path / "cache"
    image_path = library / "sample.png"
    info = PngInfo()
    info.add_text("parameters", "a red fox\nNegative prompt: blur\nSteps: 24, Seed: 77, Size: 64x48")
    Image.new("RGB", (64, 48), "#d95b3f").save(image_path, pnginfo=info)

    database = Database(cache / "index.db")
    scanner = Scanner(make_config(library, cache), database)

    changes = scanner.scan()
    assert [change["type"] for change in changes] == ["image.created"]
    assert database.count() == 1
    image = database.get_image(changes[0]["image_identifier"])
    assert image is not None
    assert image["prompt"] == "a red fox"
    assert image["width"] == 64
    assert scanner.scan() == []

    image_path.unlink()
    changes = scanner.scan()
    assert changes == [
        {
            "type": "image.deleted",
            "image_identifier": image["image_identifier"],
        }
    ]
    assert database.count() == 0


def test_scanner_preserves_index_when_library_is_temporarily_unavailable(tmp_path: Path):
    library = tmp_path / "library"
    library.mkdir()
    cache = tmp_path / "cache"
    Image.new("RGB", (20, 20), "black").save(library / "sample.jpg")
    database = Database(cache / "index.db")
    scanner = Scanner(make_config(library, cache), database)
    scanner.scan()

    library.rename(tmp_path / "offline")
    scanner.scan()

    assert database.count() == 1
