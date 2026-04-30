---
name: reviewing-unit-tests
description: 'Reviews Vitest unit tests in PR diffs for ComfyUI_frontend. Use when reviewing changes to *.test.ts, evaluating test refactors, or auditing new mock setups against documented patterns. Triggers on: review unit test, review .test.ts, review vitest, code review test diff, audit test mocks.'
---

# Reviewing Unit Tests for ComfyUI_frontend

## Golden Rules

1. **Compare structure to docs, not to prior diff.** Motion ≠ fix. Read [`docs/testing/unit-testing.md`](../../../docs/testing/unit-testing.md) and [`docs/testing/store-testing.md`](../../../docs/testing/store-testing.md) before judging a mock setup.
2. **State verdict before asking how to proceed.** No leading-close framings (`LGTM, just one nit`, `approve and move on?`) — they bias toward thread-closure before evaluation finishes. Surface analysis upfront; if the user must pry, the review failed.
3. **Documented-rule violation is never a nit.** Severity tracks the doc, not the line count.
4. **`Barely earns its abstraction` = fail.** Don't grade indirection on a curve.
5. **For bugfix PRs, confirm new tests would fail against pre-fix code.** A regression test that passes on broken HEAD proves nothing.

## Renaming ≠ Restructuring

A wrapper with a new name is the same wrapper. The most common smell that gets rubber-stamped is **alias-by-renaming**: a refactor that swaps one indirection layer for another wrapping the same value.

```ts
// Before — module-level alias `const`
const getStore = () => useFooStore()

// After — module-level helper `function`. SAME indirection.
function getStore() {
  return useFooStore()
}
```

```ts
// Before — vi.hoisted() module-scope alias
const mockAdd = vi.hoisted(() => vi.fn())
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: mockAdd }) }))

// After — module-level helper returning the wrapped value. SAME indirection.
function getToastAddMock(): ReturnType<typeof vi.fn> {
  return useToast().add as ReturnType<typeof vi.fn>
}
```

If the indirection is preserved, flag it. The fix is to **define mocks in the `vi.mock()` factory and access them inline via destructuring** (`const { add } = useToast()`) per the "Mocking Composables with Reactive State" pattern in `docs/testing/unit-testing.md`.

## `vi.mocked()` Scope

`vi.mocked()` is **only** required when you call `MockInstance` methods or read mock state:

| Use case                                                          | `vi.mocked()` required?                   |
| ----------------------------------------------------------------- | ----------------------------------------- |
| `.mockReturnValue` / `.mockResolvedValue` / `.mockImplementation` | Yes                                       |
| `.mock.calls` / `.mock.results`                                   | Yes                                       |
| `expect(fn).toHaveBeenCalled()`                                   | **No** — plain reference type-checks fine |
| `expect(fn).toHaveBeenCalledWith(...)`                            | **No**                                    |

```ts
vi.mocked(api.fetch).mockResolvedValue(data) // needed: mock method
expect(api.fetch).toHaveBeenCalledWith(id) // NOT needed: assertion only
```

Flag stray `as Mock`, `as ReturnType<typeof vi.fn>`, or `as unknown as X` casts whenever `vi.mocked()` would narrow correctly. Type assertions are a last resort (see [`docs/guidance/typescript.md`](../../../docs/guidance/typescript.md) "Type Assertion Hierarchy").

## Mocking Smells Checklist

Run this checklist against every mock-touching diff:

| Smell                                                                                         | Fix / Reference                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mocks defined in `beforeEach` with shared module-scope variables                              | Move mock instances into `vi.mock()` factory; access via singleton lookup. See `unit-testing.md` "Mocking Composables with Reactive State".                                                                                                    |
| Module-level helper functions wrapping mocked composable returns (`getXMock()`)               | Alias-by-renaming. Inline `const { x } = useY()` at call site.                                                                                                                                                                                 |
| `as Mock` / `as ReturnType<typeof vi.fn>` / `as unknown as ...` to access mock methods        | Use `vi.mocked()` for type narrowing. No cast needed for assertions.                                                                                                                                                                           |
| `vi.mock('vue-i18n', ...)` — mocking i18n entirely                                            | **Don't mock vue-i18n.** Mount real `createI18n` plugin. See `docs/testing/vitest-patterns.md` and the shared `testI18n` in [`src/components/searchbox/v2/__test__/testUtils.ts`](../../../src/components/searchbox/v2/__test__/testUtils.ts). |
| `mockClear()` / `mockReset()` inside test bodies when `vi.clearAllMocks()` is in `beforeEach` | Redundant — drop the inner reset.                                                                                                                                                                                                              |
| Mocking modules the project owns (own composables, own stores) without justification          | Mock seams, not internals. Prefer real Pinia + `createTestingPinia({ stubActions: false })`. See `store-testing.md`.                                                                                                                           |

**Distinguish:** mocking trivially-shaped third-party hooks like `primevue/usetoast` is acceptable — that surface is owned-by-third-party but cheap to fake. The principle "Don't Mock What You Don't Own" applies to _behavior-rich_ third-party APIs, not single-method composables.

