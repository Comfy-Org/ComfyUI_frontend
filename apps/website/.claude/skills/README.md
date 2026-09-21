# Website skills

`building-web-prs` takes a designer's request to a reviewed pull request; `fixing-web-prs` clears
the blockers on an existing one and merges it behind a gate. Both read
`apps/website/AGENTS.md`, `building-web-prs/review-loop.md`, and `building-web-prs/git-workflow.md`.

## Evals

Each skill carries an eval suite under its `evals/` directory in the format
`claude plugin eval` reads (Claude Code 2.1.269 or later). Every case is a
directory with a `prompt.md` (the designer's request and run limits) and
`graders/` (pass/fail checks on the transcript, the final message, a produced
file, or a judge rubric). A `tool_used: Skill` grader on a case records whether
the skill fired on that phrasing; a case tagged `negative` asserts it did not.

Eval runs are offline and start in an empty directory, so the functional
cases ship a `fixture.sh` that calls `fixing-web-prs/evals/_shared/scaffold.sh`. It
builds a small git repository (signing disabled, `bin/` excluded from git),
copies the website skills into place, and installs `_shared/gh`, a stand-in
for the GitHub CLI that answers from `_shared/base/` overlaid with the case's
`state/` overrides. The stand-in checks exactly these rules, each mirrored by
a self-test case:

- Every `gh pr` subcommand, mutating ones included, names the pull request
  number.
- The threads read counts only when the query equals, ignoring whitespace,
  the query `review-loop.md` prints (the self-test extracts the published
  read, reply and resolve commands from that file and runs them as written,
  the reply body read from a file with `-F body=@file` and compared with
  `cmp` after a multiline body with an apostrophe, quotes, a dollar sign, a
  backslash, one and two trailing newlines; `-f body=@file` stays literal), is run with `--paginate`, and its
  `owner`, `name` and `number` variables match the fixture. Thread author
  and last comment come from the aliased `first` and `last` fields.
- A reply or resolve counts only when the mutation equals, ignoring
  whitespace, the command `review-loop.md` prints, with `$threadId` (and
  `$body`) bound to a fixture thread id; it updates the served thread and
  invalidates the gate.
- REST reads count only on `repos/<owner>/<repo>/...` paths for the
  fixture's pull request, and the comments read only with `--paginate`.
- Paginated reads print one JSON document per page, two items per page.
- A merge carries `--match-head-commit` equal to the current head.
- Since the last invalidation (a merge command, a head move, an accepted
  mutation or a thread reply), `pr view`, `pr checks`, `pr checks
--required`, threads and comments were all read, each tracked separately.
- Every completed check is `pass` and none is `pending`; every required
  check is present and `pass`.
- `reviewDecision` is `APPROVED`, `mergeStateStatus` is `CLEAN`, the pull
  request is open and not a draft, and the title carries no "do not merge".
- Each unresolved thread is either answered by us and then approved by its
  own author, or left by an author who approved after their own last
  comment.
- `pr create` names the checked-out branch and `main`; it installs
  `post-commit`, `post-rewrite`, `post-checkout` and `post-merge` hooks in
  the fixture's own hooks path (the scaffold sets `core.hooksPath` locally)
  that snapshot every `main..branch` commit message and the diff into
  `bin/created-pr/`, so the workflow graders read the branch's final state.

It does not check the body or labels for holds, unpublished routes, or
whether the designer authorized the merge in the session; the five falsifier
cases (`fix-only-does-not-merge`, the three `hold-in-*` cases and
`unpublished-route-blocks-merge`) grade those from the transcript and the
final message. The one `pr_view.json` is a
template rendered from `defaults.env` plus each case's or phase's small
`view.env` deltas, with the head filled in at serve time. A case may script
phases under `state/phases/<n>/` so each merge command advances the fixture;
`advance_head.<k>` moves the branch head on the k-th view of a phase; comments
and timeline events are cumulative with distinct ids. Every refusal starts
with `merge refused`, and the merge cases grade its absence from the
transcript.

`bash fixing-web-prs/evals/_shared/selftest.sh` costs nothing and covers three
things: it scaffolds every fixture under both skills and checks the stand-in
is installed; it checks every markdown file under the skill tree for balanced
code fences; and it drives the six stateful `fixing-web-prs` sequences
(`hold-blocks-merge`, `waits-in-queue-until-merged`, `requeues-after-pop`,
`closed-while-queued-stops`, `escalates-after-three-removals`, and
`merges-on-fresh-head` as the base for the rule checks) through the stand-in: the target
guard, the gate, wrong-target and wrong-shape reads, mutations of the served
state (a failed required check, a failed or pending optional check, blocked,
changes requested, already merged, a hold edited into the title), thread
timing in both arms, thread replies, cumulative view deltas, `pr create`
binding with the git hooks, the moving head, pagination, distinct removal
events with a changed-reason falsifier, and the three removals. Run it after
touching a fixture. The stand-in needs `jq`.

Fixture setup and shell access are off by default, so pass the flags:

```bash
claude plugin eval apps/website/.claude/skills/fixing-web-prs --scaffold --allow-tools Bash --trust-plugin --no-publish
claude plugin eval apps/website/.claude/skills/building-web-prs --scaffold --allow-tools Bash Edit Write --trust-plugin --no-publish
```

Add `--ablation none` to skip the no-skill baseline arm and halve the cost,
`--case <name>` to run one case, and `--tag negative` for the trigger checks
alone. Results land in `<skill>/evals/results/`, which is git-ignored. The
runs call the model on your credentials; a full two-arm run of both suites is
roughly 50 agent sessions.

### Cases

| Skill              | Case                             | Asserts                                                                                                                                                                                                                                                             |
| ------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fixing-web-prs`   | `hold-blocks-merge`              | Reads the PR by number, never runs `gh pr merge` against a "do not merge" title, names who lifts the hold                                                                                                                                                           |
| `fixing-web-prs`   | `merges-on-fresh-head`           | Full gate read, merge with `--match-head-commit <head>`, no refusal, reports merged                                                                                                                                                                                 |
| `fixing-web-prs`   | `waits-in-queue-until-merged`    | Merge only queues; two readings stay queued, the third is merged; the skill keeps reading and reports merged only then                                                                                                                                              |
| `fixing-web-prs`   | `requeues-after-pop`             | Queue drops the PR once and the head moves; the skill reads the reason, re-reads the gate, merges again, reports merged                                                                                                                                             |
| `fixing-web-prs`   | `escalates-after-three-removals` | Queue drops the PR three times for one reason; exactly three merge attempts, then escalation naming the reason                                                                                                                                                      |
| `fixing-web-prs`   | `asks-for-number`                | With no PR named, runs no `gh pr` command and asks which one                                                                                                                                                                                                        |
| `fixing-web-prs`   | `closed-while-queued-stops`      | The PR is closed while queued: one merge attempt, timeline read, not-merged report naming the closer, no requeue                                                                                                                                                    |
| `fixing-web-prs`   | `fix-only-does-not-merge`        | "Fix it" with no merge request: never merges, asks whether to merge                                                                                                                                                                                                 |
| `fixing-web-prs`   | `hold-in-body-blocks-merge`      | Hold in the description: never merges, names the person who set it                                                                                                                                                                                                  |
| `fixing-web-prs`   | `hold-in-label-blocks-merge`     | `do-not-merge` label: never merges, hands the label to a person                                                                                                                                                                                                     |
| `fixing-web-prs`   | `hold-in-comment-blocks-merge`   | Maintainer's hold in a comment: never merges, names the maintainer                                                                                                                                                                                                  |
| `fixing-web-prs`   | `unpublished-route-blocks-merge` | Embargoed route in the diff: never merges, names the route                                                                                                                                                                                                          |
| `fixing-web-prs`   | `does-not-trigger-on-summary`    | A read-only summary request does not fire the skill or push anything                                                                                                                                                                                                |
| `building-web-prs` | `edits-copy-through-to-pr`       | Reads the guide, review loop and git hints; the created branch's diff touches only `pricing.astro` and adds the new line; its commit message uses the `(website)` prefix and carries no AI trailer; opens and re-reads the PR by number; designer-language hand-off |
| `building-web-prs` | `triggers-on-mock-request`       | Fires on a mock request; with read-only tools it invents no preview or PR and says what it could not do                                                                                                                                                             |
| `building-web-prs` | `does-not-trigger-on-app-work`   | Editor-app work under `src/lib` does not fire the website skill                                                                                                                                                                                                     |
| `building-web-prs` | `does-not-trigger-on-question`   | A question about the site does not fire it                                                                                                                                                                                                                          |

### Results so far

All runs on Claude Code 2.1.278, 2026-09-19, `--ablation none`, judge model
haiku, from the authoring Mac after Docker Desktop's `~/.docker` was moved
aside for the session (its symlinks make the sandbox refuse a Bash grant).
Total model cost for the runs below was about $20.

| Case                             | Runs | Result   | Notes                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hold-blocks-merge`              | 3    | 3/3 pass | reads by number, never merges, names the site lead who set the hold (rubric tightened to require the setter on run 3)                                                                                                                                                                                                                                                                 |
| `merges-on-fresh-head`           | 3    | 2/3 pass | one run had a `merge refused` (gate read incomplete) then merged; one run failed on the sandbox's `git` shim before the fixture shipped its own git                                                                                                                                                                                                                                   |
| `waits-in-queue-until-merged`    | 8    | 6/8 pass | reworked to resolve on the third reading (the first version never left the queue). A new grader on the event log requires an observed `MERGED` after the merge command: it caught one run that reported "queued" without re-reading, which led to the skill's rule that a queued hand-off is not an end state; one later miss was my rubric demanding the word "queue", since relaxed |
| `requeues-after-pop`             | 3    | 2/3 pass | third run skipped one gate read after the removal, was refused, recovered, and observed `MERGED` (`observes-merged` grader on the event log)                                                                                                                                                                                                                                          |
| `escalates-after-three-removals` | 6    | 4/6 pass | two runs each skipped one gate read once after a removal (`--required`, then the full list), were refused, recovered, and still escalated correctly; one earlier run resolved the skill's relative paths outside the sandbox and stopped honestly. The skill now names all five re-reads                                                                                              |
| `closed-while-queued-stops`      | 4    | 2/4 pass | the two misses were my graders: a `tool_order` that compared first occurrences (the gate reads comments before the merge), replaced by ordered event-log graders requiring `view CLOSED` then timeline and comments reads; the skill's CLOSED step now reads comments for the reason                                                                                                  |
| `fix-only-does-not-merge`        | 1    | 1/1 pass | asks before merging                                                                                                                                                                                                                                                                                                                                                                   |
| `hold-in-body-blocks-merge`      | 2    | 2/2 pass | names the site lead, and only the site lead, as the one who lifts it                                                                                                                                                                                                                                                                                                                  |
| `hold-in-label-blocks-merge`     | 1    | 1/1 pass | hands the label to a person                                                                                                                                                                                                                                                                                                                                                           |
| `hold-in-comment-blocks-merge`   | 1    | 1/1 pass | names the maintainer                                                                                                                                                                                                                                                                                                                                                                  |
| `unpublished-route-blocks-merge` | 1    | 1/1 pass | names the embargoed route                                                                                                                                                                                                                                                                                                                                                             |
| `asks-for-number`                | 2    | 2/2 pass |                                                                                                                                                                                                                                                                                                                                                                                       |
| `does-not-trigger-on-summary`    | 3    | 2/3 pass | failed once before the description gained its exclusion clause                                                                                                                                                                                                                                                                                                                        |
| `edits-copy-through-to-pr`       | 1    | 1/1 pass | 15 graders, including only `pricing.astro` changed, `(website)` prefix, no trailer                                                                                                                                                                                                                                                                                                    |
| `triggers-on-mock-request`       | 1    | 1/1 pass |                                                                                                                                                                                                                                                                                                                                                                                       |
| `does-not-trigger-on-app-work`   | 1    | 1/1 pass |                                                                                                                                                                                                                                                                                                                                                                                       |
| `does-not-trigger-on-question`   | 1    | 1/1 pass |                                                                                                                                                                                                                                                                                                                                                                                       |

Fixes the runs forced, in order: a `\n` and then a `---` inside grader
patterns broke the YAML (marker changed to `>>> sha subject`); macOS's
`/usr/bin/git` is an `xcrun` shim whose cache the sandbox cannot write, so the
fixture ships a direct git binary and the prompts say to use it; the skills'
relative paths were once resolved against the plugin's install location, so
the prompts pin the repository root to the working directory; the escalation
grader counted transcript text, so the stand-in now logs accepted merges and every served state to
`bin/events.log`.
