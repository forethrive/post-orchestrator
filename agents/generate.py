"""Makes a batch of posts with the AI provider set in .env: the Research agent
finds material, the Writer agent writes the posts, then the images are drawn
and the review page opens.

Usage: python -m agents.generate                (14 posts)
       python -m agents.generate --count 6
       python -m agents.generate --no-research  (skip the web research)
       python -m agents.generate --no-review    (don't open the review page)
"""

from __future__ import annotations

import argparse
import json
import os
import sys

from .batch import today
from .brief import research_markdown
from .finish import save_draw_and_review
from .models import SetupError, load_env, load_settings, make_model
from .orchestrator import build_orchestrator
from .research_tools import TavilyServices


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m agents.generate", description="Make a batch of LinkedIn posts.")
    parser.add_argument("--count", type=int, default=14, help="how many posts (1 to 30)")
    parser.add_argument("--no-research", action="store_true", help="skip the web research")
    parser.add_argument("--no-review", action="store_true", help="don't open the review page")
    args = parser.parse_args()

    load_env()
    try:
        if not 1 <= args.count <= 30:
            raise SetupError("--count must be a whole number from 1 to 30.")
        settings = load_settings()
        print(f"Using {settings.name} ({settings.model}).")

        search = None
        if args.no_research:
            print("Skipping research: using the facts in brand/facts.md.")
        elif os.environ.get("TAVILY_API_KEY"):
            search = TavilyServices(os.environ["TAVILY_API_KEY"])
        else:
            print("No TAVILY_API_KEY in .env, so skipping research: using the facts in brand/facts.md.")
        print()

        result = build_orchestrator(make_model(settings), settings, search).invoke({"count": args.count})
        if not result.get("posts"):
            raise SetupError("No posts passed the checks. Try again, or try another model.")

        files = {}
        if result.get("brief"):
            research = {
                "brief": result["brief"],
                "verifiedFacts": result["verified_facts"],
                "rejectedFacts": result["rejected_facts"],
            }
            files["research.json"] = json.dumps(research, indent=2, ensure_ascii=False) + "\n"
            files["research.md"] = research_markdown(
                result["brief"], result["verified_facts"], result["rejected_facts"], today()
            )
        generator = f"{settings.id}/{settings.model}" + (" with research" if search else "")
        save_draw_and_review(result["posts"], generator, files, review=not args.no_review)
        return 0
    except SetupError as error:
        print(error, file=sys.stderr)
    except Exception as error:  # an error from the provider: a wrong key, an unknown model...
        print(f"Something went wrong: {error}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
