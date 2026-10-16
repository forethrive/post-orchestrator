"""Gathers what the Writer agent needs to know into its instructions: the
writing rules, the brand guide, the company notes, the checked facts, the
team's ideas and the posts made before."""

from __future__ import annotations

import html
import re

from .batch import ROOT, past_posts

HISTORY_LIMIT = 60


def read(path: str) -> str:
    file = ROOT / path
    return file.read_text().strip() if file.exists() else ""


def guide_text() -> str:
    """The brand guide: the <main> part of Post Studio, as plain text."""
    match = re.search(r"<main[^>]*>(.*?)</main>", read("post-studio.html"), re.S)
    text = match.group(1) if match else ""
    text = re.sub(r"</(h2|h3|li|p|pre)>", "\n", text)
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    return re.sub(r"\n\s*\n+", "\n", text).strip()


def history() -> str:
    posts = past_posts()[-HISTORY_LIMIT:]
    if not posts:
        return "None yet."
    lines = []
    for p in posts:
        idea = f" | from idea: {p['fromIdea']}" if p.get("fromIdea") else ""
        lines.append(f"- [{p['status']}] {p['type']}: {p['image']['headline']} | hook: {p['caption']['hook']}{idea}")
    return "\n".join(lines)


def research_instructions() -> str:
    recent = "\n".join(f"- {p['image']['headline']}" for p in past_posts()[-HISTORY_LIMIT:])
    return "\n\n".join(
        [
            read("brand/research-rules.md"),
            f"# About Forethrive\n\n{read('brand/company.md')}",
            f"# Already posted or drafted\n\n{recent or 'Nothing yet.'}",
        ]
    )


def writer_instructions(brief: str = "") -> str:
    ideas = read("brand/ideas.md")
    sections = [
        (
            "Your job",
            "You write LinkedIn posts for the Forethrive company page, following the writing rules "
            "below exactly. You can't browse the web, so use only the facts and research given here.",
        ),
        ("Writing rules", read("brand/writing-rules.md")),
        ("Brand guide (from Post Studio)", guide_text()),
        ("About Forethrive", read("brand/company.md")),
        ("Checked facts", read("brand/facts.md")),
        ("Ideas from the team", ideas or "None yet, so don't write Client win, Announcement or Hiring posts."),
        ("Earlier posts (status in brackets)", history()),
    ]
    if brief:
        sections.append(("Research for this batch", brief))
    return "\n\n".join(f"# {title}\n\n{body}" for title, body in sections)
