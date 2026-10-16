"""Checks posts against the brand rules with the same checker as npm run
validate (scripts/validate.js), so every way of making posts is held to the
same rules, and the rules live in one place."""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from .batch import ROOT
from .models import SetupError


def check_posts(posts: list[dict], extra_files: dict[str, str] | None = None) -> dict[str, list[str]]:
    """Returns each post's problems by id; an empty list means it passes.

    The posts are written to a throwaway batch folder (with any extra files the
    checker reads, such as research.json), and the checker reports on it.
    """
    if not shutil.which("node"):
        raise SetupError("Node.js is needed to check and draw posts. Install it from https://nodejs.org")
    with tempfile.TemporaryDirectory() as folder:
        (Path(folder) / "posts.json").write_text(json.dumps({"posts": posts}))
        for name, content in (extra_files or {}).items():
            (Path(folder) / name).write_text(content)
        result = subprocess.run(
            ["node", str(ROOT / "scripts" / "validate.js"), folder, "--json"],
            capture_output=True,
            text=True,
            check=True,
        )
    return json.loads(result.stdout)["problems"]
