"""Batch folders: each batch lives in posts/<date>/ with its posts.json and images."""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT / "posts"


def today() -> str:
    """Today's date as YYYY-MM-DD."""
    return date.today().isoformat()


def _natural_key(name: str) -> list:
    # Sorts 2026-10-13-10 after 2026-10-13-2, as the JavaScript tools do.
    return [int(part) if part.isdigit() else part for part in re.split(r"(\d+)", name)]


def list_batches() -> list[Path]:
    """Every batch folder in posts/, oldest first."""
    if not POSTS_DIR.exists():
        return []
    folders = [p for p in POSTS_DIR.iterdir() if (p / "posts.json").exists()]
    return sorted(folders, key=lambda p: _natural_key(p.name))


def new_batch_dir() -> Path:
    """A new, empty folder for today's batch: posts/2026-10-16, or -2, -3 and so on."""
    folder = POSTS_DIR / today()
    n = 2
    while folder.exists():
        folder = POSTS_DIR / f"{today()}-{n}"
        n += 1
    folder.mkdir(parents=True)
    return folder


def read_batch(folder: Path) -> dict:
    return json.loads((folder / "posts.json").read_text())


def write_batch(folder: Path, batch: dict) -> None:
    (folder / "posts.json").write_text(json.dumps(batch, indent=2, ensure_ascii=False) + "\n")


def past_posts() -> list[dict]:
    """Every post from every earlier batch, so new batches don't repeat them."""
    return [post for folder in list_batches() for post in read_batch(folder)["posts"]]
