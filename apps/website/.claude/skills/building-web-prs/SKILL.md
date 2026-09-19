---
name: building-web-prs
description: 'Builds a comfy.org website change from a design-team request and takes it to a reviewed pull request, or to a hand-off naming what is still open and who must act. Invoke when the user asks to make a page match a mock or Figma, change copy or wording on a page, add a new page or launch page, fix how something looks on the website, update the pricing, hero, footer or nav on comfy.org, or says "take this through to a PR". Loops on the live page until it matches or three rounds leave the same line unresolved, opens the pull request, then loops on review comments and failing checks until merge-ready or escalated. Never merges.'
argument-hint: '<what to build or change, with the mock or page>'
---

# building-web-prs

You are working for a designer who cannot read code, run a command, or
interpret a failed check. The work ends in one of two states, and you report
which one: a pull request that matches what they asked for, passes every
check, has every comment answered, and waits only on a person's approval; or
an escalation, where some goal lines, checks, or comments stayed open after
the bounded effort below and the hand-off says exactly what is open and who
must act. Ask early only in the cases under "When to stop and ask".

Read these before anything else and follow them alongside this file:
`apps/website/AGENTS.md` (the map of the site, the trust boundary, and how to
talk to the designer), `apps/website/.claude/skills/building-web-prs/review-loop.md`
(reviews, checks, and escalation), and
`apps/website/.claude/skills/building-web-prs/git-workflow.md` (repository-specific fixes).

## Work as a small team

You are the lead. You own the goal list, every edit to shared files, every
commit and push, and every message to the designer. Start local subagents for
the work below, give each one only what it needs (the goal list, the mock
files, the page address, and its one job), and never your own reasoning about
why the page is right. A judge that has read the builder's argument agrees with
it.

- Judges, after every build round, all at once and read-only: one for desktop
  (1440 wide), one for mobile (390 wide), one that runs the website's checks,
  and, only when a touched page has a `zh-CN` twin, one for that twin and the
  copy. A page without a twin (`AGENTS.md` names the families) gets no locale
  judge and no twin work. Each visual judge takes its own screenshot, for
  example with
  `pnpm --filter @comfyorg/website exec playwright screenshot --full-page --viewport-size=1440,900 <address> <file>`,
  saves it under `/temp/`, compares it with the mock, and returns each goal line
  as yes or no with the screenshot path and the exact difference it saw.
- Builders, only when the request splits into parts that touch different files
  (two separate pages, or a component and an unrelated test). Each builder gets
  its files by name and stays inside them. They share the one dev server.
  Anything that touches `translations.ts`, `routes.ts`, `llms.txt`, or the
  footer is yours alone, because every builder would edit the same lines.
- Investigators, once a pull request exists, as `review-loop.md` describes.

What a subagent reports is a claim, the same as a review comment. Before you
act on a "no", look at the screenshot it cites; before you tell anyone a line
is a "yes", every judge you started must have said so in the same round on
the same build. Re-run only the judges that said no, then run all of them once
more before leaving loop one. Skip the team for a change a single screenshot
can settle, such as one word of copy.

## Pin down the goal before touching a file

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

Start the site's dev server and work against `http://localhost:4321`. Make the
smallest change that moves one goal line, reload, screenshot at both widths, and
compare against the mock side by side. Judge in this order, because the early
ones change the later ones: structure and order of sections, then copy, then
spacing and size, then colour and type, then motion and hover. Check the
`zh-CN` twin of every page you touch that has one. A difference you can see is
a difference; do not talk yourself out of it.

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

Work on a branch named for the request, never on `main`. Read the last commit
message before pushing and confirm it carries no AI trailer. Push, then fetch the base
branch (`git fetch origin main`) and write the description from
`git diff origin/main...HEAD` using the repository's pull request template, with the before and after screenshots attached. A pull
request holding work that must not ship yet is opened as a draft with the
reason in the first line; an embargoed page is never reachable by URL in a
pull request that is meant to merge.

You have opened the pull request when `gh pr view <number>` returns its state,
and you pass that number to every `gh pr` command from then on. Give the
designer the preview address once the `deploy-preview` check has passed and
you have loaded that address yourself and seen the change on it; `AGENTS.md`
says when no preview will exist.

## Loop two: answer reviews and fix checks

Run the loop in `review-loop.md` until it reports merge-ready or escalated.
This skill never merges and never adds a pull request to the merge queue.

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

## Hand-off

Finish with a short note to the designer: the preview link, the goal list with
each line marked matched or open, anything you chose on their behalf, and
what is still needed from a person, one message per blocker in the format
`review-loop.md` gives (normally a single one: "an engineer needs to approve
it"). State only what you read from the browser or from `gh` this turn. Say
plainly what you did not check, such as motion you could not observe or a
language you could not proofread.
