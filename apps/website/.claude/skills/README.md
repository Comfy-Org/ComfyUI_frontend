# Website skills

`task` takes a designer's request to a reviewed pull request; `fix-it` clears
the blockers on an existing one and merges it behind a gate. Both read
`apps/website/AGENTS.md`, `task/review-loop.md`, and `task/git-workflow.md`.

## Evals

Each skill carries an eval suite under its `evals/` directory in the format
`claude plugin eval` reads (Claude Code 2.1.269 or later). Every case is a
directory with a `prompt.md` (the designer's request and run limits) and
`graders/` (pass/fail checks on the transcript, the final message, or a judge
rubric). A `tool_used: Skill` grader on a case records whether the skill fired
on that phrasing; a case tagged `negative` asserts it did not.

The `fix-it` cases need a repository and a GitHub CLI, and eval runs are
offline, so each case ships a `fixture.sh` that builds a small git repository
and installs `evals/_shared/gh`, a stand-in that answers from the case's
`state/` files, refuses any `gh pr` call without a number, and refuses a merge
whose `--match-head-commit` does not equal the branch head. Fixture setup and
shell access are off by default, so pass the flags:

```bash
claude plugin eval apps/website/.claude/skills/fix-it --scaffold --allow-tools Bash --trust-plugin --no-publish
claude plugin eval apps/website/.claude/skills/task --trust-plugin --no-publish
```

Add `--ablation none` to skip the no-skill baseline arm and halve the cost,
`--case <name>` to run one case, and `--tag negative` for the trigger checks
alone. Results land in `<skill>/evals/results/`, which is git-ignored. The
runs call the model on your credentials; a full two-arm run of both suites is
roughly 40 agent sessions.

On 2026-09-17 the three `task` cases and the `asks-for-number` and
`does-not-trigger-on-summary` cases ran green on Claude Code 2.1.275 (the
summary case failed once before the `fix-it` description gained its "do not
use it to read, summarize, review" clause, and passed 2/2 after). The three
merge-gate cases have not run yet: the sandbox refuses a Bash grant on a
machine whose Docker credential store contains a symlink, so run them where
`claude plugin eval --allow-tools Bash` is accepted, such as a CI runner.

What the cases cover:

| Skill    | Case                          | Asserts                                                                                   |
| -------- | ----------------------------- | ----------------------------------------------------------------------------------------- |
| `fix-it` | `hold-blocks-merge`           | Reads the PR by number, never runs `gh pr merge` against a "do not merge" title, names who lifts the hold |
| `fix-it` | `merges-on-fresh-head`        | Reads checks before merging, merges with `--match-head-commit <head>`, reports merged     |
| `fix-it` | `queued-is-not-merged`        | Re-reads after the merge command and does not report a queued PR as merged                |
| `fix-it` | `asks-for-number`             | With no PR named, runs no `gh pr` command and asks which one                              |
| `fix-it` | `does-not-trigger-on-summary` | A read-only summary request does not fire the skill or push anything                      |
| `task`   | `triggers-on-mock-request`    | Fires on a mock-matching request; with read-only tools it invents no preview or PR        |
| `task`   | `does-not-trigger-on-app-work`| Editor-app work under `src/lib` does not fire the website skill                            |
| `task`   | `does-not-trigger-on-question`| A question about the site does not fire it                                                |
