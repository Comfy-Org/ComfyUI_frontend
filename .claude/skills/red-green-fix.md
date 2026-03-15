---
name: red-green-fix
description: Bug fix workflow that proves test validity by committing a failing test first (red), then the fix (green)
---

# Red-Green Fix

You are performing a bug fix using the **red-green commit pattern**. This pattern proves to reviewers that the test genuinely catches the bug by showing a CI failure before the fix is applied.

## Input

The user provides a bug description as an argument. If no description is given, ask the user to describe the bug before proceeding.

Bug description: $ARGUMENTS

## Step 1 — Red: Failing Test Only

Write a test that reproduces the bug. **Do NOT write any fix code.**

### Rules

- The test MUST fail against the current codebase (this is the whole point)
- Do NOT modify any source code outside of test files
- Do NOT include any fix, workaround, or behavioral change
- Do NOT add unrelated tests or refactor existing tests
- Keep the test minimal — only what is needed to reproduce the bug

### Commit and Push

1. Stage only the test file(s)
2. Commit with message: `test: add failing test for <concise bug description>`
3. Push to remote

```
git add <test-files-only>
git commit -m "test: add failing test for <description>"
git push -u origin HEAD
```

### Verify CI Failure

After pushing, check that CI **fails** (red X):

```
gh run list --branch $(git branch --show-current) --limit 1
```

**STOP HERE.** Inform the user of the CI status and wait for confirmation before proceeding to Step 2.

- If CI passes: the test does not catch the bug. Revisit the test.
- If CI fails for unrelated reasons: investigate and fix the test setup, not the bug.
- If CI fails because the test correctly catches the bug: proceed to Step 2.

## Step 2 — Green: Minimal Fix

Write the minimum code change needed to make the failing test pass.

### Rules

- Do NOT add new tests (tests were finalized in Step 1)
- Do NOT refactor, clean up, or make "drive-by" improvements
- Do NOT modify code unrelated to the bug
- The fix should be the smallest correct change

### Commit and Push

1. Stage only the fix file(s)
2. Commit with message: `fix: <concise bug description>`
3. Push to remote

```
git add <fix-files-only>
git commit -m "fix: <description>"
git push
```

### Verify CI Pass

After pushing, check that CI **passes** (green check):

```
gh run list --branch $(git branch --show-current) --limit 1
```

- If CI passes: the fix is verified. Proceed to PR creation.
- If CI fails: investigate and fix. Do NOT change the test from Step 1.

## Step 3 — Open Pull Request

Create a PR that highlights the red-green pattern:

```
gh pr create --title "fix: <description>" --body "$(cat <<'EOF'
## Summary

<Brief explanation of the bug and root cause>

## Red-Green Verification

| Commit | CI Status | Purpose |
|--------|-----------|---------|
| `test: ...` | :red_circle: Red | Proves the test catches the bug |
| `fix: ...` | :green_circle: Green | Proves the fix resolves the bug |

## Test Plan

- [ ] CI red on test-only commit
- [ ] CI green on fix commit
- [ ] Manual verification (if applicable)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
