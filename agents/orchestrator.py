"""The post orchestrator: the Research agent finds material, plain code checks
the facts it reports, and the Writer agent writes the batch from the brief.
Each agent is its own graph, run as one step of this one.

    START → research → verify_facts → write → END
      └──(no search key)──────────────→ write
"""

from __future__ import annotations

import json
from typing import TypedDict

from langchain_core.messages import HumanMessage
from langgraph.graph import END, START, StateGraph

from .batch import today
from .brief import brief_text
from .models import Settings
from .research import build_research_graph
from .research_tools import make_research_tools
from .verify import verify_facts
from .writer import build_writer_graph


class OrchestratorState(TypedDict, total=False):
    count: int
    brief: dict
    verified_facts: list[dict]
    rejected_facts: list[dict]
    posts: list[dict]


def build_orchestrator(model, settings: Settings, search_services=None):
    """search_services is None when there's no search key; then research is skipped."""
    pages: dict[str, str] = {}
    research_graph = (
        build_research_graph(model, settings, make_research_tools(search_services, pages)) if search_services else None
    )
    writer_graph = build_writer_graph(model, settings)

    def research(state: OrchestratorState) -> OrchestratorState:
        result = research_graph.invoke(
            {
                "count": state["count"],
                "messages": [HumanMessage(f"Today is {today()}. Research material for a batch of {state['count']} posts.")],
            },
            {"recursion_limit": 100},
        )
        return {"brief": result["brief"]}

    def check_facts(state: OrchestratorState) -> OrchestratorState:
        verified, rejected = verify_facts(state["brief"]["facts"], pages)
        print(f"Fact check: {len(verified)} of {len(state['brief']['facts'])} facts match their pages.")
        for fact in rejected:
            print(f'  Dropped "{fact["claim"]}": {fact["reason"]}.')
        return {"verified_facts": verified, "rejected_facts": rejected}

    def write(state: OrchestratorState) -> OrchestratorState:
        brief = state.get("brief")
        verified = state.get("verified_facts", [])
        result = writer_graph.invoke(
            {
                "count": state["count"],
                "brief": brief_text(brief, verified) if brief else "",
                # The checker accepts sources from brand/facts.md plus these.
                "check_files": {"research.json": json.dumps({"verifiedFacts": verified})},
            },
            {"recursion_limit": 200},
        )
        return {"posts": result.get("posts", [])}

    def start(state: OrchestratorState) -> str:
        return "research" if research_graph else "write"

    graph = StateGraph(OrchestratorState)
    graph.add_node("research", research)
    graph.add_node("verify_facts", check_facts)
    graph.add_node("write", write)
    graph.add_conditional_edges(START, start, ["research", "write"])
    graph.add_edge("research", "verify_facts")
    graph.add_edge("verify_facts", "write")
    graph.add_edge("write", END)
    return graph.compile()
