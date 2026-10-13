# Writing rules for posts

How to plan and write a batch of posts for the Forethrive company page on
LinkedIn. Both ways of generating posts follow this file: `/generate-posts` in
Claude Code and `npm run generate` with an API key. Where it differs from the
brand guide in Post Studio (the personal sign-off and @Forethrive tag), follow
this file, because the page posts these itself.

The team reviews each batch, approves the best few and posts them by hand, so
every draft should be good enough to post as it is. Make the drafts different
from each other, so there's a real choice.

## Plan the batch

- **Mostly AI insight:** one useful lesson, tip or myth busted, for business
  owners and operations leaders thinking about AI.
- **Some Stat posts:** one checked number and what it means for a business.
- **Client win, Announcement and Hiring only from `brand/ideas.md`,** one post
  per idea. Skip ideas already used by an approved or posted post. With no
  ideas, leave these types out.
- One idea per post. Vary the topics, angles and hooks, and link each insight
  to something Forethrive does (see `brand/company.md`) without a hard sell.
- Don't repeat a topic, hook or headline from an earlier post that was approved
  or posted. Skipped posts show what the team didn't want, so avoid that too.

## Never invent facts

- No made-up clients, results, numbers, quotes, launches, products or job
  openings.
- Every number comes from `brand/facts.md`, `brand/ideas.md`, or the facts the
  Research agent checked for this batch. Quote it exactly, with its context
  (who was asked, and when).
- Every source in a post must be one of those checked facts. Copy its title and
  URL exactly.
- Posts from an idea use only the facts written in it. Don't round up, add
  detail or make it sound bigger. Name a client only when the idea says you can.
- Never use anything listed under "Not confirmed" in `brand/company.md`.
- If a post needs a fact you don't have, write a different post.

## The batch file

Each batch is a `posts.json` file shaped like this:

```json
{
  "createdAt": "2026-10-14",
  "generator": "who or what wrote it, e.g. claude-code or groq/openai/gpt-oss-120b",
  "posts": [
    {
      "id": "01",
      "type": "Stat",
      "angle": "One line for the reviewer: why this post is worth posting now.",
      "image": {
        "label": "By the numbers",
        "big": "46%",
        "headline": "of US small businesses with staff use AI tools.",
        "sub": "Another 15% planned to start within a year. Federal Reserve survey, 2025.",
        "size": "portrait"
      },
      "caption": {
        "hook": "One sentence under 125 characters that makes someone stop.",
        "body": ["Short line with one idea.", "Another, with a real example or a checked number."],
        "action": "Where does your team use AI today, if at all?",
        "hashtags": ["#AI", "#GenerativeAI"]
      },
      "firstComment": "Thinking about where AI fits in your business? Start here: https://forethrive.ai",
      "sources": [{ "title": "Title exactly as in brand/facts.md", "url": "URL exactly as in brand/facts.md" }],
      "fromIdea": null,
      "status": "draft"
    }
  ]
}
```

- `type` is one of: Announcement, AI insight, Stat, Client win, Hiring.
- `id`: two digits in order, "01", "02" and so on.
- `angle`: for reviewers only; it isn't posted.
- `sources`: an empty list when the post has no numbers.
- `fromIdea`: the idea's heading from `brand/ideas.md`, or null.
- `status`: always "draft".

## Image fields (what Post Studio draws)

- `label`: a short tag at the top, up to 28 characters. Defaults: Announcement
  → "Announcement", AI insight → "AI insight", Stat → "By the numbers", Client
  win → "Client story", Hiring → "We're hiring".
- `big`: only a real number that's the point of the post, up to 10 characters.
  Stat posts always have one. Leave it empty ("") otherwise.
- `headline`: 12 words or fewer, in sentence case. After a big number, the
  headline finishes the sentence ("of US small businesses with staff use AI
  tools.").
- `sub`: optional, 25 words or fewer.
- A big number takes up room. With one, keep the headline to about 9 words
  and the sub to about 12, or the sub runs into the waves.
- `size`: "portrait", unless someone asks for square. Square images have less
  room, so keep their `sub` to about 15 words.
- No emojis anywhere in the image.

## Caption

Write in the company page's voice ("we"), with plain words and British spelling
(organisation, labour), as on the website.

- `hook`: one sentence under 125 characters, because LinkedIn hides the rest.
- `body`: one to four short lines, one idea each, with a real example or a
  checked number. When a number comes from a source, name the source in the
  line.
- `action`: one question to answer, or "Message us to talk about your use case."
- `hashtags`: up to three from #AI #GenerativeAI #Automation #Forethrive.
- No personal sign-off and no @Forethrive tag.
- No links in the caption. The link goes in `firstComment`, which must include
  forethrive.ai.
- No buzzwords such as "revolutionary", "cutting-edge" or "game-changing" (the
  full list is in `brand/rules.js`), and no emojis.
