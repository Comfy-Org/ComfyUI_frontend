# 16. `null` Is a Legal Widget Value

Date: 2026-08-21

## Status

Proposed

## Context

`WidgetValue` (`src/types/simplifiedWidget.ts`) is declared as
`string | number | boolean | object | undefined | null`. `NodeProperty`
(`src/lib/litegraph/src/LGraphNode.ts`) likewise admits `null`. Both types are
exported and consumed by extensions.

On `main` one persistence path contradicts those types.
`SubgraphNode.serialize()` filters promoted widget values through
`isWidgetValue()`, and `main`'s predicate returns `false` for `null`:

```ts
return value !== null && typeof value === 'object'
```

A `null` promoted value is therefore mapped to `undefined`, and when every
promoted widget on the node is `null` the guard
`widgetValues.some((value) => value !== undefined)` fails and the whole
`widgets_values` key is deleted. The type says the value is legal; that code
path silently discards it. Nothing on either side asserted which was right — no
guard, no invariant, no test.

Three pieces of evidence settle the direction.

**The rest of the codebase already treats `null` as legal.** Every other
persistence path round-trips it. `LGraphNode.serialize()` goes further and
*mints* it: `const serialisedVal = ... : (val ?? null)` converts an `undefined`
widget value into `null` on the way into `widgets_values`. First-party saves
therefore already write `null` into workflow JSON with no extension involved,
and `LGraphNode.configure()` reads it straight back onto `widget.value`.
`setProperty(name, null)` propagates `null` to the bound widget, and
`normalizeWidgetValue()` in `useProcessedWidgets.ts` has a dedicated branch
returning `null` unchanged. Treating `null` as illegal would mean treating the
majority of the code as wrong.

**The mismatch is reachable from outside.** A GitHub code search over public
extensions found nine distinct repositories that assign `null` to a widget
value; eight leave it in place across a save. One (`justUmen/Bjornulf_custom_nodes`)
is mirrored inside Comfy-Org's own node database. The rate is low — seven
files matching the exact pattern against a 4,280-file control arm of
`widget.value =` assignments — so this is rare but real, not hypothetical. It
requires the affected node to sit inside a subgraph to bite.

**Narrowing the type is cheap in-repo and unbounded outside it.** Removing
`null` from `WidgetValue` and running `vue-tsc --noEmit` produces 19 errors
across 11 files, against a control run of 0 errors on the unmodified branch.
Only two are production code. But `WidgetValue` is a public type, so the
compiler measures the first-party blast radius and says nothing about the
ecosystem's. The nine repositories above would break with no diagnostic.

## Decision

`null` is a legal widget value. Every persistence path must round-trip it
unchanged, and `WidgetValue` keeps `null`.

`null` and `undefined` are not interchangeable. `undefined` means "no value
recorded"; a persistence path may skip it. `null` means "recorded as empty" and
must be preserved. The `value !== undefined` guards in
`SubgraphNode._applyPromotedWidgetValues()`, `applySubgraphInputOrder()` and
`transferWidgetValue()` are correct as written precisely because they test
`undefined` and not nullishness.

The `feature/ecs-migration` branch already implements this by widening
`isWidgetValue()` to `if (value == null) return true`. That single predicate
change fixes both of its call sites — `SubgraphNode.serialize()` and
`proxyWidgetMigration.ts`, where on `main` a `null` value is classified as a
migration hole.

## Consequences

- The behavioural fix ships with the ECS migration. If that branch slips,
  `main` keeps the mismatch, and the one-line `isWidgetValue` widening is
  extractable as a standalone PR.
- The contract is now pinned by round-trip tests on every persistence path:
  `widgetValueNullContract.test.ts` (workflow write, workflow read via both the
  indexed and named-values branches, draft/autosave JSON, and a two-pass
  idempotence check), `executionUtil.test.ts` (API prompt), and
  `workflowSchema.test.ts` (load-time validation). The promoted-widget path is
  covered by `SubgraphWidgetPromotion.test.ts`. Each assertion was verified by
  mutating the corresponding filter and confirming the test fails.
- Widget state is keyed `graphId:nodeId:name` and `configure()` restores the
  original graph id, so a naive save/load test re-adopts the live
  `widgetValueStore` entry and passes without reading the serialized JSON at
  all. Round-trip tests must drop the store between save and load.
- `LGraphNode.serialize()`'s `val ?? null` coercion is retained but is worth
  revisiting separately: it erases the `undefined`/`null` distinction on the
  write side for ordinary nodes, which is the opposite asymmetry to the one
  this ADR closes.
- Extensions that rely on `null` being dropped at save time — one of the nine
  repositories nulls widgets specifically to control what gets written — will
  now see the value persisted. That is the correct behaviour under this
  contract, but it is a behaviour change for them.
