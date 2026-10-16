---
name: weekly-drafts
description: The unattended weekly run. Generate a batch of Forethrive LinkedIn drafts, export them as a PDF and an HTML page, and email them to the reviewers, or email an error report if anything fails. Used by the Monday scheduled task; can also be run by hand.
---

# Weekly LinkedIn drafts (unattended)

Nobody is watching this run, so don't ask questions or wait for answers. If
something blocks you, report it by email (step 6) and stop. Never post to
LinkedIn, and never commit, push or change branches.

Work in `/Users/tanwani/code/forethrive/post-orchestrator`. Append each step and
its output to `posts/weekly-run.log`, starting with today's date and time, so a
failure report can include it (for example `npm run export -- --drafts 2>&1 | tee -a posts/weekly-run.log`).

## 1. Check the setup

1. Run `python3 -m agents.mail check`. If it exits with code 2, the email
   settings in `.env` are incomplete, so nobody could be told about this run.
   Stop, and say exactly what's missing in your final message.
2. If the folder is on the `main` branch with no uncommitted changes, run
   `git pull --ff-only` to get the latest version. Otherwise carry on with
   what's checked out, and mention the branch in your final message.

## 2. Generate the batch

Follow `.claude/skills/generate-posts/SKILL.md` for 14 posts, with one change:
skip its last step ("Hand over"). Don't start the review page, because nobody
is here to use it.

## 3. Check the batch

Run `npm run validate`. It must report that every post passes. If some
still fail after you've fixed what you can, drop those posts from
`posts.json` (keeping at least 6), or report an error if fewer than 6 pass.

## 4. Export the drafts

Run `npm run export -- --drafts`. It saves
`forethrive-drafts-<date>.pdf` and `forethrive-drafts-<date>.html` in the
batch folder.

## 5. Email the drafts

Run `python3 -m agents.mail drafts`. It sends both files to everyone in
`MAIL_TO`.

## 6. If any step fails

Run:

```
python3 -m agents.mail error --step "<the step that failed>" --message "<one sentence: what went wrong>" --log posts/weekly-run.log
```

Then stop. If even that fails, say so in your final message.

## 7. Final message

Say what happened in a few lines: the batch folder, how many posts were
made, who was emailed, and anything unusual (a different branch, dropped
posts, sources that couldn't be checked).
