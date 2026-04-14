from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent


def load_env_file(path: Path, overwrite: bool = False) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if overwrite or key not in os.environ:
            os.environ[key] = value


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def resolve_cache_dir() -> Path:
    override = os.getenv("CACHE_DIR")
    candidates: list[Path] = []
    if override:
        candidates.append(Path(override))
    if os.getenv("VERCEL"):
        candidates.append(Path(os.getenv("TMPDIR") or tempfile.gettempdir()) / "biospecimen-inventory-mapper-cache")
    candidates.append(ROOT_DIR / ".cache")

    last_error: OSError | None = None
    for candidate in candidates:
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            return candidate
        except OSError as exc:
            last_error = exc

    if last_error is not None:
        raise last_error
    raise OSError("Unable to create a writable cache directory.")


@dataclass(frozen=True)
class Settings:
    app_title: str
    app_base_url: str
    public_demo_mode: bool
    public_demo_user_name: str
    public_demo_user_email: str
    cache_dir: Path
    max_preview_rows: int
    max_query_rows: int

    @property
    def db_ready(self) -> bool:
        return False

    @property
    def ai_provider(self) -> str | None:
        return None

    @property
    def ai_ready(self) -> bool:
        return False

    @property
    def header_assistant_enabled(self) -> bool:
        return False

    @property
    def query_ai_enabled(self) -> bool:
        return False

    @property
    def rag_ai_provider(self) -> str | None:
        return None


def get_settings() -> Settings:
    load_env_file(ROOT_DIR / ".env.example")
    load_env_file(ROOT_DIR / ".env", overwrite=True)
    cache_dir = resolve_cache_dir()
    return Settings(
        app_title=os.getenv("APP_TITLE", "Biospecimen Inventory Mapper"),
        app_base_url=os.getenv("APP_BASE_URL", "http://127.0.0.1:8000"),
        public_demo_mode=env_bool("PUBLIC_DEMO_MODE", True),
        public_demo_user_name=os.getenv("PUBLIC_DEMO_USER_NAME", "Public Demo User"),
        public_demo_user_email=os.getenv("PUBLIC_DEMO_USER_EMAIL", "demo@example.com"),
        cache_dir=cache_dir,
        max_preview_rows=int(os.getenv("MAX_PREVIEW_ROWS", "25")),
        max_query_rows=int(os.getenv("MAX_QUERY_ROWS", "100")),
    )
