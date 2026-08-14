from pathlib import Path

import pytest

from backend.files import resolve_library_file


ALLOWED = {".png", ".jpg", ".jpeg", ".webp"}


def test_resolve_library_file_rejects_traversal_and_unknown_types(tmp_path: Path):
    library = tmp_path / "library"
    library.mkdir()
    outside = tmp_path / "secret.png"
    outside.write_bytes(b"not an image")
    text = library / "notes.txt"
    text.write_text("private")

    with pytest.raises(ValueError, match="escapes"):
        resolve_library_file(library, "../secret.png", ALLOWED)
    with pytest.raises(ValueError, match="type"):
        resolve_library_file(library, "notes.txt", ALLOWED)


def test_resolve_library_file_rejects_symlink_escape(tmp_path: Path):
    library = tmp_path / "library"
    library.mkdir()
    outside = tmp_path / "outside.png"
    outside.write_bytes(b"data")
    (library / "link.png").symlink_to(outside)

    with pytest.raises(ValueError, match="escapes"):
        resolve_library_file(library, "link.png", ALLOWED)
