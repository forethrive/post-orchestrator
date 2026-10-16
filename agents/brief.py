"""Turns the research brief into text: for the Writer agent's instructions, and
as research.md in the batch folder for people to read."""

from __future__ import annotations


def _list(items: list, line) -> str:
    return "\n".join(line(item) for item in items) if items else "- None found."


def brief_text(brief: dict, verified_facts: list[dict]) -> str:
    return "\n\n".join(
        [
            "## Recent news",
            _list(brief["news"], lambda n: f"- {n['headline']} ({n['date']}): {n['summary']} {n['url']}"),
            "## Facts checked against their pages today",
            "You may use these numbers and cite these sources, exactly as written.",
            _list(
                verified_facts,
                lambda f: f"- {f['claim']}\n  Quote: \"{f['quote']}\"\n  Source: {f['sourceTitle']}\n  URL: {f['url']}",
            ),
            "## What similar companies post",
            "For ideas only: never copy their wording, and don't mention them.",
            _list(brief["inspiration"], lambda i: f"- {i['theme']} ({i['format']}): {i['notes']} {i['url']}"),
            "## Angles to consider",
            _list(brief["angles"], lambda a: f"- {a}"),
            "## Already on Forethrive's LinkedIn page",
            "Don't repeat these, or anything very similar.",
            _list(brief.get("alreadyOnLinkedIn", []), lambda a: f"- {a}"),
        ]
    )


def research_markdown(brief: dict, verified: list[dict], rejected: list[dict], date: str) -> str:
    return (
        "\n\n".join(
            [
                f"# Research for the batch of {date}",
                "Written by the Research agent. Facts were checked against the pages they came from.",
                brief_text(brief, verified),
                "## Facts that failed the check (not used)",
                _list(rejected, lambda f: f"- {f['claim']} ({f['reason']}) {f['url']}"),
                "## Keeping a fact for later batches",
                "Copy it into `brand/facts.md` in the same format as the others, after checking it reads right.",
            ]
        )
        + "\n"
    )
