from __future__ import annotations

import logging
import threading
from collections.abc import Callable
from typing import Any

from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from .config import ApplicationConfig
from .scanner import Scanner, SUPPORTED_EXTENSIONS

LOGGER = logging.getLogger(__name__)


class DebouncedHandler(FileSystemEventHandler):
    def __init__(self, callback: Callable[[], None], delay: float = 0.5):
        self.callback = callback
        self.delay = delay
        self._timer: threading.Timer | None = None
        self._lock = threading.Lock()

    def on_any_event(self, event: FileSystemEvent) -> None:
        if event.is_directory or event.event_type not in {
            "created",
            "modified",
            "deleted",
            "moved",
        }:
            return
        paths = [getattr(event, "src_path", ""), getattr(event, "dest_path", "")]
        if not any(path.lower().endswith(tuple(SUPPORTED_EXTENSIONS)) for path in paths):
            return
        with self._lock:
            if self._timer:
                self._timer.cancel()
            self._timer = threading.Timer(self.delay, self.callback)
            self._timer.daemon = True
            self._timer.start()


class LibraryWatcher:
    def __init__(
        self,
        config: ApplicationConfig,
        scanner: Scanner,
        on_changes: Callable[[list[dict[str, Any]]], None],
    ):
        self.config = config
        self.scanner = scanner
        self.on_changes = on_changes
        self.observer: Observer | None = None

    def start(self) -> bool:
        try:
            observer = Observer()
            handler = DebouncedHandler(self._scan)
            scheduled = False
            for library in self.config.libraries:
                if library.path.exists():
                    observer.schedule(handler, str(library.path), recursive=library.recursive)
                    scheduled = True
            if not scheduled:
                return False
            observer.start()
            self.observer = observer
            return True
        except Exception:
            LOGGER.exception("File watcher failed; periodic scanning remains active")
            return False

    def _scan(self) -> None:
        changes = self.scanner.scan()
        if changes:
            self.on_changes(changes)

    def stop(self) -> None:
        if self.observer:
            self.observer.stop()
            self.observer.join(timeout=3)
