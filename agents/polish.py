"""Turns a rough write-up into a polished post, ready to publish: fills in Post
Studio's fields, writes the caption, draws the image and opens the review page.
Uses the AI provider set in .env.

Usage: python -m agents.polish my-draft.txt
       python -m agents.polish "We cut invoice processing from 3 days to 4 hours…"
       python -m agents.polish my-draft.txt --versions 3   (a few to choose from)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .batch import ROOT
from .finish import save_draw_and_review
from .models import SetupError, load_env, load_settings, make_model
from .writer import build_writer_graph, numbers_in


def read_draft(text: str) -> str:
    """The draft is either a file or the text itself."""
    try:
        path = Path(text).expanduser()
        if path.is_file():
            return path.read_text().strip()
    except OSError:
        pass  # Too long to be a file name, so it's the text itself.
    return text


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m agents.polish", description="Polish a rough draft into a post.")
    parser.add_argument("draft", nargs="*", help="a file with your draft, or the draft itself in quotes")
    parser.add_argument("--versions", type=int, default=1, help="how many versions to choose from (1 to 5)")
    parser.add_argument("--no-review", action="store_true", help="don't open the review page")
    args = parser.parse_args()

    load_env()
    try:
        text = " ".join(args.draft).strip()
        if not text:
            raise SetupError('Give it your draft: python -m agents.polish my-draft.txt, or the text itself in quotes.')
        if not 1 <= args.versions <= 5:
            raise SetupError("--versions must be a whole number from 1 to 5.")
        draft = read_draft(text)

        settings = load_settings()
        print(f"Using {settings.name} ({settings.model}).\n")
        writer = build_writer_graph(make_model(settings), settings)

        # The post may only use numbers from the draft or the checked facts.
        facts = (ROOT / "brand" / "facts.md").read_text()
        result = writer.invoke(
            {"count": args.versions, "draft": draft, "allowed_numbers": sorted(set(numbers_in(f"{draft}\n{facts}")))},
            {"recursion_limit": 100},
        )
        if not result.get("posts"):
            raise SetupError(
                "The draft couldn't be turned into a post that passes the checks. Try adding detail, or another model."
            )

        save_draw_and_review(
            result["posts"], f"{settings.id}/{settings.model} polish", {"draft.txt": f"{draft}\n"}, review=not args.no_review
        )
        return 0
    except SetupError as error:
        print(error, file=sys.stderr)
    except Exception as error:  # an error from the provider: a wrong key, an unknown model...
        print(f"Something went wrong: {error}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
