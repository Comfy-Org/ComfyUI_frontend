# 28. Defer Remote Combo Missing-Model Judgement

Date: 2026-09-03

## Status

Proposed

## Context

The missing-model scan decides that a combo widget value is missing when the
value looks like a model file and is absent from the widget's `options.values`.
For static combos that list is the complete inventory returned by
`/object_info`, so an immediate verdict is correct.

Remote combos (`inputSpec.remote`) fetch their options asynchronously. Until
the first response arrives the widget's default value is the `'Loading...'`
placeholder and the dynamic `options.values` getter returns that placeholder,
so `resolveComboValues` yields the string's character indices. Every scan that
runs before the response, which on a cold cache is every workflow load,
therefore reports a false positive. The scan has no way to tell "the inventory
is empty" from "the inventory is not known yet".

The realtime scan path (paste, un-bypass) and the workflow-load pipeline share
the same candidate type and verification step, and the Cloud distribution
already models an "unknown until verified" state via `isMissing: undefined`.

## Decision

1. A remote combo exposes an inventory status (`loading | ready | error`) and a
   way to wait for the in-flight fetch. `useComboWidget` registers that
   inventory in a `WeakMap<IComboWidget, ComboWidgetInventory>` owned by
   `src/core/graph/widgets/comboWidgetInventory.ts`. No property is added to
   the widget object and nothing is serialized.
2. The scan consults the registry only for combos that have one. A combo whose
   inventory is not `ready` yields `isMissing: undefined` plus a runtime-only
   `pendingVerification` closure. The closure waits for the inventory, then
   re-reads the current widget value and options. It returns `undefined` when
   the inventory ended in error or the selected value changed while waiting.
3. `verifyAssetSupportedCandidates` resolves those closures before the Cloud
   asset verification, so both the pipeline and the realtime path reuse the
   existing `undefined → verified` flow. The OSS pipeline now runs that step
   whenever a deferred candidate exists, and every surface call recomputes the
   confirmed set from the live candidates so the folder-path and verification
   branches converge regardless of which settles first.
4. The remote widget surface added for this is limited to two functions,
   `getInventoryStatus` and `waitForInventory`. The planned TanStack Query
   rewrite of remote options (#11955, #12163) can implement the same two
   functions with `queryClient.getQueryState` and `fetchQuery`.

## Alternatives Considered

### Exclude loading remote combos from the scan

Returning `isMissing: undefined` with no follow-up removes the closure and the
pipeline change, but a remote model that is genuinely missing would not be
reported on workflow load, only on a later rescan or at queue time.

### Await all remote inventories before scanning

Keeps the scan synchronous and needs no closure, but ties workflow load to
remote route latency and retry backoff.

### Key the inventory by `WidgetId` in `widgetValueStore`

Matches the direction of ADR 0023. The scan already resolves promoted widgets
to their definition widget object, and the inventory carries a wait function
rather than plain data, so a store component would need a second mapping and
would still not be a plain-data component. The `WeakMap` follows the existing
precedent in `src/core/graph/subgraph`.

### Stack the change on the TanStack Query rewrite

#12163 no longer rebases onto `main` and its maintainer has recorded that a
fresh port is the path forward, so a stacked PR would lose its base.

## Consequences

Static combo behavior is unchanged. Remote combos are judged only once their
inventory is known, and a value that changed during the wait discards the
stale verdict. A remote inventory that fails to load leaves the candidate
unreported rather than falsely flagged.

The first-load behavior of `useRemoteWidget`, which replaces the widget value
with the first option after the initial response, is left as is. Changing it
affects every remote widget and is tracked separately.

`MissingModelCandidate.pendingVerification` is the one non-data field on the
candidate type. Only confirmed candidates are cached in pending warnings, and
the closure is deleted once resolved, so it never reaches persisted state.
