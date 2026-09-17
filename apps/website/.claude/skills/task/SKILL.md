---
name: task
description: 'Take a comfy.org website request from a designer (a mock to match, a copy change, a new page, a visual bug) all the way to a pull request that is green and answered. Loops on the live page until it matches, opens the pull request, then loops on review comments and failing checks. Use for any request to build, change, or fix something under apps/website.'
---

# task

You are working for a designer who cannot read code, run a command, or
interpret a failed check. The goal is a pull request that matches what they
asked for, passes every check, has every review comment answered, and is waiting
only on a human approval. Keep going until that is true. Stop early only for the
cases under "When to stop and ask". `apps/website/AGENTS.md` holds the map of
this site, the trust boundary, and the rules for talking to the designer; it
applies to everything below.

## Work as a small team

Goal: reach a verified match in the fewest rounds, by checking in parallel and
by having the page judged by agents that did not build it.

You are the lead. You own the goal list, every edit to shared files, every
commit and push, and every message to the designer. Start local subagents for
the work below, give each one only what it needs (the goal list, the mock
files, the page address, and its one job), and never your own reasoning about
why the page is right. A judge that has read the builder's argument agrees with
it.

- Judges, after every build round, all at once and read-only: one for desktop
  (1440 wide), one for mobile (390 wide), one for the `zh-CN` twin and the copy,
  and one that runs the website's checks. Each visual judge takes its own
  screenshot, for example with
  `pnpm --filter @comfyorg/website exec playwright screenshot --full-page --viewport-size=1440,900 <address> <file>`,
  saves it under `/temp/`, compares it with the mock, and returns each goal line
  as yes or no with the screenshot path and the exact difference it saw.
- Builders, only when the request splits into parts that touch different files
  (two separate pages, or a component and an unrelated test). Each builder gets
  its files by name and stays inside them. They share the one dev server.
  Anything that touches `translations.ts`, `routes.ts`, `llms.txt`, or the
  footer is yours alone, because every builder would edit the same lines.
- Investigators, in loop two: one per failing check and one per group of
  related review comments, all at once. Each reads the log or thread and
  `git-workflow.md`, and returns the cause and a proposed change without
  editing. You apply the changes together and push once, because every push
  restarts all checks and quick pushes make the review bot pause.

What a subagent reports is a claim, the same as a review comment. Before you
act on a "no", look at the screenshot it cites; before you tell anyone a line
is a "yes", every judge must have said so in the same round on the same build.
Re-run only the judges that said no, then run all four once more before leaving
loop one. Skip the team for a change a single screenshot can settle, such as
one word of copy.

## Pin down the goal before touching a file

Goal: a written, checkable definition of done, so the loop has something to
end on.

Read what the designer gave you: mocks (image files, a Figma link, a
screenshot with notes), a URL, or a sentence. Open the current page in the
browser at desktop (1440 wide) and mobile (390 wide) and screenshot both before
changing anything; these are your "before" images. Then write the goal as a
short list of things a person could look at and say yes or no to: "headline
reads X", "three cards in a row on desktop, stacked on mobile", "button is
brand yellow". Tell the designer that list in plain words and carry on without
waiting, unless one of the stop cases applies.

A mock is absent more often than present. With no mock, the goal comes from the
designer's words plus the nearest existing page of the same kind, and you say
which page you used as the reference.

## Loop one: make the page match

Goal: every line of the goal list is a yes, observed in a browser this turn.

Start the site's dev server and work against `http://localhost:4321`. Make the
smallest change that moves one goal line, reload, screenshot at both widths, and
compare against the mock side by side. Judge in this order, because the early
ones change the later ones: structure and order of sections, then copy, then
spacing and size, then colour and type, then motion and hover. Check the
`zh-CN` twin of every page you touch. A difference you can see is a difference;
do not talk yourself out of it.

End the loop when every goal line is a yes. Also end it when three rounds in a
row leave the same line unresolved: stop polishing, keep what works, and carry
that line to the hand-off as an open item with both screenshots. Differences
the mock cannot settle (a width it never drew, copy it left as placeholder) get
the nearest existing pattern on the site and a note saying what you chose.

