---
name: reviewing-unit-tests
description: Use when reviewing Vitest unit-test diffs in ComfyUI_frontend, especially new mocks, store tests, component tests, or bugfix regression tests.
---

# Reviewing Unit Tests for ComfyUI_frontend

## Overview

Review for behavior and current repo rules, not motion. Compare to authoritative rules, not prior diffs or legacy snippets.

## Review Workflow

1. Inventory shared test utilities before reading the diff. See "Inventory Before Reading".
2. Identify the test type: component, store, composable, util, or bugfix regression.
3. Name the behavior the test proves. If you cannot say it in one sentence, request changes.
4. Open the authoritative doc section before judging structure.
5. Scan the red flags below.
6. State the verdict first. Name the failure mode. Cite the doc or rule.

### Inventory Before Reading

List the shared factories, shared automocks, global stubs, and reuse rules before judging any setup in the diff:

```bash
rg --files src | rg -i 'testutils\.ts$'
rg --files src __mocks__ | rg '__mocks__/'
rg -n -i '\breuse|instead of hand-rolling' docs/testing/*.md
```

Also read [`vitest.setup.ts`](../../../vitest.setup.ts) for global stubs and polyfills.

A stub for a missing global (`Path2D`, `ResizeObserver`, canvas `getContext`) repeated in two or more test files is a finding. It belongs in the shared setup or a shared util, not per file.

## Source of Truth / Precedence

When docs and examples conflict, use this order:

1. Explicit repo rules, lint rules, and note blocks.
2. [`docs/guidance/testing-principles.md`](../../../docs/guidance/testing-principles.md) for design rules that apply at every test level.
3. [`docs/testing/vitest-patterns.md`](../../../docs/testing/vitest-patterns.md)
4. Rule sections in [`docs/testing/unit-testing.md`](../../../docs/testing/unit-testing.md), [`docs/testing/store-testing.md`](../../../docs/testing/store-testing.md), and [`docs/testing/component-testing.md`](../../../docs/testing/component-testing.md)
5. Example snippets
6. Prior diffs

Apply these repo-specific clarifications:

- [`docs/testing/component-testing.md`](../../../docs/testing/component-testing.md) starts with the authoritative rule: new component tests use `@testing-library/vue` with `@testing-library/user-event`. The `@vue/test-utils` snippets below it are legacy examples.
- [`docs/testing/store-testing.md`](../../../docs/testing/store-testing.md) still contains `as any` examples. Treat them as legacy snippets, not approval for new or edited test code.
- If docs conflict, prefer the stricter newer rule and call out the doc ambiguity. Do not approve through it.
- Motion != fix.

## 30-Second Red Flags

| If you see...                                                                                                                                                                                            | Failure mode                    | Default action                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| New `@vue/test-utils` import in a new component test                                                                                                                                                     | legacy test API                 | Request changes                                                                                       |
| `vi.mock('vue-i18n', ...)`                                                                                                                                                                               | mocked i18n                     | Request changes                                                                                       |
| `as any`, `@ts-expect-error`, `as Mock`, `as ReturnType<typeof vi.fn>`, `as unknown as X`                                                                                                                | unnecessary cast or type escape | Request changes unless the author proves no safer type exists                                         |
| `getXMock()`, renamed wrapper, or helper that only returns a mocked value                                                                                                                                | alias-by-renaming               | Request changes                                                                                       |
| `beforeEach` recreates the return object for a module-mocked composable or service                                                                                                                       | shared mock setup drift         | Request changes                                                                                       |
| Assertions only check defaults, mock plumbing, or CSS hooks                                                                                                                                              | non-behavioral test             | Request changes                                                                                       |
| Bugfix test has no proof it fails on pre-fix code                                                                                                                                                        | unproven regression             | Request changes                                                                                       |
| Hand-rolled canvas/graph/node/subgraph/workflow fixture or mock when [`litegraphTestUtils.ts`](../../../src/utils/__tests__/litegraphTestUtils.ts) or another shared `*testUtils.ts` already provides it | duplicated fixture              | Request changes, point at the shared factory                                                          |
| More than three mocks in one file (`vi.mock`, `vi.fn`, `vi.spyOn`, hand-built fakes), excluding shared automocks                                                                                         | possible over-mocking           | Ask what owned behavior still runs. Request changes only if none does or a double replaces owned code |
| Test rebuilds production logic (scheduler loop, rAF queue, state machine) or computes the expected value with the logic under test                                                                       | replicated logic                | Request changes, exercise the real code                                                               |
| Hand-rolled runner primitive: `Object.defineProperty` write counters, global save/restore in `try/finally`, `if (arg === ...)` mock ladders                                                              | hand-rolled runner primitive    | Request changes: `vi.spyOn(obj, 'prop', 'set')`, `vi.stubGlobal`, `vi.when`                           |

## Rationalization Table

| Excuse                                    | Reality                                                                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| "I restructured the mocks"                | If the indirection stayed, nothing improved. Flag `alias-by-renaming`.                                                                  |
| "The docs do it"                          | Rule, note, and lint beat legacy snippet. Compare to the current rule, not the nearest example.                                         |
| "TypeScript required the cast"            | `vi.mocked()` usually narrows mock methods. Assertion-only references need no cast.                                                     |
| "Putting it in `beforeEach` is DRY"       | Recreating module mock state in hooks hides singleton behavior and drifts from the documented pattern.                                  |
| "The real collaborator is hard to set up" | Use the shared factory. If none exists, the missing factory is the finding, not a reason to mock.                                       |
| "Mocks keep the test isolated"            | Desiderata isolation means tests do not affect each other. Faking owned code gives up predictive and structure-insensitive for nothing. |
| "It is only a nit"                        | Explicit repo-rule violations are never nits.                                                                                           |
| "No behavior changed, just cleanup"       | Motion != fix. Ask what behavior got stronger.                                                                                          |
| "Mental revert is enough"                 | For bugfix tests, establish red on pre-fix code or ask the author to show it.                                                           |

