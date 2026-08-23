# 17. `null` Is a Legal Widget Value

Date: 2026-08-23

## Status

Proposed

<!-- [Proposed | Accepted | Rejected | Deprecated | Superseded by [ADR-NNNN](NNNN-title.md)] -->

## Context

Two tests in this repository assert opposite things about what a `null` widget
value means.

`src/lib/litegraph/src/widgetValueNullContract.test.ts`, merged into
`feature/ecs-migration` by #15596, asserts that a `null` widget value is written
to the workflow file: `expect(serialized.widgets_values).toEqual([null])`.
`src/core/graph/subgraph/promotionAfterReplacement.test.ts` in the open #15550,
based on `main`, asserts the opposite for a promoted subgraph widget: _"omits
`widgets_values` entirely when the only promoted value is null"_.

Both pass in their own checkout. Neither is wrong about what it observed. It was
never established whether they describe two legitimately different code paths or
one contract with two implementations, and no ADR settled it, so the question
kept being re-opened.

### The type declarations do not agree

`null` is legal at the type level, but only in one of the two places a widget
value is typed.

| Declaration                                               | On `main`                                                                      | Admits `null`? |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------- |
| `WidgetValue` (`src/types/simplifiedWidget.ts`)           | `string \| number \| boolean \| object \| undefined \| null \| void \| File[]` | yes            |
| `TWidgetValue` (`src/lib/litegraph/src/types/widgets.ts`) | `IWidget['value']` — a union over the concrete widget interfaces               | **no**         |

Both are exported and consumed by extensions. `promotionAfterReplacement.test.ts`
carries a comment written against that gap — _"Typed as JSON because
`TWidgetValue` excludes `null`, which a saved file can still contain"_ — which is
an accurate reading of `main` and an inaccurate reading of the runtime, since
`LGraphNode.serialize()` writes `null` into that file itself.

`feature/ecs-migration` reconciles the two by aliasing `TWidgetValue =
WidgetValue`. That is the correct direction and this ADR adopts it.

### What each persistence path actually does

