"""The exact shape of a post, described with Pydantic.

The model is asked to reply in this shape, and LangChain checks the reply
against it before the agent sees it. Field names match posts.json exactly
(firstComment, fromIdea), because the JavaScript tools read the same file.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# The same post types as brand/rules.js.
PostType = Literal["Announcement", "AI insight", "Stat", "Client win", "Hiring"]


class Image(BaseModel):
    label: str = Field(description="Short tag at the top, up to 28 characters")
    big: str = Field(description='One checked number such as "46%", or an empty string')
    headline: str = Field(description="12 words or fewer, sentence case")
    sub: str = Field(description="Supporting line, 25 words or fewer, or an empty string")
    size: Literal["portrait", "square"]


class Caption(BaseModel):
    hook: str = Field(description="One sentence under 125 characters")
    body: list[str] = Field(description="One to four short lines")
    action: str = Field(description='One question, or "Message us to talk about your use case."')
    hashtags: list[str] = Field(description="Up to three of #AI #GenerativeAI #Automation #Forethrive")


class Source(BaseModel):
    title: str
    url: str


class Post(BaseModel):
    id: str = Field(description='Two digits, as asked, e.g. "01"')
    type: PostType
    angle: str = Field(description="One line for the reviewer: why this post is worth posting now")
    image: Image
    caption: Caption
    firstComment: str = Field(description="Includes https://forethrive.ai")
    sources: list[Source] = Field(description="Copied exactly from the checked facts; empty if the post has no numbers")
    fromIdea: str | None = Field(description="The heading of the idea it came from, or null")


class PostsReply(BaseModel):
    posts: list[Post]
