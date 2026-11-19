---
name: red-green-fix
description: 'Bug fix workflow that proves test validity with a red-then-green CI sequence. Commits a failing test first (CI red), then the minimal fix (CI green). Use when fixing a bug, writing a regression test, or when asked to prove a fix works.'
---

# Red-Green Fix

Fixes bugs as two commits so CI automatically proves the test catches the bug.

## Why Two Commits

If you commit the test and fix together, the test always passes — reviewers cannot tell whether the test actually detects the bug or is a no-op. Splitting into two commits creates a verifiable CI trail:

1. **Commit 1 (test-only)** — adds a test that exercises the bug. CI runs it → test fails → red X.
2. **Commit 2 (fix)** — adds the minimal fix. CI runs the same test → test passes → green check.

The red-then-green sequence in the commit history proves the test is valid.

## Input

The user provides a bug description as an argument. If no description is given, ask the user to describe the bug before proceeding.

Bug description: $ARGUMENTS

## Step 0 — Setup

Create an isolated branch from main:

```bash
git fetch origin main
git checkout -b fix/<bug-name> origin/main
```

## Step 1 — Red: Failing Test Only

Write a test that reproduces the bug. **Do NOT write any fix code.**

### Choosing the Test Framework

| Bug type                          | Framework  | File location                   |
| --------------------------------- | ---------- | ------------------------------- |
| Logic, utils, stores, composables | Vitest     | `src/**/*.test.ts` (colocated)  |
| UI interaction, canvas, workflows | Playwright | `browser_tests/tests/*.spec.ts` |

Follow `docs/guidance/testing-principles.md` for test design, `docs/guidance/vitest.md` for unit tests, and the `/writing-playwright-tests` skill for Playwright patterns, fixtures, and tags.

### Rules

- The test MUST fail against the current codebase (this is the whole point)
- Do NOT modify any source code outside of test files
- Do NOT include any fix, workaround, or behavioral change
- Do NOT add unrelated tests or refactor existing tests
- Keep the test minimal — only what is needed to reproduce the bug

### Verify Locally First

Run the test locally before pushing to confirm it fails for the right reason:

```bash
pnpm test:unit <test-file>
pnpm test:browser:local -- --grep "<test name>"
```

The first runs a Vitest file; the second runs a Playwright test against a local backend (see `browser_tests/README.md` for setup).

If the test passes locally, it does not reproduce the bug — revisit your test before pushing.

### Quality Checks and Commit

Check only the files you changed. Do not run repo-wide `pnpm lint`, `pnpm typecheck` or `pnpm format`; the pre-commit hook formats, lints and typechecks what you stage, and CI runs the rest.

```bash
git add <test-files-only>
pnpm lint:unstaged:fix
git add <test-files-only>
git commit -m "test: add failing test for <concise bug description>"
git push -u origin HEAD
```

### Verify CI Failure

```bash
gh run list --branch $(git branch --show-current) --limit 1
```

**STOP HERE.** Inform the user of the CI status and wait for confirmation before proceeding to Step 2.

- If CI passes: the test does not catch the bug. Revisit the test.
- If CI fails for unrelated reasons: investigate and fix the test setup, not the bug.
- If CI fails because the test correctly catches the bug: proceed to Step 2.

## Step 2 — Green: Minimal Fix

Write the minimum code change needed to make the failing test pass.

### Rules

- Do NOT modify, weaken, or delete the test from Step 1 — it is immutable. If the test needs changes, restart from Step 1 and re-prove the red.
- Do NOT add new tests (tests were finalized in Step 1)
- Do NOT refactor, clean up, or make "drive-by" improvements
- Do NOT modify code unrelated to the bug
- The fix should be the smallest correct change

### Quality Checks and Commit

```bash
git add <fix-files-only>
pnpm lint:unstaged:fix
git add <fix-files-only>
git commit -m "fix: <concise bug description>"
git push
```

### Verify CI Pass

```bash
gh run list --branch $(git branch --show-current) --limit 1
```

- If CI passes: the fix is verified. Proceed to PR creation.
- If CI fails: investigate and fix. Do NOT change the test from Step 1.

## Step 3 — Open Pull Request

```bash
gh pr create --title "fix: <description>" --body "$(cat <<'EOF'
## Summary

<Brief explanation of the bug and root cause>

Fixes #<issue-number>

## Verification

- `test: ...` commit: CI red, proving the test catches the bug
- `fix: ...` commit: CI green, proving the fix resolves it
EOF
)"
```

The body follows `.github/pull_request_template.md`.

## Gotchas

### CI fails on test commit for unrelated reasons

Lint, typecheck, or other tests may fail — not just your new test. Check the CI logs carefully. If the failure is unrelated, fix it in a separate commit before the `test:` commit so the red X is clearly attributable to your test.

### Test passes when it should fail

The bug may only manifest under specific conditions (e.g., Windows paths, external model directories, certain workflow structures). Make sure your test setup matches the actual bug scenario. Check that you're not accidentally testing the happy path.

### Flaky Playwright tests

If your e2e test is intermittent, it doesn't prove anything. Use retrying assertions (`toBeVisible`, `toHaveText`) instead of `waitForTimeout`. See the `/writing-playwright-tests` skill for anti-patterns.

### Pre-existing CI failures on main

If main itself is red, branch from the last green commit or fix the pre-existing failure first. A red-green proof is meaningless if the baseline is already red.

## Reference

| Resource            | Path                                               |
| ------------------- | -------------------------------------------------- |
| Unit test framework | Vitest (`src/**/*.test.ts`)                        |
| E2E test framework  | Playwright (`browser_tests/tests/*.spec.ts`)       |
| E2E fixtures        | `browser_tests/fixtures/`                          |
| E2E assets          | `browser_tests/assets/`                            |
| Playwright skill    | `.claude/skills/writing-playwright-tests/SKILL.md` |
| Unit CI             | `.github/workflows/ci-tests-unit.yaml`             |
| E2E CI              | `.github/workflows/ci-tests-e2e.yaml`              |
| Lint CI             | `.github/workflows/ci-lint-format.yaml`            |
| Testing principles  | `docs/guidance/testing-principles.md`              |
| Related skill       | `.claude/skills/perf-fix-with-proof/SKILL.md`      |