Before leaving this loop, run the website's checks listed in `AGENTS.md` and
fix what they report. Add or update a browser test for behaviour you added.
Update a screenshot baseline only when the visual change is the one the
designer asked for, and say in the pull request which baselines moved and why.

## Open the pull request

Goal: a pull request whose description is true and whose preview link works.

Work on a branch named for the request, never on `main`. Read the last commit
message before pushing and confirm it carries no AI trailer. Push, then write
the description from `git diff origin/main...HEAD` using the repository's pull
request template, with the before and after screenshots attached. A pull
request holding work that must not ship yet is opened as a draft with the
reason in the first line; an embargoed page is never reachable by URL in a
pull request that is meant to merge.

You have opened the pull request when `gh pr view` returns its number and
state. Give the designer the preview address once the preview check has passed
and you have loaded that address yourself and seen the change on it.

## Loop two: answer reviews and fix checks

Goal: no failing check, no unanswered comment, no conflict with `main`.

Each round, read three things fresh with `gh`: the check results, the review
threads with their resolved state, and whether the branch still merges cleanly.
Never reason from an earlier round's reading. Checks and review bots take
several minutes after a push, so wait for them to finish before reading; a
round that starts while checks are pending tells you nothing.

Treat every comment as a claim to test against the current code, not as an
order. For each one, decide among three outcomes and act:

- The comment is right: fix it, push, and reply in the thread with what
  changed.
- The comment is wrong or no longer applies: reply in one or two sentences with
  the evidence, and change nothing.
- The comment asks for a decision about design, copy, scope, or launch timing:
  that decision belongs to the designer or the reviewer. Reply that you are
  checking, and take it to the designer as a question.

Resolve a thread only when a bot wrote it and you fixed it or it is outdated.
Leave every human reviewer's thread open after replying; resolving it is
theirs.

For a failing check, open its log and find the first real error, fix the cause,
and push. `git-workflow.md` beside this file lists the failures this repository
produces most, their causes, and the fixes you can carry out alone, including
rejected pushes, conflicts with `main`, stale previews, and screenshot
baselines. Read it before trying a fix of your own, and before escalating. A check that fails on something your change did not touch gets one
re-run; a second identical failure is an escalation, not a third attempt. When
`main` has moved and the branch conflicts, bring `main` in and settle the
conflict only where both sides are inside files you changed for this task;
anything else is an escalation. After any push that changed what the pull
request contains, regenerate the description from the diff.

End the loop when one fresh reading shows every required check passing, every
thread either resolved or replied to by you as the last word, and a clean
merge state. Also end it after five rounds that each end with the same check
failing or the same comment reopened, and escalate that item.

## When to stop and ask

Deliver first and report what you chose; time and effort are never reasons to
ask. Ask the designer only in these cases, one question at a time, with the
options you can actually carry out and what each means for the page:

- Two readings of the request would produce visibly different pages and no
  existing page settles it.
- The request needs something only a person can supply: a final image or
  video, approved copy, a launch date, a legal or partner sign-off.
- Doing the task would remove or replace a live page or published copy that
  the request did not mention.

## When you cannot fix something yourself

Goal: the designer knows exactly what to do next and whom to involve, without
understanding the cause.

Send one message per blocker, built from these parts in this order: what is
finished and where to see it; what is stuck, in one sentence of plain words
about the outcome ("the page cannot go live yet because an automatic safety
check keeps failing on something outside this page"); the single action they
should take, with the exact place to click or the exact person or channel to
message; and a block headed "Forward this to an engineer" that holds the
technical detail (pull request link, check name, the failing line, what you
already tried). Everything above that block stays free of technical terms.

These need a person every time, so do not loop on them: a required approval
from a code owner, a missing secret or permission, a merge queue or deploy that
is stuck, media that must be uploaded outside this repository, a check failing
on code outside `apps/website`, and any launch-timing or embargo decision.

## Hand-off

Finish with a short note to the designer: the preview link, the goal list with
each line marked matched or open, anything you chose on their behalf, and the
one thing still needed from a person (normally "an engineer needs to approve
it"). State only what you read from the browser or from `gh` this turn. Say
plainly what you did not check, such as motion you could not observe or a
language you could not proofread.
