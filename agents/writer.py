"""The Writer agent: a LangGraph graph that writes a batch a few posts at a
time, checks every post against the brand rules, and sends failing posts back
to the model with the problems listed until they pass. Given a draft, it
polishes that draft instead (python -m agents.polish).

    START → next_chunk ──(all written)──→ END
                │
              write → check ──(all pass)──→ next_chunk
                ↑       ├──(problems)──→ request_fixes → write
                │       └──(still failing after 2 fixes)──→ give_up → next_chunk
"""

from __future__ import annotations

import json
import re
from typing import TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from .checks import check_posts
from .context import writer_instructions
from .models import Settings, structured
from .schema import PostsReply

# Five posts per request keeps each request small enough for free tiers.
CHUNK_SIZE = 5
MAX_FIX_ROUNDS = 2


class WriterState(TypedDict, total=False):
    """What the graph remembers between steps. Each node returns only what it changes."""

    count: int  # how many posts the batch should have
    brief: str  # research for this batch, if any
    draft: str  # a rough write-up to polish, if any
    allowed_numbers: list[str]  # when polishing: numbers in the draft or the checked facts
    check_files: dict[str, str]  # extra files the checker reads, such as research.json
    posts: list[dict]  # posts that passed
    next_id: int
    chunk: list[str]  # ids being written now
    pending: list[str]  # ids in the chunk still failing
    conversation: list[BaseMessage]  # this chunk's messages with the model
    received: list[dict]  # the model's latest reply
    problems: dict[str, list[str]]
    fix_rounds: int


def _quote_ids(ids: list[str]) -> str:
    return ", ".join(f'"{i}"' for i in ids)


def numbers_in(text: str) -> list[str]:
    """The numbers in a piece of text, such as 46, 5179 or 1.4 (commas removed)."""
    return [n.replace(",", "") for n in re.findall(r"\d[\d,.]*\d|\d", text)]


def draft_label(draft: str) -> str:
    """How a polished post records where it came from."""
    first = draft.split("\n")[0]
    ellipsis = "…" if len(draft) > 60 else ""
    return f'Your draft: "{first[:60]}{ellipsis}"'


def draft_request(ids: list[str], draft: str) -> str:
    one = len(ids) == 1
    parts = [
        f'The team wrote this rough draft of a post they want to publish:\n\n"""\n{draft}\n"""',
        f"Turn it into {'one polished post' if one else f'{len(ids)} polished versions'} with the "
        f"id{'' if one else 's'} {_quote_ids(ids)}, ready to post.",
        "Keep the team's message, facts and intent. Improve the hook, the wording and the structure so it "
        "follows the writing rules, fill in every field Post Studio needs, and choose the post type that "
        "fits. Treat the draft like an entry in the ideas list.",
        "Use only facts and numbers that are in the draft or in the checked facts. Don't add new ones, and "
        "name a client only if the draft does.",
    ]
    if not one:
        parts.append("Make the versions clearly different: a different hook, headline, angle or post type.")
    return "\n\n".join(parts)


def added_numbers(post: dict, allowed: list[str]) -> list[str]:
    """Numbers in a post's image and caption that aren't in the draft or the checked facts."""
    image, caption = post["image"], post["caption"]
    text = " ".join(
        [image["label"], image["big"], image["headline"], image["sub"], caption["hook"], *caption["body"], caption["action"]]
    )
    return sorted(set(numbers_in(text)) - set(allowed))


def chunk_request(ids: list[str], state: WriterState) -> str:
    if state.get("draft"):
        return draft_request(ids, state["draft"])
    written = "\n".join(f"- {p['id']} {p['type']}: {p['image']['headline']}" for p in state.get("posts", []))
    return "\n\n".join(
        [
            f"Write {len(ids)} posts with the ids {_quote_ids(ids)}.",
            f"The whole batch has {state['count']} posts. Across it, aim for mostly AI insight posts, about a "
            "quarter Stat posts (only with checked facts), and one post for each unused idea from the team.",
            f"Posts already written in this batch (don't repeat their topics or hooks):\n{written or 'None yet.'}",
        ]
    )


