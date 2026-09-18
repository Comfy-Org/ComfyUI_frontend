# Website skills

`build-web-pr` takes a designer's request to a reviewed pull request; `fix-web-pr` clears
the blockers on an existing one and merges it behind a gate. Both read
`apps/website/AGENTS.md`, `build-web-pr/review-loop.md`, and `build-web-pr/git-workflow.md`.

## Evals

Each skill carries an eval suite under its `evals/` directory in the format
`claude plugin eval` reads (Claude Code 2.1.269 or later). Every case is a
directory with a `prompt.md` (the designer's request and run limits) and
`graders/` (pass/fail checks on the transcript, the final message, a produced
file, or a judge rubric). A `tool_used: Skill` grader on a case records whether
the skill fired on that phrasing; a case tagged `negative` asserts it did not.

Eval runs are offline and start in an empty directory, so the functional
cases ship a `fixture.sh` that calls `fix-web-pr/evals/_shared/scaffold.sh`. It
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
  the reply body read from a file and compared byte for byte after a
  multiline body with an apostrophe, quotes, a dollar sign, a backslash and
  the old heredoc delimiter), is run with `--paginate`, and its
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
whether the designer authorized the merge in the session; those are graded
from the transcript and the final message by each case's `regex`,
`tool_used`, `tool_order` and `llm` graders. The one `pr_view.json` is a
template rendered from `defaults.env` plus each case's or phase's small
`view.env` deltas, with the head filled in at serve time. A case may script
phases under `state/phases/<n>/` so each merge command advances the fixture;
`advance_head.<k>` moves the branch head on the k-th view of a phase; comments
and timeline events are cumulative with distinct ids. Every refusal starts
with `merge refused`, and the merge cases grade its absence from the
transcript.

`bash fix-web-pr/evals/_shared/selftest.sh` costs nothing and covers three
things: it scaffolds every fixture under both skills and checks the stand-in
is installed; it checks every markdown file under the skill tree for balanced
code fences; and it drives the five stateful `fix-web-pr` sequences
(`hold-blocks-merge`, `queued-is-not-merged`, `requeues-after-pop`,
`escalates-after-three-removals`, and `merges-on-fresh-head` as the base for
the rule checks) through the stand-in: the target
guard, the gate, wrong-target and wrong-shape reads, mutations of the served
state (a failed required check, a failed or pending optional check, blocked,
changes requested, already merged, a hold edited into the title), thread
timing in both arms, thread replies, cumulative view deltas, `pr create`
binding with the git hooks, the moving head, pagination, distinct removal
events with a changed-reason falsifier, and the three removals. Run it after
touching a fixture. The stand-in needs `jq`.

Fixture setup and shell access are off by default, so pass the flags:

```bash
claude plugin eval apps/website/.claude/skills/fix-web-pr --scaffold --allow-tools Bash --trust-plugin --no-publish
claude plugin eval apps/website/.claude/skills/build-web-pr --scaffold --allow-tools Bash Edit Write --trust-plugin --no-publish
```

Add `--ablation none` to skip the no-skill baseline arm and halve the cost,
`--case <name>` to run one case, and `--tag negative` for the trigger checks
alone. Results land in `<skill>/evals/results/`, which is git-ignored. The
runs call the model on your credentials; a full two-arm run of both suites is
roughly 50 agent sessions.

### Cases

| Skill          | Case                             | Asserts                                                                                                                                                                                                                                                             |
| -------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fix-web-pr`   | `hold-blocks-merge`              | Reads the PR by number, never runs `gh pr merge` against a "do not merge" title, names who lifts the hold                                                                                                                                                           |
| `fix-web-pr`   | `merges-on-fresh-head`           | Full gate read, merge with `--match-head-commit <head>`, no refusal, reports merged                                                                                                                                                                                 |
| `fix-web-pr`   | `queued-is-not-merged`           | Merge only queues; the skill does not report a queued PR as merged                                                                                                                                                                                                  |
| `fix-web-pr`   | `requeues-after-pop`             | Queue drops the PR once and the head moves; the skill reads the reason, re-reads the gate, merges again, reports merged                                                                                                                                             |
| `fix-web-pr`   | `escalates-after-three-removals` | Queue drops the PR three times for one reason; exactly three merge attempts, then escalation naming the reason                                                                                                                                                      |
| `fix-web-pr`   | `asks-for-number`                | With no PR named, runs no `gh pr` command and asks which one                                                                                                                                                                                                        |
| `fix-web-pr`   | `does-not-trigger-on-summary`    | A read-only summary request does not fire the skill or push anything                                                                                                                                                                                                |
| `build-web-pr` | `edits-copy-through-to-pr`       | Reads the guide, review loop and git hints; the created branch's diff touches only `pricing.astro` and adds the new line; its commit message uses the `(website)` prefix and carries no AI trailer; opens and re-reads the PR by number; designer-language hand-off |
| `build-web-pr` | `triggers-on-mock-request`       | Fires on a mock request; with read-only tools it invents no preview or PR and says what it could not do                                                                                                                                                             |
| `build-web-pr` | `does-not-trigger-on-app-work`   | Editor-app work under `src/lib` does not fire the website skill                                                                                                                                                                                                     |
| `build-web-pr` | `does-not-trigger-on-question`   | A question about the site does not fire it                                                                                                                                                                                                                          |

### Results so far

Runs on Claude Code 2.1.275, 2026-09-17, `--ablation none`, judge model
haiku, run from the authoring Mac, when the skills were still named `task`
and `fix-it` (grader names below are the current ones):

| Case                           | Runs      | Graders                                                                                        | Result                                                                                                        |
| ------------------------------ | --------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `does-not-trigger-on-app-work` | 1         | build-web-pr-not-fired                                                                         | 1/1 pass                                                                                                      |
| `does-not-trigger-on-question` | 1         | build-web-pr-not-fired                                                                         | 1/1 pass                                                                                                      |
| `triggers-on-mock-request`     | 1         | skill-fired, no-invented-preview, no-invented-pull-request, honest-end-state (3/3 judge votes) | 1/1 pass                                                                                                      |
| `asks-for-number`              | 1         | skill-fired, no-pr-command-without-number, asks-which-pr (3/3)                                 | 1/1 pass                                                                                                      |
| `does-not-trigger-on-summary`  | 1, then 2 | fix-web-pr-not-fired, nothing-pushed-or-merged                                                 | 0/1, then 2/2 after the `fix-web-pr` description gained its "do not use it to read, summarize, review" clause |

The six merge-gate and workflow cases (`hold-blocks-merge`,
`merges-on-fresh-head`, `queued-is-not-merged`, `requeues-after-pop`,
`escalates-after-three-removals`, `edits-copy-through-to-pr`) need a Bash
grant, which the eval sandbox refused on that machine because its Docker
credential store contains a symlink. Their fixtures pass `selftest.sh`; the
model runs are still owed, on a CI runner or a machine where
`claude plugin eval --allow-tools Bash` is accepted.
