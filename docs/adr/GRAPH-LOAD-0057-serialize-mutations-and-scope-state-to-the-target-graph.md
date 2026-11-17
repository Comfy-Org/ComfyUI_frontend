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

### Order discovery before mutation

`handleFile` reserves its place in `fileLoadDiscoveryQueue` before parsing.
Each discovery waits for the preceding discovery to settle before dispatching
the parsed result. The queue has no timeout: admitting a later file ahead of a
slow valid file would silently violate user order. A parser that never settles
is repaired at the parser boundary.

All graph mutations and live-graph activations run through
`ComfyApp.enqueueGraphLoad`. This shared FIFO includes `loadGraphData`, API and
A1111 imports, and switches to an already loaded workflow graph. Parsing may be
concurrent, but graph replacement, configuration, activation, and their
lifecycle hooks are serialized.

Asset scans are not graph mutations. They run after the queued mutation and
publish only while their graph is still current, so slow model or media checks
do not hold the mutation queue.

### Refuse only dispatch-owned re-entry

Each graph-load hook dispatch receives a proxy over the app. While that
dispatch is unsettled, its `loadGraphData` and `loadApiJson` methods resolve
`false`; after it settles they delegate to the entry points captured when the
dispatch began. Independent callers retain the real app and continue to queue
normally.

`handleFile` remains available to hooks for non-graph media. The proxy brands
the per-call options object, and `handleFile` rejects graph-bearing content
from that invocation after discovery. The provenance travels with the call so
an asynchronous forwarding wrapper can preserve it, while two calls using the
same `File` remain distinct.

### Bind lifecycle state to the graph being configured

The target graph is selected before configuration. A workflow with a live
graph keeps that graph; a clean load creates a graph when the current root is
owned by another workflow. Activation of an already loaded workflow swaps to
its existing graph and runs load hooks without running configure hooks.

Configuration state lives in `graphLoadState`, a `WeakSet<LGraph>`. The loader
marks the selected graph before mutation and clears it on every terminal path.
Change tracking, telemetry, error clearing, app mode, and execution-error
consumers query the graph they hold instead of consulting global loading
state. The weak key lets a released workflow graph disappear without a second
cleanup registry.

`beforeLoadGraph` starts the extension-visible lifecycle. A successful visible
load ends with `afterLoadGraph`; a started load that fails or is replaced ends
with `onGraphLoadError`. Background restoration suppresses visible lifecycle
notifications because it does not replace the canvas graph.

### Flush outgoing state before suppressing capture

Replacement paths run `beforeLoadNewGraph` before opening change-capture
suppression. Deactivating the outgoing tracker performs its final capture at
that point. Suppression covers only mutation of the replacement graph and is
released on every exit.

## Consequences

### Positive

- File selection order and graph mutation order have explicit, separate FIFO
  boundaries.
- An extension hook cannot deadlock the queue by awaiting its own nested load,
  while unrelated loads remain ordered rather than refused.
- Two workflow graphs can exist or load independently without suppressing
  capture, telemetry, or error processing for the wrong graph.
- Slow asset discovery no longer extends the graph mutation critical section.

### Negative

- A parser that never settles blocks later file discoveries in the session.
- Every graph-load or live-activation entry point must use
  `enqueueGraphLoad`; bypassing it reintroduces overlapping mutation.
- An extension wrapper that replaces or drops the `handleFile` options object
  also drops hook provenance. The call is then treated as independent and is
  admitted through the normal queue.
- `false` covers both a presented load failure and a load skipped because its
  caller is no longer current. Callers that need a richer distinction require
  a new result type across the workflow-service boundary.

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
