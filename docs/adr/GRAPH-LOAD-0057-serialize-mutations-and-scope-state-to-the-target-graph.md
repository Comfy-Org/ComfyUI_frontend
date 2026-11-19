# ADR-GRAPH-LOAD-0057: Serialize Mutations and Scope State to the Target Graph

Date: 2026-11-17

## Status

Proposed

## Context

Graph loading has two different ordering problems. File discovery is
asynchronous, so files selected first can finish parsing last. Graph mutation
is also asynchronous: extension hooks, workflow activation, configuration, and
error handling can overlap unless every entry point shares one ordering
boundary.

The extension lifecycle adds a re-entry problem. A graph-load hook can call a
load entry point and await it, but that nested load cannot start until the hook
that requested it finishes. Refusing all loads while any hook is pending is not
an alternative: an unrelated user load must retain its place in the queue.

[ADR-GRAPH-DOCUMENT-0045](GRAPH-DOCUMENT-0045-per-workflow-lgraph-instances.md)
changes the state model from one process-wide graph to one live `LGraph` per
loaded workflow. A load can configure an owned background graph while another
graph is visible, and a tab activation can switch to an existing graph without
configuring it. Consequently, neither the active canvas nor a process-wide
`ChangeTracker` flag identifies the graph being mutated.

## Decision

### Order workflow discovery before queued workflow mutation

`handleFile` reserves its place in `fileLoadDiscoveryQueue` before parsing.
Each discovery waits for the preceding discovery to settle before dispatching
the parsed result. The queue has no timeout or failure-isolation bound:
admitting a later file ahead of a slow valid file would silently violate user
order, but a parser that never settles therefore blocks every later discovery
and retains its queued results for the rest of the session.

Workflow graph replacement and live-graph activation run through
`ComfyApp.enqueueGraphLoad`. This shared FIFO includes `loadGraphData`, API and
A1111 imports, and switches to an already loaded workflow graph. Parsing may be
concurrent, but those queued operations and their lifecycle hooks are
serialized. Discovery releases its slot after dispatch, not after a queued load
finishes. Media, mesh, and template branches mutate the current canvas outside
the mutation FIFO, so a mixed selection does not have end-to-end completion
ordering across every file type.

Asset scans are not graph mutations. They start after the queued mutation, so
slow model or media checks do not hold the mutation queue. The wrapper checks
graph identity before starting scans and showing warnings. Deferred model and
media publication relies on cancellation rather than rechecking the current
root: serialized workflow loads and live-graph switches abort earlier scans,
while API and A1111 imports do not currently provide that cancellation
boundary.

### Refuse only dispatch-owned re-entry

Each graph-load hook dispatch receives a proxy over the app. While that
dispatch is unsettled, its `loadGraphData` and `loadApiJson` methods resolve
`false`; after it settles they delegate to the entry points captured when the
dispatch began. Independent callers retain the real app and continue to queue
normally.

This protection applies only to calls made through that dispatch proxy. A hook
that retains and awaits the real app, or calls a workflow-service entry point
that enqueues behind the current operation, can form a wait cycle: the outer
load awaits the hook while the nested load awaits the outer load. Hook awaits
also have no timeout, so a hook that never settles holds the mutation FIFO.

`handleFile` remains available to hooks for non-graph media. The proxy brands
the per-call options object, and `handleFile` rejects graph-bearing content
from that invocation after discovery. The provenance travels with the call so
an asynchronous forwarding wrapper can preserve it, while two calls using the
same `File` remain distinct. A wrapper that clones or drops the branded options
object loses that provenance; if the hook awaits the resulting real queued
load, it can deadlock behind itself. The rejection currently recognizes
workflow, prompt, and A1111 parameter content, but not template content.

### Bind lifecycle state to the graph being configured

The target graph is selected before configuration. A workflow with a live
graph keeps that graph; a clean load creates a graph when the current root is
owned by another workflow. Activation of an already loaded workflow swaps to
its existing graph and runs load hooks without running configure hooks.

Configuration state for the `loadGraphDataNow` path lives in `graphLoadState`,
a `WeakSet<LGraph>`. That loader marks the selected graph before mutation and
clears it on every terminal path. Change tracking, telemetry, error clearing,
app mode, and execution-error consumers can query the graph they hold instead
of consulting global loading state. API JSON and A1111 imports share the FIFO
but currently use only process-wide change-capture suppression, so their node
mutations are not covered by the per-graph loading gate. The weak key lets a
released workflow graph disappear without a second cleanup registry.

