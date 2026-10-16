# Ideas for later

Ideas that came up while building the weekly drafts email, kept here to pick
up when they're needed. Today the flow stops at "email the drafts to the
reviewers"; people approve and post by hand.

## Approvals

**1. Reply with picks.** The drafts page attached to the weekly email gets a
tick box per post and a **Send my picks** button. The button opens an email
reply listing the ticked posts and any comments ("Approve: 01, 04, 07"), so
approving is just sending a reply. Reviewers could also type the numbers
themselves.

- Needs nothing new on the reviewer's side: any email app, on a phone too.
- A static page can't send anything itself, but a `mailto:` link with the
  picks filled in can.

**2. Read the replies and act on them.** A second scheduled task checks the
sending Gmail inbox. It can use Python's built-in `imaplib` with the same app
password, so there's no new package. For each reply to this week's drafts
email from a known reviewer, it would:

1. read the post numbers from the reply
2. mark those posts approved in `posts.json`
3. run `npm run export` to build the shortlist zip
4. email the zip to the LinkedIn handler (a new `MAIL_LINKEDIN_TO` setting)

Choices to make first:

- Send after the **first** reply, or wait for a **deadline** (say Tuesday
  12:00) and combine every reviewer's picks?
- What if nobody replies: remind the reviewers, or tell the admin?

**3. A hosted review page instead of email.** Publish each week's drafts as a
private web page with Approve buttons and shared state, so every reviewer sees
the others' picks. Options:

- a Claude-hosted page with a shared database
- a Notion database with an "Approved" tick box per post

It's slicker than email, but reviewers would need access (an account or a
shared link). Drafts can hold client details, so the page must stay private.

## Monitoring

- **A heartbeat.** If no drafts email went out by Monday 11:00 (because the
  Mac was off, the app was closed or usage ran out), email the admin. It has
  to run somewhere other than this Mac, since the Mac may be the problem: for
  example, a free scheduled GitHub Action that checks for a "sent" marker.
- **A weekly summary** for the admin: how many drafts were made, how many
  facts were checked and dropped, how long the run took.

## Posting

- **A posting plan:** give each approved post a day (Mon, Wed, Fri) and put
  the schedule in the shortlist.
- **Post to LinkedIn after approval.** Posting as the company page needs a
  LinkedIn developer app approved for the Community Management API.
- **Carousels:** the guide describes 5 to 8 slide posts. LinkedIn takes them
  as PDFs, so the generator would draw each slide and combine them.

## Running somewhere other than this Mac

- **A Claude cloud routine** instead of a task on this Mac, so it runs even
  when the Mac is off. The ideas list, earlier batches and Chrome would need
  to be available there, for example by keeping batches in a private
  repository.
- **A GitHub Action with an API key** (`python -m agents.generate`), with the
  same email step at the end.
