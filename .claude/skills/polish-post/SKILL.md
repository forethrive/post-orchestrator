---
name: polish-post
description: Turn someone's rough write-up of a specific post into a polished Forethrive LinkedIn post, with every Post Studio field filled in, the caption and first comment written, the image drawn and the review page open. Use when someone shares a draft, notes or an idea for a particular post and wants it ready to publish.
argument-hint: "[the rough draft, or the path to a file with it] [optional: number of versions]"
---

# Polish a draft into a post

Someone knows what they want to post and has written it roughly. Your job is
to turn it into a post that's ready to publish, keeping their message.

The draft: $ARGUMENTS. If it's a file path, read the file. If it's empty, ask
the person to paste their draft. Make one post unless they ask for more
versions (up to 5).

## 1. Read first

- `brand/writing-rules.md`: the post format, every field's limits and the
  caption rules. Follow it exactly.
- `post-studio.html`: the brand guide (the HTML before the `<script>` tag).
- `brand/company.md` and `brand/facts.md`.

## 2. Polish

- Keep the person's message, facts and intent. Improve the hook, the wording
  and the structure, and choose the post type that fits.
- Fill in every field Post Studio needs (label, big number if there's one
  real number that's the point, headline, supporting line), plus the caption
  and first comment.
- Use only facts and numbers that are in the draft or in `brand/facts.md`.
  Don't add new ones. Name a client only if the draft does.
- If something important is unclear, such as whether a client can be named or
  what a number refers to, ask before writing.
- With more than one version, make them clearly different: a different hook,
  headline, angle or post type.

## 3. Save, check and draw

1. Create `posts/<today as YYYY-MM-DD>/posts.json` (add `-2`, `-3` and so on
   if that folder exists) in the format from `brand/writing-rules.md`, with
   `"generator": "claude-code polish"`. Set each post's `fromIdea` to
   `Your draft: "<first words of the draft>"`. Save the draft beside it as
   `draft.txt`.
2. Run `npm run validate` and fix anything it lists.
3. Run `npm run render`, open the image, and check the text fits and reads
   well.

## 4. Hand over

Start the review page in the background with `npm run review` (stop an
earlier one first if port 4400 is busy). Show the caption and the image fields
in your reply, and give the link: http://localhost:4400.
