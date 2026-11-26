---
globs:
  - 'src/**/*.ts'
  - 'src/**/*.vue'
---

# Error Handling: failure is data

How to tell a caller that a function failed.

> **Treat expected failure as data, validate before mutation, and throw only
> for a genuine invariant violation with a guaranteed handler.**

A thrown exception is a non-local jump: the throw site cannot see which
handler, if any, will catch it; the signature does not say it can throw; and
every frame between throw and catch exits mid-function, without finishing or
undoing its work. Those three properties make `throw` the wrong tool for
every failure a caller could handle.

This document is the guidance half of
[ADR-TELEMETRY-DIAGNOSTICS-0019](../adr/TELEMETRY-DIAGNOSTICS-0019-recoverable-event-diagnostics.md)
and of the principles recorded on
[FE-1859](https://linear.app/comfyorg/issue/FE-1859/audit-and-replace-unsafe-throw-new-error-paths-with-fail-safe-handling).
The lint rule `comfy/no-new-error-throw` enforces the mechanically checkable
part: no new `throw new Error(...)` in production code under `src/`. The rule
matches only that literal form. The guidance applies to every `throw`, including
`TypeError`, custom subclasses, and re-throws.

## 1. Return the outcome instead of throwing it

Choose the narrowest shape that lets the caller act:

| The caller needs to know            | Return                                                       |
| ----------------------------------- | ------------------------------------------------------------ |
| Whether a value exists              | `T \| undefined` (or `null` when the API already uses it)    |
| Whether a command was carried out   | `boolean`                                                    |
| Why it was refused, or partial data | A discriminated union: `{ ok: true; … } \| { ok: false; … }` |

`ok` is the discriminant most of `src/` already uses; `status`, `kind`, and
`state` appear where a domain word reads better. Pick one per module and keep
the failure arm's fields minimal: a `reason` the caller can branch on, and the
`cause` when a boundary will report it.

```ts
// ✗ the return type promises a Workflow; neither failure is in it
function parseDraft(raw: string): Workflow {
  const parsed: unknown = JSON.parse(raw) // throws on malformed JSON
  if (!isWorkflow(parsed)) throw new TypeError('not a workflow')
  return parsed
}

// ✓ both failures are in the type; the caller must handle them
type JsonParse = { ok: true; value: unknown } | { ok: false; cause: unknown }

function parseJson(raw: string): JsonParse {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch (cause) {
    return { ok: false, cause }
  }
}

type DraftParse =
  | { ok: true; workflow: Workflow }
  | { ok: false; reason: 'malformed' | 'invalid'; cause?: unknown }

function parseDraft(raw: string): DraftParse {
  const json = parseJson(raw)
  if (!json.ok) return { ok: false, reason: 'malformed', cause: json.cause }
  if (!isWorkflow(json.value)) return { ok: false, reason: 'invalid' }
  return { ok: true, workflow: json.value }
}
```

Do not return a placeholder when the work failed: an empty array when the
fetch failed, `0` when the count is unknown, or a default object when parsing
failed. A sentinel is safe only when it is distinguishable from every success
value.

## 2. Convert at the untrusted call, not up the stack

Some calls can throw and you cannot change them: `JSON.parse`, `JSON.stringify`
over user data, `fetch`, `localStorage`, DOM APIs, `Response.json()`, third
party libraries, and anything an extension or custom node supplies (`toJSON`,
callbacks, widget serializers). Wrap exactly that call in `try/catch` and turn
the result into a value before it leaves the function, as `parseJson` does
above. When the call returns a promise, `await` it inside the `try`; a
rejection from an un-awaited promise skips the `catch`. A rejection is not the
only failure: `fetch` and `api.fetchApi` resolve on HTTP error statuses, so
check `response.ok` and return the failure value when it is false.

Once the failure is a value, pass it up with ordinary returns. A `try/catch`
two or three frames above the risky call, around your own code, is the tell
that the author used an exception as a return channel.

## 3. Validate before you mutate

Check inputs, dependencies, permissions, and resources first. Then change
state. A function that adds a node, then fails the node-type check, then
throws leaves the graph mutated, and nothing rolls it back. If the throw skips
the change tracker's `afterChange`, the transaction never closes and undo
history stops recording; otherwise a later capture can record the
half-applied state as a checkpoint.

- Preflight the whole operation (every node in a paste, every file in an
  upload, every member in a downgrade) before applying any part of it. If it
  cannot complete, do nothing and say so.
- Commit to stores, history, previews, widgets, and the active workflow only
  after persistence or server validation succeeds.
- After a failed refresh or load, keep the last valid state. After an
  ambiguous remote outcome, invalidate or refetch; do not assume success.

If you cannot separate a precondition check from the mutation it guards, stage
the mutation (build the new value, swap it in at the end) so a failure midway
leaves the old value in place.

## 4. Propagate the outcome through callers

When a step is refused, skip every effect that depends on it. Run history
capture, downloads, selection changes, and the "saved" toast only after the
step they depend on has succeeded.

```ts
// ✗ the effect runs whether or not the save happened
await saveWorkflow(workflow)
workflowStore.markClean(workflow)

// ✓
const saved = await saveWorkflow(workflow)
if (!saved) return
workflowStore.markClean(workflow)
```

Returning `boolean | void` from a hook or `Promise<boolean>` from a command is
enough when the caller only needs to stop. Return the union when it needs to
explain or branch.

## 5. Report at the ownership boundary, once

Returning a failure as a value must not make it silent. Report it from the
layer that owns the decision:

- Services and stores call `reportError(cause, { errorType, surface })` with a
  stable slug (naming rules in `src/AGENTS.md`), then return the failure value.
  Add bounded `context` (never secrets) and an `outcome` tag such as
  `degraded` or `gave_up` when recovery differs from a plain refusal.
  Never `captureException` or `datadogRum.addError` directly.
- UI commands and components turn a returned failure into a toast or dialog
  whose `vue-i18n` message tells the user what to do next.
- Report each failure once. When a loop or retry can produce the same failure
  many times, budget the reports (first N, or first per key) so telemetry
  stays readable.

Do both. If you only report, the caller proceeds on bad state. If you only
return, the failure stays out of telemetry.

## 6. When throwing is still right

Throw when continuing would be worse than stopping and a known handler will
catch it:

- a security boundary would be crossed (credentials, origin, permissions);
- data would be corrupted or an invalid object constructed;
- a programmer error with no recovery path, such as an impossible state in a
  constructor.

Name the handler in your head before you write the `throw`. If you cannot
(it is "whoever calls this"), return a value instead. Parsers at a trust
boundary may throw as part of their documented contract, provided the boundary
code catches and converts.

Never throw from reporting, cleanup, or teardown. Never throw across an
extension-facing API where custom-node code is the caller; code in 40+
custom-node repositories depends on those contracts.

## 7. Test the refusal path as a value

A recoverable contract has at least one test that triggers the refusal,
asserts the returned value, and asserts that state is unchanged.
`expect(() => fn()).not.toThrow()` proves only that no exception escaped; it
does not prove the function produced the right result. If the failure is
reported, assert the
`reportError` call and its `errorType`.

A bugfix that converts a throw into a value must have a test that was red
against the throwing version.

## The tells

- A `try/catch` around your own function instead of around the platform or
  third-party call inside it.
- A return type with no failure arm, so callers treat every result as
  success.
- A `throw` after a `push`, `set`, `add`, or store assignment in the same
  function.
- A `catch` block whose only statement is `console.error(e)`.
- `expect(...).not.toThrow()` as the only assertion on a failure path.
