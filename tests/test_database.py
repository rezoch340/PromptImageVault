import sqlite3
from pathlib import Path

from backend.database import Database


def test_migrates_legacy_identifier_column(tmp_path: Path):
    database_path = tmp_path / "index.db"
    Database(database_path)
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "ALTER TABLE images RENAME COLUMN image_identifier TO id"
        )
        connection.commit()

    Database(database_path)

    with sqlite3.connect(database_path) as connection:
        columns = {
            column[1]
            for column in connection.execute("PRAGMA table_info(images)").fetchall()
        }
    assert "image_identifier" in columns
    assert "id" not in columns
