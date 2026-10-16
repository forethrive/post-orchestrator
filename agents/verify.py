"""Checks each fact in the research brief against the page the Research agent
read. This is plain code, not AI: the quote must appear on the page word for
word, and every number in the claim must appear in the quote. Facts that fail
are dropped, so a model can't slip in a number it made up."""

from __future__ import annotations

import re

from .research_tools import page_key


def _normalise(text: str) -> str:
    text = text.lower().replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"')
    text = re.sub(r"[‐-―]", "-", text)
    return re.sub(r"\s+", " ", text).strip()


def _numbers_in(text: str) -> list[str]:
    # Numbers such as 46, 5,179 or 1.4, leaving out years like 2025, which often
    # appear in a claim without being in the quote.
    return [n for n in re.findall(r"\d[\d,.]*\d|\d", text) if not re.fullmatch(r"(19|20)\d\d", n)]


def verify_facts(facts: list[dict], pages: dict[str, str]) -> tuple[list[dict], list[dict]]:
    verified, rejected = [], []
    for fact in facts:
        page = pages.get(page_key(fact["url"]))
        quote = _normalise(fact["quote"])
        if not page:
            reason = "its page wasn't read"
        elif len(quote) < 20:
            reason = "the quote is too short to check"
        elif quote not in _normalise(page):
            reason = "the quote isn't on the page"
        elif any(n not in quote for n in _numbers_in(fact["claim"])):
            reason = "a number in the claim isn't in the quote"
        else:
            reason = None
        if reason:
            rejected.append({**fact, "reason": reason})
        else:
            verified.append(fact)
    return verified, rejected
