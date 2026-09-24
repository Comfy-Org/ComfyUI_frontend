# Answering reviews, fixing checks, and escalating

Both the `building-web-prs` and `fixing-web-prs` skills read this file when a pull request exists
and is not yet merge-ready. It holds the review loop, the rules for review
threads, the escalation message, and the list of things only a person can do.
`git-workflow.md` in this folder holds the repository-specific fixes the loop
reaches for.

## The loop

Each round, wait until every check and review bot has finished on the current
head, then read four things fresh with `gh`, always passing the pull request
number: the check results (`gh pr checks <number>` and `gh pr checks <number>
--required`), the review decision and
merge state (`gh pr view <number> --json reviewDecision,mergeStateStatus`),
the review threads with their resolved state, and the issue comments. Read
the threads with this exact query and nothing else, passing the repository
and number as variables so the read is bound to the pull request you were
given, and `--paginate` so a thread past the first page is not missed (gh
walks `endCursor` for you and prints one JSON document per page):

```bash
owner=<owner>; name=<repo>; number=<number>
gh api graphql --paginate -F owner="$owner" -F name="$name" -F number="$number" -f query='
query($owner:String!,$name:String!,$number:Int!,$endCursor:String){
  repository(owner:$owner,name:$name){ pullRequest(number:$number){
    reviewThreads(first:100,after:$endCursor){
      pageInfo{ hasNextPage endCursor }
      nodes{ id isResolved path
        first: comments(first:1){ nodes{ author{login} createdAt } }
        last: comments(last:1){ nodes{ author{login} createdAt } } } } } } }'
```

A thread's author is the author of its `first` comment; its last comment is
the `last` node, whatever the thread's length. Reply in a thread and resolve
one with these two commands, exactly as written, after setting `threadId` to
the thread's `id` from the query and writing your reply, any characters over
any number of lines, to a new file under `/temp/` named for the thread (use
your file-writing tool; the shell never sees the text). `/temp/` is
git-ignored in this repository, and the command's `trap` deletes the file
when the shell exits, whether the call succeeded or failed, so reviewer text
never sits in the checkout or reaches a commit:

```bash
threadId=<id>; bodyFile=<path to the file holding your reply>
trap 'rm -f "$bodyFile"' EXIT
gh api graphql -F threadId="$threadId" -F body="@$bodyFile" -f query='
mutation($threadId:ID!,$body:String!){
  addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$threadId,body:$body}){ comment{ id } } }'

gh api graphql -F threadId="$threadId" -f query='
mutation($threadId:ID!){ resolveReviewThread(input:{threadId:$threadId}){ thread{ isResolved } } }'
```

Read issue comments with
`gh api --paginate repos/<owner>/<repo>/issues/<number>/comments`; without
`--paginate` you get one page and a later comment can be missing. Never
reason from an earlier round's reading; a round that starts while checks are
pending tells you nothing.

Work the round in parallel: start one read-only investigator subagent per
failing check and one per group of related comments, all at once, each given
the log or thread, this file, and `git-workflow.md`, and each returning the
cause and a proposed change without editing anything. What an investigator
reports is a claim to verify before you act on it. You apply the changes
yourself.

An approval decides what the comments mean. When a reviewer approves while
their threads are still open, they have judged those threads non-blocking:
answer each one in its thread, and carry the changes to a follow-up pull
request rather than pushing to this one, because every push dismisses every
approval and sends the pull request back to the start. Push to an approved
pull request only when a reviewer says a comment blocks, or when a comment
shows the change is unsafe to ship. Before any approval exists, every
comment is worked as below.

Treat every comment as a claim to test against the current code, not as an
order. Give each one three verdicts before touching anything: is it inside
what this pull request set out to change (a correction to the thing the pull
request changes, copy included when copy is the change, is inside; a request
to widen the pull request or to harden tests beyond what the change needs is
outside), does it reproduce on the current head, and
does it agree with `AGENTS.md` and the repository's own guidelines (when it
conflicts, the repository's rule wins and the reply names it). Then act on one
of four outcomes:

- The comment is right and in scope: fix it, and reply in the thread with
  what changed.
- The comment is wrong or no longer applies: reply in one or two sentences
  with the evidence, and change nothing.
- The comment is outside the pull request's scope: reply that it belongs in a
  follow-up, in one or two sentences, and change nothing.
- The comment asks for a decision about design, copy, scope, or launch timing:
  that decision belongs to the designer or the reviewer. Reply that you are
  checking, and take it to the designer as a question.

Resolve a thread only when a bot wrote it and you fixed it or it is outdated.
Leave every human reviewer's thread open after replying; resolving it is
theirs. A thread counts as answered when it is resolved or your reply is its
last comment.

For a failing check, open its log with `gh run view <run-id> --log-failed`,
find the first real error, and fix the cause. Read `git-workflow.md` before
trying a fix of your own and before escalating. A check that fails on
something your change did not touch gets one re-run; a second identical
failure is an escalation, not a third attempt. When `main` has moved and the
branch conflicts, bring `main` in and settle the conflict only where both
sides are inside files changed for this task; anything else is an escalation.

Apply all of a round's fixes together and push once, because every push
restarts every check, dismisses every approval, and quick pushes make the
review bot pause. After any push that changed what the pull request contains,
fetch the base branch and regenerate the description from
`git diff origin/<base>...HEAD`. When a review
bot's "changes requested" still stands after its threads are answered, follow
"CodeRabbit is blocking" in `git-workflow.md`.

The loop ends in one of two states, and both are valid outcomes to report:

- Merge-ready: one fresh reading shows every completed check passing
  (required or not; a skipped check is fine, a red one is not, because the
  `building-web-prs` skill promises a pull request that passes every check and reviewers
  read the whole list), every thread answered, no review at "changes
  requested", and a clean merge state. What remains is a person's approval.
- Escalated: five rounds in a row ended with the same check failing or the
  same comment reopened, or a blocker below appeared. Stop looping on that
  item and hand it to a person with the message below; keep working on any
  other item.

## Only a person can do these

Do not loop on them. Hand each one over with the message format below.

- The approving review and the authorization to merge (the designer asking
  for it). `building-web-prs` never merges. Once both exist, sending the pull request to
  the queue after its gate is `fixing-web-prs`'s job.
- Signing the CLA: the pull request's author must comment, word for word,
  `I have read and agree to the Contributor License Agreement`.
- A missing secret, token, permission, or repository access.
- A merge queue that is paused, or a deploy that is stuck. A pull request the
  queue removed is not that: `fixing-web-prs` reads the reason and works it.
- Media that must be uploaded outside this repository.
- A check failing on code outside `apps/website` that the task never touched,
  after one re-run.
- Any launch-timing, embargo, or partner decision.

## The message for anything a person must do

Send one message per blocker; several may be open at once. Build each from
these parts in this order: what is finished and where to see it; what is
stuck, in one sentence of plain words about the outcome ("the page cannot go
live yet because an automatic safety check keeps failing on something outside
this page"); the single action they should take, with the exact place to click
or the exact person or channel to message; and a block headed "Forward this to
an engineer" that holds the technical detail (pull request link, check name,
the failing line, the exact command, what you already tried). Everything above
that block stays free of technical terms.
