---
name: reviewing-unit-tests
description: Use when reviewing Vitest unit-test diffs in ComfyUI_frontend, especially new mocks, store tests, component tests, or bugfix regression tests.
---

# Reviewing Unit Tests for ComfyUI_frontend

## Overview

Review for behavior and current repo rules, not motion. Compare to authoritative rules, not prior diffs or legacy snippets.

## Review Workflow

1. Identify the test type: component, store, composable, util, or bugfix regression.
2. Name the behavior the test proves. If you cannot say it in one sentence, request changes.
3. Open the authoritative doc section before judging structure.
4. Scan the red flags below.
5. State the verdict first. Name the failure mode. Cite the doc or rule.

## Source of Truth / Precedence

When docs and examples conflict, use this order:

1. Explicit repo rules, lint rules, and note blocks.
2. [`docs/testing/vitest-patterns.md`](../../../docs/testing/vitest-patterns.md)
3. Rule sections in [`docs/testing/unit-testing.md`](../../../docs/testing/unit-testing.md), [`docs/testing/store-testing.md`](../../../docs/testing/store-testing.md), and [`docs/testing/component-testing.md`](../../../docs/testing/component-testing.md)
4. Example snippets
5. Prior diffs

Apply these repo-specific clarifications:

- [`docs/testing/component-testing.md`](../../../docs/testing/component-testing.md) starts with the authoritative rule: new component tests use `@testing-library/vue` with `@testing-library/user-event`. The `@vue/test-utils` snippets below it are legacy examples.
- [`docs/testing/store-testing.md`](../../../docs/testing/store-testing.md) still contains `as any` examples. Treat them as legacy snippets, not approval for new or edited test code.
- If docs conflict, prefer the stricter newer rule and call out the doc ambiguity. Do not approve through it.
- Motion != fix.

## 30-Second Red Flags

| If you see...                                                                             | Failure mode                    | Default action                                                |
| ----------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------- |
| New `@vue/test-utils` import in a new component test                                      | legacy test API                 | Request changes                                               |
| `vi.mock('vue-i18n', ...)`                                                                | mocked i18n                     | Request changes                                               |
| `as any`, `@ts-expect-error`, `as Mock`, `as ReturnType<typeof vi.fn>`, `as unknown as X` | unnecessary cast or type escape | Request changes unless the author proves no safer type exists |
| `getXMock()`, renamed wrapper, or helper that only returns a mocked value                 | alias-by-renaming               | Request changes                                               |
| `beforeEach` recreates the return object for a module-mocked composable or service        | shared mock setup drift         | Request changes                                               |
| Assertions only check defaults, mock plumbing, or CSS hooks                               | non-behavioral test             | Request changes                                               |
| Bugfix test has no proof it fails on pre-fix code                                         | unproven regression             | Request changes                                               |

## Rationalization Table

| Excuse                              | Reality                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| "I restructured the mocks"          | If the indirection stayed, nothing improved. Flag `alias-by-renaming`.                                 |
| "The docs do it"                    | Rule, note, and lint beat legacy snippet. Compare to the current rule, not the nearest example.        |
| "TypeScript required the cast"      | `vi.mocked()` usually narrows mock methods. Assertion-only references need no cast.                    |
| "Putting it in `beforeEach` is DRY" | Recreating module mock state in hooks hides singleton behavior and drifts from the documented pattern. |
| "It is only a nit"                  | Explicit repo-rule violations are never nits.                                                          |
| "No behavior changed, just cleanup" | Motion != fix. Ask what behavior got stronger.                                                         |
| "Mental revert is enough"           | For bugfix tests, establish red on pre-fix code or ask the author to show it.                          |

## Mocking Rules

- Fail helpers that do not remove repeated setup, encode domain meaning, or simplify assertions. Barely earning the abstraction is not enough.
- For composables with reactive or singleton state, define stable mock state inside the `vi.mock()` factory. Access it per test via the composable itself. See [`docs/testing/unit-testing.md`](../../../docs/testing/unit-testing.md) "Mocking Composables with Reactive State".
- This does not ban local test data builders or per-test `vi.spyOn(...)`.
- Mock seams, not the project-owned module you are trying to exercise. For store tests, prefer real Pinia plus `createTestingPinia({ stubActions: false })` per [`docs/testing/vitest-patterns.md`](../../../docs/testing/vitest-patterns.md) and [`docs/testing/store-testing.md`](../../../docs/testing/store-testing.md).

### Alias-by-Renaming

```ts
// Before
const mockAdd = vi.hoisted(() => vi.fn())

// After: same indirection, new name
function getToastAddMock() {
  return useToast().add
}
```

If the wrapper only renames or relays a mocked value, fail it. Inline the lookup at the call site or fetch the singleton mock via the documented pattern.