`beforeLoadGraph` starts the normal extension-visible lifecycle. A successful
visible load ends with `afterLoadGraph`, and normal configuration failures end
with `onGraphLoadError`. Pairing is not universal: live-graph activation can
return `false` after `beforeLoadGraph` when navigation becomes stale, the graph
is released, or workflow opening fails, without emitting a terminal hook.
Background restoration omits `beforeLoadGraph` but can still emit
`onGraphLoadError` when its graph is released or its load is replaced.

### Suppress capture around replacement mutation

The `loadGraphDataNow` path selects the target and calls `beginGraphLoad` before
`beforeLoadNewGraph`, then opens change-capture suppression around replacement
mutation and releases it on every exit. For an ordinary replacement this lets
the outgoing tracker flush before the new graph is configured. For a forced
reload or restoration targeting the active workflow's own graph, the graph is
already marked loading when `beforeLoadNewGraph` tries its final capture, so
that capture is skipped and the previously retained active state is persisted.

## Consequences

### Positive

- Workflow-file discovery order and queued workflow mutation order have
  explicit, separate FIFO boundaries.
- The dispatch-provided hook proxy refuses its own nested graph load while
  unrelated callers remain ordered rather than refused.
- Two workflow graphs can exist independently, and `loadGraphDataNow`
  consumers can scope loading state to the graph they hold.
- Slow asset discovery no longer extends the graph mutation critical section.

### Negative

- A parser that never settles blocks later file discoveries in the session.
- Media, mesh, and template imports bypass the workflow mutation FIFO; mixed
  file selections therefore do not guarantee mutation completion order.
- Every workflow graph-load or live-activation entry point must use
  `enqueueGraphLoad`; bypassing it reintroduces overlapping workflow mutation.
- An extension hook can still deadlock the queue by awaiting a load through a
  retained real app or through a call whose branded options were discarded.
- Hook dispatch and file discovery have no timeout or settlement bound.
- An extension wrapper that replaces or drops the `handleFile` options object
  also drops hook provenance. Template content is not currently rejected by
  the graph-bearing hook check.
- API and A1111 imports do not mark their target graph in `graphLoadState` and
  do not abort deferred asset publication from an earlier current graph.
- Lifecycle hook pairing has cancellation and background-restoration
  exceptions; consumers cannot assume every `beforeLoadGraph` has one terminal
  counterpart.
- Same-graph reload can skip the outgoing tracker's final capture because the
  target is marked loading before `beforeLoadNewGraph` runs.
- `false` covers both a presented load failure and a load skipped because its
  caller is no longer current. Callers that need a richer distinction require
  a new result type across the workflow-service boundary.
- Some post-hook failure paths return an undefined `loaded` value, and
  `handleParsedFile` treats every non-`false` result as success.

## Alternatives considered

- **One global hook-in-progress flag.** Rejected because an awaited hook would
  refuse unrelated user loads and break FIFO behavior outside that dispatch.
- **A synchronous hook depth counter.** Rejected because it ends before an
  awaited hook resumes and therefore cannot identify asynchronous re-entry.
- **Provenance keyed by `File`.** Rejected because concurrent calls may share a
  `File`; provenance belongs to an invocation, not its durable payload.
- **One process-wide loading flag.** Rejected because workflows own distinct
  live graphs. Loading a background graph must not suppress consumers of the
  visible graph.
- **Run parsing, mutation, and asset scans in one queue.** Rejected because
  only mutation requires exclusive ordering. Serializing the other phases
  would increase latency without strengthening graph consistency.

## References

- [PR #21983](https://github.com/Comfy-Org/ComfyUI_frontend/pull/21983), which
  established FIFO mutation, dispatch-scoped re-entry protection, and paired
  capture suppression
- [PR #21571](https://github.com/Comfy-Org/ComfyUI_frontend/pull/21571), which
  gives each loaded workflow its own graph
- [PR #21717](https://github.com/Comfy-Org/ComfyUI_frontend/pull/21717), which
  keys configuration state by graph
