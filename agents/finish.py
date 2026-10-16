"""The last steps after writing: number and save the posts, draw the images
with Post Studio (scripts/render.js), and open the review page (scripts/review.js)."""

from __future__ import annotations

import subprocess

from .batch import ROOT, new_batch_dir, today, write_batch


def save_draw_and_review(posts: list[dict], generator: str, files: dict[str, str] | None = None, review: bool = True):
    # Number the posts 01, 02 and so on, with no gaps.
    numbered = [{**post, "id": f"{i:02d}"} for i, post in enumerate(posts, start=1)]
    folder = new_batch_dir()
    write_batch(folder, {"createdAt": today(), "generator": generator, "posts": numbered})
    for name, content in (files or {}).items():
        (folder / name).write_text(content)

    what = "1 post" if len(numbered) == 1 else f"{len(numbered)} posts"
    print(f"\nSaved {what} in {folder.relative_to(ROOT)}. Drawing the images…", flush=True)
    subprocess.run(["node", str(ROOT / "scripts" / "render.js"), str(folder)], check=True)

    if review:
        print(flush=True)
        try:
            subprocess.run(["node", str(ROOT / "scripts" / "review.js"), str(folder)])
        except KeyboardInterrupt:
            pass  # Ctrl+C stops the review page; that's the normal way to finish.
    return folder
