"""The Research agent's tools: searching the web, searching public LinkedIn
posts, and reading a page. Every page it reads is kept, so the facts it reports
can be checked against the page afterwards."""

from __future__ import annotations

import html
import json
import re
import urllib.request
from urllib.parse import urlparse

from langchain_core.tools import tool
from langchain_tavily import TavilyExtract, TavilySearch

SNIPPET_CHARS = 300
# How much of a page the agent sees. Short enough to keep requests within
# free-tier limits; the full page is kept for checking facts.
PAGE_CHARS = 4000


def page_key(url: str) -> str:
    return url.strip().rstrip("/")


class TavilyServices:
    """Tavily, the search service the tools use. To use another service, write
    a class with the same two methods."""

    def __init__(self, api_key: str):
        self.searcher = TavilySearch(max_results=5, tavily_api_key=api_key)
        self.extractor = TavilyExtract(tavily_api_key=api_key)

    def search(self, query: str, recent: bool = False, domains: list[str] | None = None) -> list[dict]:
        args = {"query": query}
        if recent:
            args["time_range"] = "month"
        if domains:
            args["include_domains"] = domains
        data = self.searcher.invoke(args)
        data = json.loads(data) if isinstance(data, str) else data
        if "error" in data:
            raise RuntimeError(data["error"])
        return [
            {"title": r.get("title"), "url": r.get("url"), "snippet": r.get("content"), "date": r.get("published_date")}
            for r in data.get("results", [])
        ]

    def extract(self, url: str) -> str:
        """Reads pages that a plain download can't, such as PDFs and pages built by JavaScript."""
        data = self.extractor.invoke({"urls": [url]})
        data = json.loads(data) if isinstance(data, str) else data
        results = data.get("results") or [{}]
        return results[0].get("raw_content") or ""


def html_to_text(page: str) -> str:
    page = re.sub(r"<!--.*?-->", " ", page, flags=re.S)
    page = re.sub(r"<(script|style|noscript|svg|nav|footer|header)\b.*?</\1>", " ", page, flags=re.S | re.I)
    page = re.sub(r"</(p|div|li|h[1-6]|tr|br)>", "\n", page, flags=re.I)
    page = html.unescape(re.sub(r"<[^>]+>", " ", page))
    page = re.sub(r"[ \t\xa0]+", " ", page)
    return re.sub(r"\s*\n\s*", "\n", page).strip()


# Pages on this computer's network are off limits, so a web page can't steer the
# agent into reading them.
_PRIVATE_HOST = re.compile(r"^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|.*\.local$)", re.I)


def read_page(url: str, services) -> str:
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if parsed.scheme not in ("http", "https") or _PRIVATE_HOST.match(host):
        raise ValueError("That address can't be opened.")
    if host == "linkedin.com" or host.endswith(".linkedin.com"):
        raise ValueError("LinkedIn pages can't be opened. Use what the search results show.")
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; ForethrivePostResearch/1.0)"})
        with urllib.request.urlopen(request, timeout=20) as response:
            if "html" in response.headers.get("Content-Type", ""):
                charset = response.headers.get_content_charset() or "utf-8"
                text = html_to_text(response.read().decode(charset, errors="replace"))
                if len(text) > 500:
                    return text
    except Exception:
        pass  # Fall back to Tavily below.
    text = services.extract(url)
    if not text:
        raise ValueError("Couldn't read that page.")
    return text


def _format_results(results: list[dict]) -> str:
    if not results:
        return "No results."
    return "\n\n".join(
        f"{r['title']}\n{r['url']}" + (f" ({r['date']})" if r.get("date") else "") + f"\n{(r.get('snippet') or '')[:SNIPPET_CHARS]}"
        for r in results
    )


def make_research_tools(services, pages: dict[str, str]) -> list:
    """The three tools. pages is filled with every page read, keyed by URL."""

    @tool(parse_docstring=True)
    def search_web(query: str, recent: bool) -> str:
        """Search the web. Returns titles, links, dates and short snippets.

        Args:
            query: What to search for.
            recent: True for results from the last month only.
        """
        return _format_results(services.search(query, recent=recent))

    @tool(parse_docstring=True)
    def search_linkedin(query: str) -> str:
        """Search public LinkedIn posts, to see what similar companies are posting. Returns snippets; the posts themselves can't be opened.

        Args:
            query: For example: "AI consultancy" automation tips post
        """
        return _format_results(services.search(query, domains=["linkedin.com"]))

    @tool(parse_docstring=True)
    def read_page_tool(url: str) -> str:
        """Read the text of a web page or PDF, to check facts and copy exact quotes.

        Args:
            url: The full link, starting with https://
        """
        text = read_page(url, services)
        pages[page_key(url)] = text
        more = f"\n\n[First {PAGE_CHARS} of {len(text)} characters]" if len(text) > PAGE_CHARS else ""
        return text[:PAGE_CHARS] + more

    read_page_tool.name = "read_page"
    return [search_web, search_linkedin, read_page_tool]
