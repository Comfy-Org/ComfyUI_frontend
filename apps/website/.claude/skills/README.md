# Website skills

`task` takes a designer's request to a reviewed pull request; `fix-it` clears
the blockers on an existing one and merges it behind a gate. Both read
`apps/website/AGENTS.md`, `task/review-loop.md`, and `task/git-workflow.md`.

## Evals

Each skill carries an eval suite under its `evals/` directory in the format
`claude plugin eval` reads (Claude Code 2.1.269 or later). Every case is a
directory with a `prompt.md` (the designer's request and run limits) and
`graders/` (pass/fail checks on the transcript, the final message, a produced
file, or a judge rubric). A `tool_used: Skill` grader on a case records whether
the skill fired on that phrasing; a case tagged `negative` asserts it did not.

Eval runs are offline and start in an empty directory, so the functional
cases ship a `fixture.sh` that calls `fix-it/evals/_shared/scaffold.sh`. It
builds a small git repository (signing disabled, `bin/` excluded from git),
copies the website skills into place, and installs `_shared/gh`, a stand-in
for the GitHub CLI that answers from `_shared/base/` overlaid with the case's
`state/` overrides. The stand-in enforces what the skills must get right:
every `gh pr` subcommand, mutating ones included, needs the pull request
number; a merge needs `--match-head-commit` equal to the current head and a
complete gate reading (`pr view`, `pr checks`, threads, comments) since the
last change; `__HEAD__` in a fixture is replaced with the current head at
serve time. A case may script phases under `state/phases/<n>/` so each merge
command advances the fixture, and `advance_head.<k>` moves the branch head on
the k-th view of a phase, so a stale sha from an earlier reading no longer
merges. Every refusal starts with `merge refused`, and the merge cases grade
its absence from the transcript.

`bash fix-it/evals/_shared/selftest.sh` drives every fixture through its
expected sequence with the stand-in alone and costs nothing; run it after
touching a fixture.

Fixture setup and shell access are off by default, so pass the flags:

```bash
claude plugin eval apps/website/.claude/skills/fix-it --scaffold --allow-tools Bash --trust-plugin --no-publish
claude plugin eval apps/website/.claude/skills/task --scaffold --allow-tools Bash Edit Write --trust-plugin --no-publish
```

Add `--ablation none` to skip the no-skill baseline arm and halve the cost,
`--case <name>` to run one case, and `--tag negative` for the trigger checks
alone. Results land in `<skill>/evals/results/`, which is git-ignored. The
runs call the model on your credentials; a full two-arm run of both suites is
roughly 50 agent sessions.

### Cases

| Skill    | Case                             | Asserts                                                                                                                    |
| -------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `fix-it` | `hold-blocks-merge`              | Reads the PR by number, never runs `gh pr merge` against a "do not merge" title, names who lifts the hold                  |
| `fix-it` | `merges-on-fresh-head`           | Full gate read, merge with `--match-head-commit <head>`, no refusal, reports merged                                        |
| `fix-it` | `queued-is-not-merged`           | Merge only queues; the skill does not report a queued PR as merged                                                          |
| `fix-it` | `requeues-after-pop`             | Queue drops the PR once and the head moves; the skill reads the reason, re-reads the gate, merges again, reports merged     |
| `fix-it` | `escalates-after-three-removals` | Queue drops the PR three times for one reason; exactly three merge attempts, then escalation naming the reason             |
| `fix-it` | `asks-for-number`                | With no PR named, runs no `gh pr` command and asks which one                                                               |
| `fix-it` | `does-not-trigger-on-summary`    | A read-only summary request does not fire the skill or push anything                                                       |
| `task`   | `edits-copy-through-to-pr`       | Reads the guide, review loop and git hints; edits the page; commits on a branch with no AI trailer; opens and re-reads the PR by number; designer-language hand-off |
| `task`   | `triggers-on-mock-request`       | Fires on a mock request; with read-only tools it invents no preview or PR and says what it could not do                    |
| `task`   | `does-not-trigger-on-app-work`   | Editor-app work under `src/lib` does not fire the website skill                                                            |
| `task`   | `does-not-trigger-on-question`   | A question about the site does not fire it                                                                                 |

### Results so far

Runs on Claude Code 2.1.275, 2026-09-17, `--ablation none`, judge model
haiku, run from the authoring Mac:

| Case                          | Runs | Graders                                                              | Result   |
| ----------------------------- | ---- | -------------------------------------------------------------------- | -------- |
| `does-not-trigger-on-app-work`| 1    | task-not-fired                                                       | 1/1 pass |
| `does-not-trigger-on-question`| 1    | task-not-fired                                                       | 1/1 pass |
| `triggers-on-mock-request`    | 1    | skill-fired, no-invented-preview, no-invented-pull-request, honest-end-state (3/3 judge votes) | 1/1 pass |
| `asks-for-number`             | 1    | skill-fired, no-pr-command-without-number, asks-which-pr (3/3)       | 1/1 pass |
| `does-not-trigger-on-summary` | 1, then 2 | fix-it-not-fired, nothing-pushed-or-merged                      | 0/1, then 2/2 after the `fix-it` description gained its "do not use it to read, summarize, review" clause |

The six merge-gate and workflow cases (`hold-blocks-merge`,
`merges-on-fresh-head`, `queued-is-not-merged`, `requeues-after-pop`,
`escalates-after-three-removals`, `edits-copy-through-to-pr`) need a Bash
grant, which the eval sandbox refused on that machine because its Docker
credential store contains a symlink. Their fixtures pass `selftest.sh`; the
model runs are still owed, on a CI runner or a machine where
`claude plugin eval --allow-tools Bash` is accepted.
