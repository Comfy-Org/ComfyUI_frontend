---
name: error-handling
description: Reviews failure handling against docs/guidance/error-handling.md (failure as data, validate before mutation, report once at the boundary)
severity-default: high
tools: [Read, Grep]
---

Read `docs/guidance/error-handling.md` and review new or changed failure paths in the diff against it. The lint rule `comfy/no-new-error-throw` already rejects a literal `throw new Error(...)` under `src/`, and `no-restricted-imports` rejects raw `captureException` and `datadogRum` imports; do not repeat those.

Flag:

1. **Thrown expected failure** - any other `throw` (`TypeError`, a custom subclass, a re-throw) for a failure the caller could handle, with no named handler. Suggest the narrowest return shape: `T | undefined`, `boolean`, or an `{ ok: true } | { ok: false; reason }` union.
2. **`try/catch` in the wrong frame** - a catch around the repo's own function instead of around the platform or third-party call that throws (`JSON.parse`, `fetch`, `localStorage`, DOM APIs, extension callbacks); a promise not awaited inside its `try`.
3. **Unchecked HTTP status** - `fetch` or `api.fetchApi` results used without checking `response.ok`.
4. **Placeholder on failure** - an empty array, `0`, or default object returned when the work failed and the caller cannot tell.
5. **Mutation before validation** - state changed before a check that can still refuse, leaving the graph, a store, history, or a widget half-applied.
6. **Effects after a refused step** - a toast, history capture, download, or `markClean` that runs whether or not the step it depends on succeeded.
7. **Silent or repeated reporting** - a failure returned as a value with no `reportError` at the owning boundary, a `catch` whose only statement is `console.error`, or the same failure reported from several layers or on every retry.
8. **Throw across an extension-facing API** or from reporting, cleanup, or teardown code.
9. **Failure UX** - a user-facing message that is not `vue-i18n` text telling the user what to do next.
10. **Refusal path untested** - a recoverable contract whose only failure test is `expect(...).not.toThrow()`.

Rules:

- Only review new or changed failure paths.
- Do not ask for error handling in code that cannot fail.
- "Critical" for swallowed failures in data-mutation paths, "major" for missing handling on external calls, "minor" for reporting or message gaps.
