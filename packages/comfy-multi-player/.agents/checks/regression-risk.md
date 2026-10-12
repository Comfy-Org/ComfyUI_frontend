# Regression-risk review (git blame)

Detect regressions by checking whether changed lines were previously touched by a bugfix. Applies to any `src/**` change.

## Method

1. Establish the base with `git merge-base origin/main HEAD`. Never use `HEAD~1` as the base (it compares against the PR's own prior commit and yields false positives).
2. Collect the PR's own commits: `git log --format=%H <base>..HEAD`.
3. For each changed file: `git diff <base>...HEAD -- <file>`, extract the modified/removed line ranges in the base version.
4. For each range: `git blame <base> -L <start>,<end> -- <file>`.
5. Flag blame commits whose subjects match bugfix patterns (`fix`, `bug`, `patch`, `hotfix`, `revert`, `regression`, `CVE`); ignore `fix lint`/`fix typo`/`fix format`/`fix style`.
6. Skip any blamed SHA that is one of the PR's own commits (false positive).
7. For each verified bugfix line being changed, report it and ask the author to confirm the original bug scenario still holds and that a regression test covers it.

## Repo-specific emphasis

- CRDT correctness regressions are silent and expensive. Give extra scrutiny to blame hits in `applier.ts`, `stamps.ts`, `project.ts`, and `mint.ts`, and to anything touching the `[base_version, actor, op_id]` order, idempotency ledger, LWW gate, or catalog pinning.
- If a changed line traces to a fix for a convergence, idempotency, ordering, or fail-closed bug, require the corresponding fixture/property/edge test to still exercise that scenario, and cite the affected KA-*/FC-* ID.

## Edge cases

| Situation                | Action                              |
| ------------------------ | ----------------------------------- |
| Shallow clone (no blame) | Report INCONCLUSIVE for the files blame could not cover; never report "no regression risk" from a blame that produced no history |
| `git merge-base origin/main HEAD` fails | Fetch `origin/main` and retry; if it still fails, report INCONCLUSIVE. An empty diff from a bad base looks identical to a clean one |
| Blame shows PR's own SHA | Skip (false positive)               |
| File renamed             | Retry blame with `--follow`         |

> Before reporting PASS for any check above, apply [vacuity.md](vacuity.md): P0 to every check, P1 to any guard this change adds, P10 to what that guard's test asserts on, P2 to any tool you ran, and P7 to any run you quote.