Measured by execution, not by reading, at `origin/main` `12473807ab` (via
#15550's head `5c96dae193`, whose source is `main`) and at
`feature/ecs-migration` `907ca2b147`.

| Path                                                   | Input          | `main`                             | `feature/ecs-migration` |
| ------------------------------------------------------ | -------------- | ---------------------------------- | ----------------------- |
| `isWidgetValue()`                                      | `null`         | `false`                            | `true`                  |
| `LGraphNode.serialize` → `widgets_values`              | `null`         | `[null]`                           | `[null]`                |
| `LGraphNode.serialize` → `widgets_values_named`        | `null`         | `{"prompt":null}`                  | `{"prompt":null}`       |
| `LGraphNode.serialize` → `widgets_values`              | `undefined`    | `[null]`                           | `[null]`                |
| `LGraphNode.configure`, indexed                        | `null` in JSON | `null`                             | `null`                  |
| `LGraphNode.configure`, named values                   | `null` in JSON | `null`                             | `null`                  |
| `SubgraphNode.serialize`, sole promoted widget         | `null`         | **key deleted**                    | `[null]`                |
| `SubgraphNode.serialize`, `null` beside a live sibling | `null`, `42`   | `[<hole>, 42]` → JSON `[null, 42]` | `[null, 42]`            |
| `SubgraphNode` reload from `[null, 42]`                | —              | `null`, `42`                       | `null`, `42`            |
| API prompt (`executionUtil`)                           | `null`         | preserved                          | preserved               |
| Load validation (`workflowSchema`)                     | `null`         | accepted (`z.any()`)               | accepted                |
| Draft / autosave, clipboard                            | `null`         | transparent                        | transparent             |

Two rows settle the question.

**The promoted path is the same code on both refs.** `SubgraphNode.serialize` is
byte-identical at `12473807ab` and `907ca2b147`. The only difference is the
predicate it calls: `main`'s `isWidgetValue` ends `return value !== null &&
typeof value === 'object'`, the branch's begins `if (value == null) return true`.
So the two tests are not describing two code paths. They are describing one code
path at two commits, and #15550's assertion is a characterisation of `main`'s
behaviour that `feature/ecs-migration` already changes. Run against
`907ca2b147`, that file is 4 failed / 2 passed, and two of the failures are
exactly these assertions.

**On `main` the promoted path's answer depends on the siblings, not on the
value.** The same `null`, in the same widget, disappears when it is the only
promoted value and survives as `null` when a sibling holds `42` — because
`widgetValues.some((value) => value !== undefined)` deletes the key only when
every slot is empty, and `JSON.stringify` renders the surviving hole as `null`
anyway. A contract about what one value means cannot be a function of a
different widget's value. That is enough to call the omission accidental rather
than principled, without needing to argue from taste.

### On `main` the promoted round trip is not idempotent

The strongest evidence is not that the two tests disagree. It is that `main`'s
behaviour is unstable under repetition. Set the sole promoted widget to `null`,
serialize, reload, serialize again:

| Ref                     | Pass 1                      | Value after reload                          | Pass 2        | Stable? |
| ----------------------- | --------------------------- | ------------------------------------------- | ------------- | ------- |
| `main`                  | `widgets_values` **absent** | `"initial"` (the interior widget's default) | `["initial"]` | **no**  |
| `feature/ecs-migration` | `[null]`                    | `null`                                      | `[null]`      | yes     |

On `main`, saving and reloading replaces the user's recorded value with an
unrelated default, and the second save writes a different file from the first.
That is data loss, and it means #15550's test is pinning a defect, not
documenting an alternative contract.

### `undefined` is normalised to `null` on write, and that is deliberate

`LGraphNode.serialize()` contains `: (val ?? null)`, which turns an `undefined`
widget value into `null` on the way into `widgets_values`. Measured: a widget
whose value is `undefined` serializes to `[null]` and `{"prompt":null}` on both
refs, and reloads as `null`. The round trip is therefore not identity-preserving
for `undefined` — but it _is_ idempotent, because pass 2 also yields `[null]`.

This has been sitting in the code unexplained and looking accidental. It is
being made explicit here rather than removed: `widgets_values` is a positional
JSON array, `undefined` has no JSON representation, and a hole in a JS array is
emitted as `null` by `JSON.stringify` regardless. Normalising at the boundary is
the only option that makes the first save and every later save agree.

## Decision

**`null` is a legal widget value and every persistence path round-trips it
unchanged.** `WidgetValue` keeps `null`, and `TWidgetValue` is aliased to
`WidgetValue` so the two declarations cannot drift apart again.

**`null` and `undefined` are different in memory and identical on disk.**
`undefined` means "no value recorded" and a persistence path may skip it. `null`
means "recorded as empty" and must be preserved. At the serialisation boundary
`undefined` is normalised to `null`, deliberately, because the file format cannot
express it. Code that needs the distinction must not expect it to survive a save.
This makes the `value !== undefined` guards in
`SubgraphNode._applyPromotedWidgetValues()`, `applySubgraphInputOrder()` and
`transferWidgetValue()` correct as written — they test `undefined`, not
nullishness, and that is the intended test.

**Legality is owned by the value type; presence is owned by each persistence
path; neither may be decided from a sibling's value.** `isWidgetValue` is the one
place that decides whether a value is a widget value at all, and a per-path
filter must not re-decide it. `main` violates this: `SubgraphNode.serialize`
routes `null` through a type guard used as a validity filter, then applies an
emptiness heuristic over the whole array. Whether one widget's value is written
must be a function of that widget's value alone.

The fix is already implemented on `feature/ecs-migration` as a one-line widening
of `isWidgetValue` to `if (value == null) return true`, which corrects both of its
call sites — `SubgraphNode.serialize()` and `proxyWidgetMigration.ts`, where on
`main` a `null` value is classified as a migration hole.

**Of the two conflicting tests, #15596's is the contract and #15550's two
assertions are wrong.** `promotionAfterReplacement.test.ts`'s _"omits
`widgets_values` entirely when the only promoted value is null"_ and _"serializes
a null promoted value as an undefined slot beside a live sibling"_ pin `main`'s
current wrong answer. Under this repository's own convention they should assert
the wanted behaviour under `it.fails`, so they go green when the defect is fixed
instead of red.

### Alternatives considered

**Narrow `WidgetValue` to exclude `null`.** Rejected. Removing `null` and running
`vue-tsc --noEmit` produces 19 errors across 11 files against a control run of 0,
only two of them in production code — but `WidgetValue` is a public type, so the
compiler measures the first-party blast radius and says nothing about the
ecosystem's. A GitHub code search over public extensions found nine repositories
that assign `null` to a widget value, one of them mirrored inside Comfy-Org's own
node database; they would break with no diagnostic. And `LGraphNode.serialize`
mints `null` itself, so first-party workflow files already contain values this
option would declare illegal.

**Treat `null` as absence on every path, so the direct path drops it too.**
Rejected. `widgets_values` is positional; dropping a value in the middle shifts
every later widget by one. It also erases the difference between a control the
user cleared and one that was never recorded.

**Accept both behaviours and scope each to its own path.** Rejected on evidence,
not on principle. It requires the promoted path to be a legitimately different
path, and it is not — same function, same call, one predicate apart — and it
requires `main`'s behaviour to be self-consistent, and it is not, because it
depends on sibling values and is not idempotent.

## Consequences

### Positive

- One answer for "what does `null` mean", enforced by one predicate rather than
  by each path's local filter.
- The promoted-subgraph round trip becomes idempotent. On `main` it silently
  replaces a recorded `null` with the interior widget's default.
- The contract is pinned by tests on every enumerated path:
  `widgetValueNullContract.test.ts` (workflow write, both read branches,
  draft/autosave JSON, two-pass idempotence), `executionUtil.test.ts` (API
  prompt), `workflowSchema.test.ts` (load validation).

### Negative

- The behavioural fix currently ships only with the ECS migration. If that branch
  slips, `main` keeps the mismatch. The `isWidgetValue` widening is one line and
  is extractable as a standalone PR.
- Extensions that rely on `null` being dropped at save time — at least one of the
  nine repositories nulls widgets specifically to control what gets written —
  will now see the value persisted. Correct under this contract, still a
  behaviour change for them.
- The in-memory `undefined` / `null` distinction is now formally not durable.
  Anything that wants it must carry it outside `widgets_values`.

## Notes

**Round-trip tests on widget values are vacuous by default.** Widget state is
keyed `graphId:nodeId:name` and `configure()` restores the original graph id, so
a naive save/load test re-adopts the live `widgetValueStore` entry and passes
without reading the serialized JSON at all. Such a test must drop the store
between save and load.

**This ADR does not cover a separate, older defect found while measuring the
matrix.** `LGraphNode.serialize` writes `o.widgets_values[i]` using the widget's
index in `this.widgets` while skipping `serialize === false` widgets, but
`LGraphNode.configure`'s indexed branch reads back with a _compacted_ counter
that also skips them. A node whose non-final widget has `serialize === false`
therefore round-trips its later values into the wrong slots, and the leading hole
arrives back as `null`. Measured identically on `main` and
`feature/ecs-migration`: a widget holding `"KEPT-VALUE"` reads back as `null`
after one save/load. The `widgets_values_named` branch is unaffected and restores
`"KEPT-VALUE"` correctly, but `Comfy.Workflow.NamedValuesRestore` defaults to
`false` and is marked experimental, so the affected branch is the production
default. That produces a third kind of `null` in `widgets_values` — neither
"recorded as empty" nor "no value recorded", but "index misalignment" — which is
why it is named here rather than left for the next person to rediscover while
reading this contract. It is tracked separately.
