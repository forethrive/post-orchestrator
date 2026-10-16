---
name: generate-posts
description: Plan and draft a batch of Forethrive LinkedIn posts (14 by default), fill in Post Studio's fields, draw the images and open the review page. Use when someone asks to generate, draft or make LinkedIn posts for Forethrive.
argument-hint: "[number of posts, default 14]"
---

# Generate a batch of LinkedIn posts

You're drafting posts for the **Forethrive company page** on LinkedIn. The team
reviews the batch, approves the best few and posts them by hand, so every draft
should be good enough to post as it is. Make more than they need and make them
different from each other, so there's a real choice.

Number of posts: $ARGUMENTS (if that's empty, make 14).

## 1. Read first

- `post-studio.html`: the brand guide for social posts (layout, typography,
  post types, caption format, voice). The guide is the HTML before the
  `<script>` tag; you don't need the script.
- `brand/company.md`: what Forethrive does and who the posts are for. Never use
  anything listed under "Not confirmed".
- `brand/ideas.md`, if it exists: real projects, wins, announcements and open
  roles from the team. Ignore `brand/ideas.example.md`; it only shows the format.
- Every `posts/*/posts.json`: earlier batches. Don't repeat a topic, hook or
  headline that was approved or posted, and don't reuse an idea that's already
  the `fromIdea` of an approved or posted post. Skipped posts show what the team
  didn't want; learn from them.

## 2. Find material

Search the web for recent, useful material for business owners thinking about
AI, ideally from the last 30 days: what's changed, what works, what fails and
why, and practical tips.

- Prefer primary sources: the original survey, study or announcement, not an
  article quoting it.
- Use a number only if you opened the source and it says exactly that. Keep its
  context (who was asked, when) and record the title and URL.

## 3. Plan the batch

- **Mostly AI insight:** one useful lesson, tip or myth busted.
- **Some Stat posts:** one sourced number and what it means for a business.
- **Client win, Announcement and Hiring only from `brand/ideas.md`,** one post
  per idea. If there are no ideas, leave these types out and say so at the end.
- One idea per post. Vary the topics, angles and hooks, and link each insight
  to something Forethrive does (see `brand/company.md`) without a hard sell.

## 4. Never invent facts

- No made-up clients, results, numbers, quotes, launches, products or job
  openings.
- Posts from an idea use only the facts written in it. Don't round up, add
  detail or make it sound bigger.
- Name a client only when the idea says you can.
- If a post needs a fact you don't have, drop it and write a different one.

## 5. Write the batch

Create `posts/<today as YYYY-MM-DD>/posts.json`. If that folder already exists,
add `-2`, `-3` and so on. Use this shape:

```json
{
  "createdAt": "2026-10-13",
  "posts": [
    {
      "id": "01",
      "type": "Stat",
      "angle": "One line for the reviewer: why this post is worth posting now.",
      "image": {
        "label": "By the numbers",
        "big": "60%",
        "headline": "less time spent on manual document review.",
        "sub": "What one survey found when operations teams added an AI assistant.",
        "size": "portrait"
      },
      "caption": {
        "hook": "One sentence under 125 characters that makes someone stop.",
        "body": ["Short line with one idea.", "Another, with a real example or a sourced number."],
        "action": "What's the one report your team dreads every week?",
        "hashtags": ["#AI", "#Automation"]
      },
      "firstComment": "See how we help teams put AI to work: https://forethrive.ai",
      "sources": [{ "title": "Name of the report, publisher, year", "url": "https://..." }],
      "fromIdea": null,
      "status": "draft"
    }
  ]
}
```

Ids are two digits in order: "01", "02" and so on.

**Image fields** (what Post Studio draws):

- `label`: a short tag at the top, up to 28 characters. Defaults: Announcement →
  "Announcement", AI insight → "AI insight", Stat → "By the numbers", Client win
  → "Client story", Hiring → "We're hiring".
- `big`: only a real number that's the point of the post, up to 10 characters
  (Stat posts always have one). The gradient is used only here. Leave it empty
  otherwise.
- `headline`: 12 words or fewer, in sentence case. After a big number, the
  headline finishes the sentence ("less time spent on manual review.").
- `sub`: optional, 25 words or fewer.
- A big number takes up room. With one, keep the headline to about 9 words
  and the sub to about 12, or the sub runs into the waves.
- `size`: "portrait", unless someone asks for square. Square images have less
  room, so keep their `sub` to about 15 words.
- No emojis anywhere in the image.

**Caption**, in the company page's voice ("we"), with plain words and British
spelling as on the website:

- `hook`: one sentence under 125 characters.
- `body`: one to four short lines, one idea each, with a real example or number.
  When a number comes from a source, name the source in the line.
- `action`: one question to answer, or "Message us to talk about your use case."
- `hashtags`: up to three from #AI #GenerativeAI #Automation #Forethrive.
- No personal sign-off and no @Forethrive tag, because the page posts it.
- No links in the caption. The link goes in `firstComment`, which must include
  forethrive.ai.
- No buzzwords (the list is in `brand/rules.js`). Keep emojis out of captions
  too.

Also fill in `angle`, `sources` (an empty list if none), `fromIdea` (the idea's
heading, or null) and `status: "draft"`.

## 6. Check, draw and look

1. Run `npm run validate`. Fix every problem it lists, then run it again until
   every post passes.
2. Run `npm run render`. Post Studio draws each image into the batch folder.
3. Open at least three of the PNGs (one with a big number, the one with the
   longest headline and the one with the longest sub). Check the text fits,
   doesn't run into the waves or the forethrive.ai line, and reads well.
   Shorten and render again if it doesn't.

## 7. Hand over

Start the review page in the background with `npm run review` (stop an earlier
one first if port 4400 is busy). Then tell the person:

- how many drafts there are, and the mix of types
- the three you think are strongest, and why
- the link: http://localhost:4400
- anything that needs them, such as an empty ideas list (so no client wins or
  hiring posts) or facts to confirm in `brand/company.md`
