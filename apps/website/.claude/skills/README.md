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
`state/` overrides. The stand-in checks these conditions and nothing else:
every `gh pr` subcommand, mutating ones included, names the pull request
number; a threads query or REST path counts as a read only when its owner,
repository and number are the fixture's; a merge carries
`--match-head-commit` equal to the current head; since the last invalidation
(a merge command, a head move, or any accepted mutation) `pr view`,
`pr checks`, threads and comments were all read; and the served state allows
the merge (every completed check `pass` and none pending, every required check
present and `pass`, `APPROVED`, `CLEAN`, open, not a draft, no "do not
merge" in the title, and each unresolved thread either answered by us and
then approved by its own author, or left by an author who approved after
their own last comment). The threads read counts only when the query
equals, ignoring whitespace, the canonical paginated query `review-loop.md`
gives, run with `--paginate`; thread author and last comment are taken from
the comments list in GitHub's own shape; a reply or resolve mutation must
declare and bind `$threadId` (and `$body`), is bound to a fixture thread id,
and invalidates the gate. Paginated REST and GraphQL reads print one JSON
document per page, two items per page, as `gh` does. It does not check the body or labels
for holds, unpublished routes, or whether the designer authorized the merge
in the session; those are graded from the transcript and the final message
by each case's `regex`, `tool_used`, `tool_order` and `llm` graders. The one
`pr_view.json` is a template rendered from `defaults.env` plus each case's or
phase's small `view.env` deltas, with the head filled in at serve time. A case
may script phases under `state/phases/<n>/` so each merge command advances the
fixture; `advance_head.<k>` moves the branch head on the k-th view of a phase,
so a stale sha from an earlier reading no longer merges; comments and
timeline events are cumulative with distinct ids. `pr create` must name the
checked-out branch and `main`; it installs `post-commit`, `post-rewrite`,
`post-checkout` and `post-merge` hooks in the fixture repository's own hooks
path (the scaffold sets `core.hooksPath` locally, so a global setting cannot
divert them) that
snapshot every `main..branch` commit message and the diff into
`bin/created-pr/`, so the workflow graders read the branch's final git state
whatever the agent did after its last `gh` call. The timeline is served two
events per page, so only `gh api --paginate` sees a third removal. Every refusal starts with `merge refused`, and the merge cases grade
its absence from the transcript.

`bash fix-web-pr/evals/_shared/selftest.sh` drives every fixture through its
expected sequence with the stand-in alone and costs nothing: the target
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
