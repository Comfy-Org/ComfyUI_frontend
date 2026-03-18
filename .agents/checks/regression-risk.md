---
name: regression-risk
description: Detects potential regressions by analyzing git blame history of modified lines
severity-default: high
tools: [Bash, Read, Grep]
---

Perform regression risk analysis on the current changes using git blame.

## Method

1. Determine the base branch by examining git context (e.g., `git merge-base origin/main HEAD`, or check the PR's target branch). Never use `HEAD~1` as the base — it compares against the PR's own prior commit and causes false positives.
2. Get the PR's own commits: `git log --format=%H <base>..HEAD`
3. For each changed file, run: `git diff <base>...HEAD -- <file>`
4. Extract the modified line ranges from the diff (lines removed or changed in the base version).
5. For each modified line range, check git blame in the base version:
   `git blame <base> -L <start>,<end> -- <file>`
6. Look for blame commits whose messages match bugfix patterns:
   - Contains: fix, bug, patch, hotfix, revert, regression, CVE
   - Ignore: "fix lint", "fix typo", "fix format", "fix style"
7. **Filter out false positives.** If the blamed commit SHA is in the PR's own commits, skip it.
8. For each verified bugfix line being modified, report as a finding.

## What to Report

For each finding, include:

- The file and line number
- The original bugfix commit (short SHA and subject)
- The date of the original fix
- A suggestion to verify the original bug scenario still works and to add a regression test if one doesn't exist

## Shallow Clone Limitations

When working with shallow clones, `git blame` may not have full history. If blame fails with "no such path in revision" or shows truncated history, report only findings where blame succeeds and note the limitation.

## Edge Cases

| Situation                | Action                           |
| ------------------------ | -------------------------------- |
| Shallow clone (no blame) | Report what succeeds, note limit |
| Blame shows PR's own SHA | Skip finding (false positive)    |
| File renamed             | Try blame with `--follow`        |
| Binary file              | Skip file                        |
