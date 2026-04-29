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

For Playwright tests, follow the `/writing-playwright-tests` skill for patterns, fixtures, and tags.

### Rules

- The test MUST fail against the current codebase (this is the whole point)
- Do NOT modify any source code outside of test files
- Do NOT include any fix, workaround, or behavioral change
- Do NOT add unrelated tests or refactor existing tests
- Keep the test minimal — only what is needed to reproduce the bug
- Avoid common anti-patterns — see `reference/testing-anti-patterns.md`

### Vitest Example

```typescript
// src/utils/pathUtil.test.ts
import { describe, expect, it } from 'vitest'
import { resolveModelPath } from './pathUtil'

describe('resolveModelPath', () => {
  it('handles absolute paths from folder_paths API', () => {
    const result = resolveModelPath(
      '/absolute/models',
      '/absolute/models/checkpoints'
    )
    expect(result).toBe('/absolute/models/checkpoints')
  })
})
```

### Playwright Example

```typescript
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'

test.describe('Model Download', { tag: ['@smoke'] }, () => {
  test('downloads model when path is absolute', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('missing-model')
    const downloadBtn = comfyPage.page.getByTestId('download-model-button')
    await downloadBtn.click()
    await expect(comfyPage.page.getByText('Download complete')).toBeVisible()
  })
})
```

### Verify Locally First

Run the test locally before pushing to confirm it fails for the right reason:

```bash
# Vitest
pnpm test:unit -- <test-file>

# Playwright
pnpm test:browser:local -- --grep "<test name>"
```

If the test passes locally, it does not reproduce the bug — revisit your test before pushing.

### Quality Checks and Commit

```bash
pnpm typecheck
pnpm lint
pnpm format:check

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
pnpm typecheck
pnpm lint
pnpm format

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

- Fixes #<issue-number>

## Red-Green Verification

| Commit | CI Status | Purpose |
|--------|-----------|---------|
| `test: ...` | :red_circle: Red | Proves the test catches the bug |
| `fix: ...` | :green_circle: Green | Proves the fix resolves the bug |

## Test Plan

- [ ] CI red on test-only commit
- [ ] CI green on fix commit
- [ ] Added/updated E2E regression under `browser_tests/` or explained why not applicable
- [ ] Manual verification (if applicable)
EOF
)"
```

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

| Resource              | Path                                               |
| --------------------- | -------------------------------------------------- |
| Unit test framework   | Vitest (`src/**/*.test.ts`)                        |
| E2E test framework    | Playwright (`browser_tests/tests/*.spec.ts`)       |
| E2E fixtures          | `browser_tests/fixtures/`                          |
| E2E assets            | `browser_tests/assets/`                            |
| Playwright skill      | `.claude/skills/writing-playwright-tests/SKILL.md` |
| Unit CI               | `.github/workflows/ci-tests-unit.yaml`             |
| E2E CI                | `.github/workflows/ci-tests-e2e.yaml`              |
| Lint CI               | `.github/workflows/ci-lint-format.yaml`            |
| Testing anti-patterns | `reference/testing-anti-patterns.md`               |
| Related skill         | `.claude/skills/perf-fix-with-proof/SKILL.md`      |
