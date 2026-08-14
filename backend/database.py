from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any


SCHEMA = """
CREATE TABLE IF NOT EXISTS images (
    image_identifier TEXT PRIMARY KEY,
    library TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    extension TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    modified_ns INTEGER NOT NULL,
    created_time REAL NOT NULL,
    indexed_time REAL NOT NULL,
    prompt TEXT,
    negative_prompt TEXT,
    seed TEXT,
    model TEXT,
    steps INTEGER,
    sampler TEXT,
    scheduler TEXT,
    cfg REAL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    UNIQUE(library, relative_path)
);
CREATE INDEX IF NOT EXISTS index_images_created ON images(created_time DESC);
CREATE INDEX IF NOT EXISTS index_images_filename ON images(filename);
CREATE INDEX IF NOT EXISTS index_images_model ON images(model);
"""

SORTS = {
    "newest": "created_time DESC, filename COLLATE NOCASE ASC",
    "oldest": "created_time ASC, filename COLLATE NOCASE ASC",
    "filename": "filename COLLATE NOCASE ASC",
    "resolution": "(width * height) DESC, created_time DESC",
    "file_size": "file_size DESC, created_time DESC",
    "seed": "CAST(seed AS INTEGER) DESC, created_time DESC",
    "model": "model COLLATE NOCASE ASC, created_time DESC",
    "sampler": "sampler COLLATE NOCASE ASC, created_time DESC",
    "steps": "steps DESC, created_time DESC",
    "cfg": "cfg DESC, created_time DESC",
}


class Database:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            self._migrate_legacy_identifier(connection)
            connection.executescript(SCHEMA)

    @staticmethod
    def _migrate_legacy_identifier(connection: sqlite3.Connection) -> None:
        table = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'images'"
        ).fetchone()
        if table is None:
            return
        columns = {
            column[1] for column in connection.execute("PRAGMA table_info(images)").fetchall()
        }
        if "id" in columns and "image_identifier" not in columns:
            connection.execute("ALTER TABLE images RENAME COLUMN id TO image_identifier")
            connection.commit()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA busy_timeout=30000")
        return connection

    def existing_files(self) -> dict[tuple[str, str], dict[str, Any]]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT image_identifier, library, relative_path, file_size, modified_ns
                FROM images
                """
            ).fetchall()
        return {(row["library"], row["relative_path"]): dict(row) for row in rows}

    def upsert_many(self, images: list[dict[str, Any]]) -> None:
        if not images:
            return
        columns = tuple(images[0].keys())
        placeholders = ", ".join("?" for _ in columns)
        updates = ", ".join(
            f"{column}=excluded.{column}"
            for column in columns
            if column != "image_identifier"
        )
        with self.connect() as connection:
            connection.executemany(
                f"INSERT INTO images ({', '.join(columns)}) VALUES ({placeholders}) "
                f"ON CONFLICT(image_identifier) DO UPDATE SET {updates}",
                (tuple(image[column] for column in columns) for image in images),
            )
            connection.commit()

    def delete_missing(self, seen: set[tuple[str, str]], scanned_libraries: set[str]) -> list[str]:
        existing = self.existing_files()
        missing = [
            row["image_identifier"]
            for key, row in existing.items()
            if key[0] in scanned_libraries and key not in seen
        ]
        if missing:
            with self.connect() as connection:
                connection.executemany(
                    "DELETE FROM images WHERE image_identifier = ?",
                    ((item,) for item in missing),
                )
                connection.commit()
        return missing

    def list_images(self, page: int, limit: int, sort: str) -> tuple[list[dict[str, Any]], int]:
        order_by = SORTS.get(sort)
        if order_by is None:
            raise ValueError(f"unsupported sort: {sort}")
        offset = (page - 1) * limit
        fields = """
            image_identifier, library, relative_path, filename, extension, file_size,
            width, height, created_time, modified_ns, prompt, seed, model,
            steps, sampler, scheduler, cfg
        """
        with self.connect() as connection:
            total = connection.execute("SELECT COUNT(*) FROM images").fetchone()[0]
            rows = connection.execute(
                f"SELECT {fields} FROM images ORDER BY {order_by} LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
        return [dict(row) for row in rows], total

    def get_image(self, image_identifier: str) -> dict[str, Any] | None:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT * FROM images WHERE image_identifier = ?",
                (image_identifier,),
            ).fetchone()
        if row is None:
            return None
        result = dict(row)
        result["metadata"] = json.loads(result.pop("metadata_json"))
        return result

    def count(self) -> int:
        with self.connect() as connection:
            return int(connection.execute("SELECT COUNT(*) FROM images").fetchone()[0])
