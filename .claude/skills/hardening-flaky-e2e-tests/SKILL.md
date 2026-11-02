---
name: hardening-flaky-e2e-tests
description: 'Diagnoses and fixes flaky Playwright e2e tests by replacing race-prone patterns with retry-safe alternatives. Use when triaging CI flakes, hardening spec files, fixing timing races, or asked to stabilize browser tests. Triggers on: flaky, flake, harden, stabilize, race condition in e2e, intermittent failure.'
---

# Hardening Flaky E2E Tests

Fix flaky specs by finding the race and waiting on the real readiness boundary.
The general rules (never sleep, never weaken an assertion, read the history
before removing a guard) are in `docs/guidance/testing-principles.md`. The
assertion primitives, readiness boundaries, and the common flake patterns
table are in `docs/guidance/playwright.md` under "Flake prevention". This
skill is the workflow around them.

## 1. Gather CI evidence

```bash
gh run list --workflow="CI: Tests E2E" --branch=<branch> --limit=5
gh run download <run-id> -p 'playwright-report-*'
```

- Search each `report.json` for `"status": "flaky"`. A test that passed on
  retry still needs fixing; a green check is not evidence.
- Read `error-context.md`, the trace (`pnpm dlx playwright show-trace
trace.zip`), and page snapshots before editing code.
- Pull the newest run after each push; the flaky set changes.

## 2. Classify the flake

Match the failing assertion against the common flake patterns table in
`docs/guidance/playwright.md`. State the root cause as a race or readiness
mismatch before changing code. If no pattern fits, find the state the behavior
depends on and wait for it.

Before removing a wait, assertion, or guard you did not write, `git blame` the
line and read the commit that introduced it.

## 3. Fix narrowly

- Change timing and retry strategy only; the test's behavior stays the same.
- Keep the fix in the spec unless a shared helper owns the race. Do not encode
  one spec's timing into a generic helper.
- If a helper fails before the real test begins, relax the brittle
  precondition and let the downstream interaction prove readiness.

## 4. Verify narrowly

```bash
pnpm test:browser:local browser_tests/tests/<area>/<file>.spec.ts --repeat-each 10
pnpm test:browser:local browser_tests/tests/<area>/<file>.spec.ts:<line> --repeat-each 20
```

Prefer `file:line` over `--grep` on Windows. After pushing, watch the run:

```bash
gh run list --workflow="CI: Tests E2E" --branch=<branch> --limit=1 --json databaseId --jq '.[0].databaseId' | xargs gh run watch
```

If you changed a helper, also check `CI: Tests Unit`.

## 5. Pre-merge checklist

- [ ] The latest CI artifact was inspected directly
- [ ] The root cause is stated as a race or readiness mismatch
- [ ] The fix waits on the real readiness boundary
- [ ] The assertion primitive matches the job
- [ ] The fix stays local unless a shared helper owns the race
- [ ] A targeted rerun with `--repeat-each` passed
- [ ] The test's behavior is unchanged

## Local noise

Missing local input files or models, teardown `EPERM` while restoring the
user-data directory, and Windows screenshot diffs are not CI root causes.
Confirm whether one blocks the exact flaky path before acting. Never commit
temporary local assets or local screenshot baselines.