## Test-Body Smells

| Smell                                                 | What to flag                                                                                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Change-detector tests                                 | Asserts default values exist. No behavior covered. Reject.                                                                                     |
| Mock-only assertions                                  | Test only verifies the mock was called with what the test set up. Verify real behavior.                                                        |
| Non-behavioral assertions                             | CSS classes, utility class presence, internal style hooks. Assert observable behavior instead.                                                 |
| Component tests using `@vue/test-utils` for new files | New component tests must use `@testing-library/vue` + `@testing-library/user-event` (per `docs/testing/component-testing.md` and ESLint rule). |
| `import { foo, type Bar }` mixed import               | Split: `import type { Bar }` + `import { foo }` (project lint rule).                                                                           |
| `any` / `as any` / `@ts-expect-error` in test code    | Same TS rules apply to tests. Fix the underlying type.                                                                                         |

## Bugfix Regression Validity

For PRs labeled `fix:` or addressing a bug:

1. Identify the production code change that fixes the bug.
2. Mentally (or actually) revert the fix.
3. Confirm the new test fails against the pre-fix code.

If the new test passes against broken code, the test does not pin the regression. Reject the test.

## Review-Framing Anti-Patterns

These framings bias the thread toward closure before evaluation completes. Don't use them; flag them when authors echo them back:

- `LGTM, just one nit` (anchors approval)
- `approve and move on?` (leading-close)
- `Minor deviation` applied to a documented-rule violation (mislabeled severity)
- Deferring to a subagent verdict without auditing it against the doc

State the verdict (approve / request changes / comment) **before** any procedural question.

## Quick Reference: Doc → Rule

| When you see…                       | Read this section                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| New `vi.mock(...)` for a composable | `unit-testing.md` → "Mocking Composables with Reactive State"                   |
| New Pinia store test or store mock  | `store-testing.md` → "Setting Up Store Tests", "Mocking Dependencies in Stores" |
| New component test                  | `component-testing.md` → testing-library examples                               |
| `vue-i18n` references               | `docs/testing/vitest-patterns.md` → real `createI18n` rule                      |
| Cast around a mock                  | `docs/guidance/typescript.md` → "Type Assertion Hierarchy"                      |

## Anti-Patterns Cheat Sheet

```ts
// ❌ Module-level helper aliasing a mocked return value
function getToastAddMock(): ReturnType<typeof vi.fn> {
  return useToast().add as ReturnType<typeof vi.fn>
}

// ✅ Inline destructuring at call site
const { add } = useToast()
expect(add).toHaveBeenCalledWith(...)
```

```ts
// ❌ Mocking vue-i18n
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

// ✅ Mount real i18n plugin
import { testI18n } from '@/components/searchbox/v2/__test__/testUtils'
mount(MyComponent, { global: { plugins: [testI18n] } })
```

```ts
// ❌ Cast for type narrowing
const fetchMock = api.fetch as ReturnType<typeof vi.fn>
fetchMock.mockResolvedValue(data)

// ✅ vi.mocked() narrows correctly
vi.mocked(api.fetch).mockResolvedValue(data)
```

```ts
// ❌ Redundant reset
beforeEach(() => {
  vi.clearAllMocks()
  mockAdd.mockClear() // already cleared above
})

// ✅ Drop the inner clear
beforeEach(() => {
  vi.clearAllMocks()
})
```

## Verdict Heuristic

A test diff passes review when:

- Mock setup matches a documented pattern (link the section in your review comment).
- Indirection layers shrink or stay flat — never grow without justification.
- Casts are absent or each one earns its place against the assertion hierarchy.
- New tests for bugfix PRs would fail on pre-fix code.
- Test bodies assert observable behavior, not mock plumbing.

If any rule above fails: request changes. State the failure mode by name (`alias-by-renaming`, `unnecessary cast`, `vue-i18n mocked`, etc.) and reference the doc section.

## Key Files to Read

| Purpose                                        | Path                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Composable mocking patterns                    | [`docs/testing/unit-testing.md`](../../../docs/testing/unit-testing.md)                                           |
| Pinia store testing                            | [`docs/testing/store-testing.md`](../../../docs/testing/store-testing.md)                                         |
| Component testing (testing-library)            | [`docs/testing/component-testing.md`](../../../docs/testing/component-testing.md)                                 |
| Vitest project patterns (incl. real i18n rule) | [`docs/testing/vitest-patterns.md`](../../../docs/testing/vitest-patterns.md)                                     |
| TS rules (cast hierarchy, `any`)               | [`docs/guidance/typescript.md`](../../../docs/guidance/typescript.md)                                             |
| Real-i18n example                              | [`src/components/searchbox/v2/__test__/testUtils.ts`](../../../src/components/searchbox/v2/__test__/testUtils.ts) |
| Peer skill (e2e review)                        | [`.claude/skills/writing-playwright-tests/SKILL.md`](../writing-playwright-tests/SKILL.md)                        |