### `vi.mocked()` Scope

| Use case                                                        | `vi.mocked()` required? |
| --------------------------------------------------------------- | ----------------------- |
| `.mockReturnValue`, `.mockResolvedValue`, `.mockImplementation` | Yes                     |
| `.mock.calls`, `.mock.results`                                  | Yes                     |
| `expect(fn).toHaveBeenCalled()`                                 | No                      |
| `expect(fn).toHaveBeenCalledWith(...)`                          | No                      |

- Flag casts whenever `vi.mocked()` would narrow correctly.
- Do not add `vi.mocked()` around assertion-only references just for style.

### Reset Hygiene

- Flag per-mock `mockClear()` or `mockReset()` when `vi.clearAllMocks()` or `vi.resetAllMocks()` already runs in the relevant hook chain.
- Review for redundancy or broken state management. Do not bikeshed `clearAllMocks` vs `resetAllMocks` unless behavior depends on it.

### Third-Party Seams

- Distinguish trivial hooks from behavior-rich APIs.
- Mocking single-method third-party hooks like `primevue/usetoast` is usually acceptable.
- That exception does not justify mocking behavior-rich third-party modules.

### `vue-i18n`

- Never mock `vue-i18n` in component tests.
- Use real `createI18n` per [`docs/testing/vitest-patterns.md`](../../../docs/testing/vitest-patterns.md) and the shared [`testI18n`](../../../src/components/searchbox/v2/__test__/testUtils.ts) setup.

## Test-Body Rules

| Smell                                                             | Review bar                                                                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Change-detector test                                              | Reject. Default values alone prove nothing.                                                                                                   |
| Mock-only assertion                                               | Accept collaborator-call assertions only when the call is the meaningful external effect and the test also exercises the triggering behavior. |
| Non-behavioral assertion                                          | Reject tests that only check classes, utility hooks, or styling internals.                                                                    |
| New component test using `@vue/test-utils`                        | Request changes. Use `@testing-library/vue` plus `@testing-library/user-event`.                                                               |
| `any`, `as any`, or `@ts-expect-error` in new or edited test code | Request changes unless the author proves no safer type exists. Legacy doc snippets do not authorize it.                                       |

## Bugfix Regression Proof

For `fix:` PRs or bugfix diffs:

1. Identify the production change that fixes the bug.
2. Verify the new test fails on pre-fix code, or ask the author to show it.
3. If the test passes on broken code, request changes.

A regression test that never proves red does not pin the bug.

## Review Output Rules

- State verdict before procedural questions.
- Do not lead with approval language like `LGTM, just one nit` or `approve and move on?`.
- Name the failure mode directly: `alias-by-renaming`, `unnecessary cast`, `mocked i18n`, `mock-only assertion`, `unproven regression`.
- Link the authoritative doc section in the review comment.
- If an explicit repo rule, lint rule, or authoritative doc note is violated, do not downgrade it to "minor deviation" or "nit".

## Quick Reference

| When you see...                     | Read this                                                                                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New `vi.mock(...)` for a composable | [`docs/testing/unit-testing.md`](../../../docs/testing/unit-testing.md) -> "Mocking Composables with Reactive State"                                                                              |
| New store test or store mock        | [`docs/testing/vitest-patterns.md`](../../../docs/testing/vitest-patterns.md) setup + [`docs/testing/store-testing.md`](../../../docs/testing/store-testing.md)                                   |
| New component test                  | Top note in [`docs/testing/component-testing.md`](../../../docs/testing/component-testing.md)                                                                                                     |
| `vue-i18n` in a component test      | [`docs/testing/vitest-patterns.md`](../../../docs/testing/vitest-patterns.md) + [`src/components/searchbox/v2/__test__/testUtils.ts`](../../../src/components/searchbox/v2/__test__/testUtils.ts) |
| Cast around a mock                  | [`docs/guidance/typescript.md`](../../../docs/guidance/typescript.md) -> "Type Assertion Hierarchy"                                                                                               |

## Key Files to Read

| Purpose                              | Path                                                                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Composable mocking patterns          | [`docs/testing/unit-testing.md`](../../../docs/testing/unit-testing.md)                                           |
| Store testing patterns               | [`docs/testing/store-testing.md`](../../../docs/testing/store-testing.md)                                         |
| Repo-wide Vitest setup defaults      | [`docs/testing/vitest-patterns.md`](../../../docs/testing/vitest-patterns.md)                                     |
| Component testing rule for new tests | [`docs/testing/component-testing.md`](../../../docs/testing/component-testing.md)                                 |
| Real i18n setup                      | [`src/components/searchbox/v2/__test__/testUtils.ts`](../../../src/components/searchbox/v2/__test__/testUtils.ts) |
