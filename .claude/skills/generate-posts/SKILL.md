---
name: generate-posts
description: Plan and draft a batch of Forethrive LinkedIn posts (14 by default), fill in Post Studio's fields, draw the images and open the review page. Use when someone asks to generate, draft or make LinkedIn posts for Forethrive.
argument-hint: "[number of posts, default 14]"
---

# Generate a batch of LinkedIn posts

You're drafting posts for the **Forethrive company page** on LinkedIn.

Number of posts: $ARGUMENTS (if that's empty, make 14).

## 1. Read first

- `brand/writing-rules.md`: how to plan the batch, the "never invent facts"
  rules, the `posts.json` format and every field's limits. Follow it exactly.
- `post-studio.html`: the brand guide for social posts. The guide is the HTML
  before the `<script>` tag; you don't need the script.
- `brand/company.md`: what Forethrive does and who the posts are for.
- `brand/facts.md`: statistics someone has already checked.
- `brand/ideas.md`, if it exists: real projects, wins, announcements and open
  roles from the team. Ignore `brand/ideas.example.md`; it only shows the format.
- Every `posts/*/posts.json`: earlier batches, so you don't repeat them.

## 2. Find material

**First, check the Forethrive LinkedIn page.** Search the web for Forethrive's
recent public LinkedIn posts, for example `site:linkedin.com forethrive` and
`"Forethrive" LinkedIn AI`, and note their topics and headlines. Don't write
anything that's the same as or very similar to a post that's already there.
Use only what search results show: never log in to LinkedIn or open its pages.

Then search the web for recent, useful material for business owners thinking about
AI, ideally from the last 30 days: what's changed, what works, what fails and
why, and practical tips.

- Prefer primary sources: the original survey, study or announcement, not an
  article quoting it.
- Use a number only if you opened the source and it says exactly that.
- **Add every new number to `brand/facts.md` before using it,** in the same
  format (source title, URL, date checked, context, facts). The checker only
  accepts sources listed there.

## 3. Write the batch

Create `posts/<today as YYYY-MM-DD>/posts.json` (add `-2`, `-3` and so on if
that folder exists), following `brand/writing-rules.md`. Set `"generator":
"claude-code"`.

## 4. Check, draw and look

1. Run `npm run validate`. Fix every problem it lists, then run it again until
   every post passes.
2. Run `npm run render`. Post Studio draws each image into the batch folder.
3. Open at least three of the PNGs (one with a big number, the one with the
   longest headline and the one with the longest sub). Check the text fits,
   doesn't run into the waves or the forethrive.ai line, and reads well.
   Shorten and render again if it doesn't.

## 5. Hand over

Start the review page in the background with `npm run review` (stop an earlier
one first if port 4400 is busy). Then tell the person:

- how many drafts there are, and the mix of types
- the three you think are strongest, and why
- the link: http://localhost:4400
- anything that needs them, such as an empty ideas list (so no client wins or
  hiring posts), facts to confirm in `brand/company.md`, or new entries in
  `brand/facts.md` to commit so everyone can use them