def build_writer_graph(model, settings: Settings):
    writer = structured(model, PostsReply, settings)

    def next_chunk(state: WriterState) -> WriterState:
        first = state.get("next_id", 1)
        if first > state["count"]:
            return {"chunk": []}
        last = min(first + CHUNK_SIZE - 1, state["count"])
        ids = [f"{n:02d}" for n in range(first, last + 1)]
        if state.get("draft"):
            print(f"Writer agent: polishing your draft into {'a post' if len(ids) == 1 else f'{len(ids)} versions'}…")
        else:
            print(f"Writer agent: writing posts {ids[0]} to {ids[-1]} of {state['count']:02d}…")
        return {
            "chunk": ids,
            "pending": ids,
            "next_id": last + 1,
            "fix_rounds": 0,
            "problems": {},
            "conversation": [
                SystemMessage(writer_instructions(state.get("brief", ""))),
                HumanMessage(chunk_request(ids, state)),
            ],
        }

    def write(state: WriterState) -> WriterState:
        reply = writer.invoke(state["conversation"])
        posts = [post.model_dump() for post in reply.posts]
        return {
            "received": posts,
            "conversation": [*state["conversation"], AIMessage(json.dumps({"posts": posts}))],
        }

    def check(state: WriterState) -> WriterState:
        # One candidate per pending id, marked as a draft.
        candidates = {}
        for post in state["received"]:
            if post["id"] in state["pending"] and post["id"] not in candidates:
                candidates[post["id"]] = {**post, "status": "draft"}
                if state.get("draft"):
                    candidates[post["id"]]["fromIdea"] = draft_label(state["draft"])
        found = check_posts(list(candidates.values()), state.get("check_files")) if candidates else {}
        if state.get("draft"):
            for pid, post in candidates.items():
                added = added_numbers(post, state.get("allowed_numbers", []))
                if added:
                    found.setdefault(pid, []).append(
                        f"uses numbers that aren't in the draft or the checked facts: {', '.join(added)}"
                    )

        accepted = [post for pid, post in candidates.items() if not found.get(pid)]
        pending = [pid for pid in state["pending"] if pid not in {p["id"] for p in accepted}]
        problems = {pid: found.get(pid) or ["missing from the reply"] for pid in pending}
        print(f"  {len(accepted)} passed the checks" + (f", {len(pending)} to fix." if pending else "."))
        # Keep the posts in id order, even when a fixed post passes after later ones.
        posts = sorted([*state.get("posts", []), *accepted], key=lambda p: p["id"])
        return {"posts": posts, "pending": pending, "problems": problems}

    def request_fixes(state: WriterState) -> WriterState:
        listed = "\n\n".join(
            f"{pid}:\n" + "\n".join(f"- {p}" for p in state["problems"][pid]) for pid in state["pending"]
        )
        message = (
            "These posts broke the rules. Rewrite them so they pass, keeping their ids, and reply with "
            f"only these posts.\n\n{listed}"
        )
        return {
            "fix_rounds": state.get("fix_rounds", 0) + 1,
            "conversation": [*state["conversation"], HumanMessage(message)],
        }

    def give_up(state: WriterState) -> WriterState:
        for pid in state["pending"]:
            print(f"  Dropped post {pid}, still failing: {'; '.join(state['problems'][pid])}")
        return {"pending": []}

    def after_next_chunk(state: WriterState) -> str:
        return "write" if state["chunk"] else END

    def after_check(state: WriterState) -> str:
        if not state["pending"]:
            return "next_chunk"
        return "request_fixes" if state.get("fix_rounds", 0) < MAX_FIX_ROUNDS else "give_up"

    graph = StateGraph(WriterState)
    graph.add_node("next_chunk", next_chunk)
    graph.add_node("write", write)
    graph.add_node("check", check)
    graph.add_node("request_fixes", request_fixes)
    graph.add_node("give_up", give_up)
    graph.add_edge(START, "next_chunk")
    graph.add_conditional_edges("next_chunk", after_next_chunk, ["write", END])
    graph.add_edge("write", "check")
    graph.add_conditional_edges("check", after_check, ["next_chunk", "request_fixes", "give_up"])
    graph.add_edge("request_fixes", "write")
    graph.add_edge("give_up", "next_chunk")
    return graph.compile()
