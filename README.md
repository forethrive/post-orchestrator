# Post orchestrator

Forethrive's kit for LinkedIn posts:

- **Post Studio** (`post-studio.html`) gives every post the same look. It's the
  brand guide for social posts and the tool that draws post images.
- **The generator** uses Claude to decide what to post, write it, and draw the
  images with Post Studio. It drafts a batch of 14 posts, the team picks the
  best ones on a review page, and someone posts them on the Forethrive company
  page.

Nothing is posted automatically. People choose and post every draft.

## How the generator works

1. **Read.** Claude reads the brand guide in Post Studio, the company notes in
   `brand/company.md`, the team's ideas in `brand/ideas.md`, and every earlier
   batch, so it doesn't repeat itself.
2. **Research.** It searches the web for recent, useful AI material for
   business owners. Any number it uses comes from a source it opened.
3. **Plan and write.** It writes 14 varied drafts. For each one it fills in
   Post Studio's fields (label, big number, headline, supporting line) and
   writes the caption and first comment.
4. **Check.** `npm run validate` tests every draft against the brand guide. That
   covers headline length, the 125-character hook, allowed hashtags, banned
   buzzwords, no emojis in images, and no numbers without a source. Claude fixes
   anything that fails.
5. **Draw.** `npm run render` opens Post Studio in a hidden Chrome window and
   saves each image, so they match images made by hand exactly.
6. **Review.** `npm run review` opens a page on this Mac. You approve the best
   drafts, skip the rest, and mark them posted once they're live.

**Claude never invents facts.** It writes AI-insight and Stat posts by itself.
Client wins, announcements and hiring posts come only from what the team writes
in `brand/ideas.md`. Clients are named only when the idea says that's allowed.

## Setting up a Mac (once)

1. Install [Node.js](https://nodejs.org) (version 20 or newer) and Google Chrome.
2. Install the Claude desktop app and sign in. The generator runs in its Code
   tab.
3. In this folder, run `npm install`. That downloads Playwright, the library
   that controls Chrome for drawing images.
4. Copy `brand/ideas.example.md` to `brand/ideas.md` and add real projects,
   wins, news and open roles.
5. Check the items marked "Not confirmed" in `brand/company.md`.

## Making a batch of posts

1. Open this folder in the Claude desktop app's Code tab and type
   `/generate-posts`. For a different number of drafts, add it at the end, for
   example `/generate-posts 6`. A batch takes a few minutes.
2. When it's done, Claude lists its three favourites and opens the review page
   at http://localhost:4400.
3. Approve the drafts you want and skip the rest. Clicking a button again
   undoes it.
4. To post an approved draft:
   1. Download the image.
   2. On LinkedIn, switch to the Forethrive page and start a post.
   3. Add the image and paste the caption, then post it.
   4. Paste the first comment, which has the link.
   5. Mark it posted on the review page.
5. Stop the review page with Ctrl+C in its terminal, or by asking Claude. Open
   it again later with `npm run review`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run validate` | Checks the newest batch against the brand guide |
| `npm run render` | Draws the newest batch's images with Post Studio |
| `npm run review` | Opens the review page for the newest batch |

Each command works on the newest batch unless you name another one, for example
`npm run review -- posts/2026-10-13`.

## What's where

| Path | What it is |
| --- | --- |
| `post-studio.html` | Post Studio. Open it in a browser to make a post by hand. |
| `.claude/skills/generate-posts/SKILL.md` | The generator's step-by-step instructions for Claude |
| `brand/company.md` | What Forethrive does and who the posts are for |
| `brand/ideas.example.md` | The format for `brand/ideas.md` |
| `brand/rules.js` | The brand guide's limits, used by the validator |
| `scripts/` | The validate, render and review scripts |
| `review/index.html` | The review page |
| `posts/` | One folder per batch, with `posts.json` and the images |

`brand/ideas.md` and `posts/` are never committed (see `.gitignore`). They can
hold client details and unannounced news, and this repository is public. They
live only on the Mac that makes the posts.

If the brand guide in Post Studio changes, update `brand/rules.js` and the
generator's instructions to match.

## To do

- [ ] **Send drafts by email through Gmail,** so people can review on their
  phones:
  - **One email per post:** image attached, caption ready to copy, first comment
    and sources. One per post keeps each email under Gmail's 25 MB limit and
    makes it easy to post straight from a phone.
  - **No paid service:** send through a Gmail account with an app password. The
    account needs 2-Step Verification, and on Google Workspace the admin has to
    allow app passwords. The password goes in a local `.env` file that's never
    committed.
  - **Approve and Skip buttons** open a pre-filled reply. The next run reads the
    replies and updates each post's status. Later, a free Google Apps Script
    could make these true one-tap buttons.
- [ ] **Run on a schedule** with a Claude scheduled routine, so batches arrive
  without anyone starting them. Ideas and batches would then need to live
  somewhere shared instead of on one Mac.
- [ ] **Post to LinkedIn after approval.** Posting as the company page needs a
  LinkedIn developer app approved for the Community Management API.
- [ ] **Carousels.** The guide describes 5 to 8 slide posts. LinkedIn takes
  carousels as PDFs, so the generator would draw each slide and combine them.
- [ ] **Confirm the facts** listed under "Not confirmed" in `brand/company.md`.