## Mocking Rules

- Fail helpers that do not remove repeated setup, encode domain meaning, or simplify assertions. Barely earning the abstraction is not enough.
- For composables with reactive or singleton state, define stable mock state inside the `vi.mock()` factory. Access it per test via the composable itself. See [`docs/testing/unit-testing.md`](../../../docs/testing/unit-testing.md) "Mocking Composables with Reactive State".
- This does not ban local test data builders or per-test `vi.spyOn(...)`.
- Mock seams, not the project-owned module you are trying to exercise. Default to real collaborators and shared factories per [`docs/guidance/testing-principles.md`](../../../docs/guidance/testing-principles.md) "Doubles: real collaborators first". For store tests, use real stores on the testing Pinia that [`vitest.setup.ts`](../../../vitest.setup.ts) activates before each test. Flag any test that creates its own Pinia or mocks `pinia`. Audited concurrent store tests use the per-test `pinia` fixture. See [`docs/testing/store-testing.md`](../../../docs/testing/store-testing.md) and [`docs/testing/vitest-patterns.md`](../../../docs/testing/vitest-patterns.md).

### Over-Mocking and Replicated Logic

- Count `vi.mock`, `vi.fn`, `vi.spyOn`, and hand-built fakes per file. Above three, ask what the test still proves about owned code. The count is a signal, not a verdict. Boundary doubles around exercised owned code are fine. Request changes when no owned behavior runs or a double replaces owned code.
- Do not count shared automocks: a factory-less `vi.mock(import('…'))` that activates a `__mocks__/` file, plus `vi.mocked(...)` configuration of it, per [`docs/guidance/vitest.md`](../../../docs/guidance/vitest.md) "Shared manual mocks". The exemption covers the count only. Automocking the module under test is still a finding.
- A hand-written `vi.mock` factory for a module that already has a `__mocks__/` file is a `duplicated fixture`.
- Deletion test: imagine deleting the production wiring. If every test still passes, nothing covers it.
- A test that re-implements the code it covers passes on bugs that both copies share. Request the real module plus a double at its true boundary (network, clock, `reportError`).
- Name the Desiderata property the test gives up, usually predictive, behavioral, or structure-insensitive. See [`docs/guidance/testing-principles.md`](../../../docs/guidance/testing-principles.md) "Judge every test by Beck's Test Desiderata".

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

- [`vite.config.mts`](../../../vite.config.mts) sets `mockReset`, `restoreMocks`, `unstubEnvs`, and `unstubGlobals`. Flag manual resets, restores, and global save/restore that duplicate them.
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
- Name the failure mode directly: `alias-by-renaming`, `unnecessary cast`, `mocked i18n`, `mock-only assertion`, `unproven regression`, `duplicated fixture`, `over-mocking`, `replicated logic`, `hand-rolled runner primitive`.
- Link the authoritative doc section in the review comment.
- If an explicit repo rule, lint rule, or authoritative doc note is violated, do not downgrade it to "minor deviation" or "nit".

## Quick Reference

| When you see...                            | Read this                                                                                                                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New `vi.mock(...)` for a composable        | [`docs/testing/unit-testing.md`](../../../docs/testing/unit-testing.md) -> "Mocking Composables with Reactive State"                                                                                        |
| New store test or store mock               | [`docs/testing/vitest-patterns.md`](../../../docs/testing/vitest-patterns.md) setup + [`docs/testing/store-testing.md`](../../../docs/testing/store-testing.md)                                             |
| New component test                         | Top note in [`docs/testing/component-testing.md`](../../../docs/testing/component-testing.md)                                                                                                               |
| `vue-i18n` in a component test             | [`docs/testing/vitest-patterns.md`](../../../docs/testing/vitest-patterns.md) + [`src/components/searchbox/v2/__test__/testUtils.ts`](../../../src/components/searchbox/v2/__test__/testUtils.ts)           |
| New LiteGraph node/canvas/graph test setup | [`docs/testing/litegraph-testing.md`](../../../docs/testing/litegraph-testing.md) -> "Shared Factories" + [`src/utils/__tests__/litegraphTestUtils.ts`](../../../src/utils/__tests__/litegraphTestUtils.ts) |
| Cast around a mock                         | [`docs/guidance/typescript.md`](../../../docs/guidance/typescript.md) -> "Type Assertion Hierarchy"                                                                                                         |

## Key Files to Read

| Purpose                              | Path                                                                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Composable mocking patterns          | [`docs/testing/unit-testing.md`](../../../docs/testing/unit-testing.md)                                           |
| Store testing patterns               | [`docs/testing/store-testing.md`](../../../docs/testing/store-testing.md)                                         |
| Repo-wide Vitest setup defaults      | [`docs/testing/vitest-patterns.md`](../../../docs/testing/vitest-patterns.md)                                     |
| Component testing rule for new tests | [`docs/testing/component-testing.md`](../../../docs/testing/component-testing.md)                                 |
| LiteGraph test patterns              | [`docs/testing/litegraph-testing.md`](../../../docs/testing/litegraph-testing.md)                                 |
| Shared LiteGraph factories           | [`src/utils/__tests__/litegraphTestUtils.ts`](../../../src/utils/__tests__/litegraphTestUtils.ts)                 |
| Real i18n setup                      | [`src/components/searchbox/v2/__test__/testUtils.ts`](../../../src/components/searchbox/v2/__test__/testUtils.ts) |
