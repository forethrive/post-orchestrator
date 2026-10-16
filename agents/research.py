"""The Research agent: a LangGraph graph that searches the web, reads sources
and looks at what similar companies post on LinkedIn, then writes a research
brief for the Writer agent.

    START → think ──(wants a tool)──→ tools ──→ think
              └──(has enough, or out of turns)──→ write_brief → END
"""

from __future__ import annotations

from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from pydantic import BaseModel, Field

from .context import research_instructions
from .models import Settings, structured

# The most times the agent can decide what to do next before it must write the
# brief. Keeps a run's time and cost in check.
MAX_TURNS = 12


class NewsItem(BaseModel):
    headline: str
    summary: str = Field(description="Two sentences: what happened and why it matters to a business owner")
    url: str
    date: str = Field(description="When it was published, as YYYY-MM-DD if known")


class Fact(BaseModel):
    claim: str = Field(description="The number and what it means, in one sentence")
    quote: str = Field(description="The sentence from the page containing the number, copied word for word")
    sourceTitle: str = Field(description="Report or article title, publisher, date")
    url: str = Field(description="The page it was read on")
    date: str


class Inspiration(BaseModel):
    theme: str = Field(description="What the post was about")
    format: str = Field(description="For example: a list of tips, a myth busted, a before and after")
    notes: str = Field(description="What made it work, in your own words. Don't copy its text.")
    url: str


class ResearchBrief(BaseModel):
    news: list[NewsItem]
    facts: list[Fact]
    inspiration: list[Inspiration]
    angles: list[str] = Field(description="Post ideas for Forethrive that use this material")
    alreadyOnLinkedIn: list[str] = Field(
        description="Topics or headlines of posts already on Forethrive's LinkedIn page, from search results"
    )


class ResearchState(TypedDict, total=False):
    count: int
    # add_messages adds each node's new messages to the list instead of replacing it.
    messages: Annotated[list[AnyMessage], add_messages]
    turns: int
    brief: dict


def _describe(call: dict) -> str:
    args = call["args"]
    if call["name"] == "search_web":
        return f'searching the web for "{args.get("query")}"' + (" (last month)" if args.get("recent") else "")
    if call["name"] == "search_linkedin":
        return f'searching LinkedIn posts for "{args.get("query")}"'
    if call["name"] == "read_page":
        return f"reading {args.get('url')}"
    return call["name"]


def _transcript(messages: list[AnyMessage]) -> str:
    """Everything the agent found, as plain text for the brief."""
    parts = []
    for m in messages:
        if m.type == "tool":
            parts.append(f"Result of {m.name}:\n{m.text}")
        elif m.type == "ai" and m.text:
            parts.append(f"Your notes:\n{m.text}")
    return "\n\n---\n\n".join(parts)


def build_research_graph(model, settings: Settings, tools: list):
    researcher = model.bind_tools(tools)
    brief_writer = structured(model, ResearchBrief, settings)

    def think(state: ResearchState) -> ResearchState:
        reply = researcher.invoke([SystemMessage(research_instructions()), *state["messages"]])
        for call in reply.tool_calls:
            print(f"Research agent: {_describe(call)}")
        return {"messages": [reply], "turns": state.get("turns", 0) + 1}

    def write_brief(state: ResearchState) -> ResearchState:
        print("Research agent: writing the research brief…")
        brief = brief_writer.invoke(
            [
                SystemMessage(research_instructions()),
                HumanMessage(
                    f"Here is everything you found:\n\n{_transcript(state['messages'])}\n\n"
                    f"Now write the research brief for a batch of {state['count']} posts. Include only "
                    "facts from pages you read, with the quote copied word for word."
                ),
            ]
        )
        return {"brief": brief.model_dump()}

    def after_think(state: ResearchState) -> str:
        wants_tool = bool(state["messages"][-1].tool_calls)
        return "tools" if wants_tool and state.get("turns", 0) < MAX_TURNS else "write_brief"

    graph = StateGraph(ResearchState)
    graph.add_node("think", think)
    # ToolNode runs the tools the model asked for. handle_tool_errors=True turns a
    # failing tool into a message the agent can read, instead of a crash.
    graph.add_node("tools", ToolNode(tools, handle_tool_errors=True))
    graph.add_node("write_brief", write_brief)
    graph.add_edge(START, "think")
    graph.add_conditional_edges("think", after_think, ["tools", "write_brief"])
    graph.add_edge("tools", "think")
    graph.add_edge("write_brief", END)
    return graph.compile()
