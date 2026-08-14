from __future__ import annotations

import asyncio
import logging
import mimetypes
import os as operating_system
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import ApplicationConfig, load_config
from .database import Database, SORTS
from .files import resolve_library_file
from .scanner import Scanner, SUPPORTED_EXTENSIONS
from .thumbnail import ThumbnailCache
from .watcher import LibraryWatcher

logging.basicConfig(level=operating_system.getenv("LOG_LEVEL", "INFO"))
LOGGER = logging.getLogger(__name__)


class Connections:
    def __init__(self):
        self.clients: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.clients.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.clients.discard(websocket)

    async def broadcast(self, changes: list[dict[str, Any]]) -> None:
        stale: list[WebSocket] = []
        for client in tuple(self.clients):
            try:
                await client.send_json({"type": "library.changed", "changes": changes})
            except Exception:
                stale.append(client)
        for client in stale:
            self.disconnect(client)


def create_application(config_path: str | Path | None = None) -> FastAPI:
    config = load_config(config_path)
    database = Database(config.cache.directory / "index.db")
    scanner = Scanner(config, database)
    thumbnails = ThumbnailCache(config.cache.directory, config.thumbnail.size)
    connections = Connections()

    async def scan_loop() -> None:
        while True:
            changes = await asyncio.to_thread(scanner.scan)
            if changes:
                await connections.broadcast(changes)
            await asyncio.sleep(config.scanner.interval)

    @asynccontextmanager
    async def lifespan(application_instance: FastAPI) -> AsyncIterator[None]:
        del application_instance
        loop = asyncio.get_running_loop()

        def notify(changes: list[dict[str, Any]]) -> None:
            asyncio.run_coroutine_threadsafe(connections.broadcast(changes), loop)

        task = asyncio.create_task(scan_loop())
        watcher = LibraryWatcher(config, scanner, notify) if config.scanner.watch else None
        if watcher:
            scanner.watching = await asyncio.to_thread(watcher.start)
        try:
            yield
        finally:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
            if watcher:
                await asyncio.to_thread(watcher.stop)
            scanner.watching = False

    application = FastAPI(title="PromptImageVault", version="0.1.0", lifespan=lifespan)
    application.state.config = config
    application.state.database = database
    application.state.scanner = scanner

    def source_path(image: dict[str, Any]) -> Path:
        library = next((item for item in config.libraries if item.name == image["library"]), None)
        if library is None:
            raise HTTPException(404, "Library not found")
        try:
            return resolve_library_file(library.path, image["relative_path"], SUPPORTED_EXTENSIONS)
        except (ValueError, FileNotFoundError):
            raise HTTPException(404, "Image not found")

    def image_or_not_found(image_identifier: str) -> dict[str, Any]:
        image = database.get_image(image_identifier)
        if image is None:
            raise HTTPException(404, "Image not found")
        return image

    @application.get("/api/status")
    def status() -> dict[str, Any]:
        return {
            "images": database.count(),
            "scanning": scanner.is_scanning,
            "last_scan_time": scanner.last_scan_time,
            "last_error": scanner.last_error,
            "watching": scanner.watching,
        }

    @application.get("/api/images")
    def list_images(
        page: int = Query(1, ge=1),
        limit: int = Query(100, ge=1, le=200),
        sort: str = Query("newest"),
    ) -> dict[str, Any]:
        if sort not in SORTS:
            raise HTTPException(422, f"Unsupported sort: {sort}")
        items, total = database.list_images(page, limit, sort)
        return {
            "items": items,
            "page": page,
            "limit": limit,
            "total": total,
            "has_more": page * limit < total,
        }

    @application.get("/api/image/{image_identifier}")
    def full_image(image_identifier: str) -> FileResponse:
        image = image_or_not_found(image_identifier)
        path = source_path(image)
        media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        return FileResponse(
            path,
            media_type=media_type,
            headers={"Cache-Control": "private, max-age=3600"},
        )

    @application.get("/api/thumbnail/{image_identifier}")
    def thumbnail(image_identifier: str) -> FileResponse:
        image = image_or_not_found(image_identifier)
        path = source_path(image)
        try:
            thumbnail_path = thumbnails.get_or_create(image_identifier, path)
        except OSError as error:
            raise HTTPException(500, f"Thumbnail generation failed: {error}") from error
        return FileResponse(
            thumbnail_path,
            media_type="image/webp",
            headers={"Cache-Control": "private, max-age=86400"},
        )

    @application.get("/api/metadata/{image_identifier}")
    def metadata(image_identifier: str) -> dict[str, Any]:
        return image_or_not_found(image_identifier)

    @application.websocket("/ws")
    async def websocket_updates(websocket: WebSocket) -> None:
        await connections.connect(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            connections.disconnect(websocket)

    frontend_dist = Path(__file__).resolve().parents[1] / "frontend" / "dist"
    if frontend_dist.exists():
        application.mount(
            "/", StaticFiles(directory=frontend_dist, html=True), name="frontend"
        )
    return application


application = create_application()


if __name__ == "__main__":
    import uvicorn

    application_config: ApplicationConfig = application.state.config
    uvicorn.run(
        application,
        host=application_config.server.host,
        port=application_config.server.port,
    )
