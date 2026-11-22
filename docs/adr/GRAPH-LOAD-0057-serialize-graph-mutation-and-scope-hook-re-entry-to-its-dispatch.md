# ADR-GRAPH-LOAD-0057: Serialize Graph Mutation and Scope Hook Re-entry to Its Dispatch

Date: 2026-11-17

## Status

Proposed

## Context

Graph loading has two different ordering problems. File discovery is
asynchronous, so files chosen first in a multi-file selection can finish
parsing last. Graph mutation is also asynchronous: extension hooks, graph
replacement, configuration, and error handling can overlap unless every entry
point shares one ordering boundary.

The extension lifecycle adds a re-entry problem. A graph-load hook can call a
load entry point and await it, but that nested load cannot start until the
hook that requested it finishes. Refusing all loads while any hook is pending
is not an alternative: an unrelated user load must retain its place in the
queue.

Load state adds a third. Suppressing undo capture and asset scans during a
load was a process-wide flag, which is unambiguous only while the application
owns a single root `LGraph`. Each open workflow now owns its own graph, so a
load can configure a graph the user is not looking at, and state scoped to the
process cannot say which graph that is.

This ADR records the lifecycle implemented on `main`, including
[PR #21571](https://github.com/Comfy-Org/ComfyUI_frontend/pull/21571), which
gave each open workflow its own graph and carried
[PR #21717](https://github.com/Comfy-Org/ComfyUI_frontend/pull/21717)'s
graph-keyed load state to `main`.

## Decision

### Order file discovery before queued graph mutation

`handleFile` reserves its place in `fileLoadDiscoveryQueue` before parsing.
Each discovery waits for the preceding discovery to settle before dispatching
the parsed result. The queue has no timeout or failure-isolation bound:
admitting a later file ahead of a slow valid file would silently violate the
user's order, but a parser that never settles therefore blocks every later
discovery for the rest of the session.

Graph replacement runs through `ComfyApp.enqueueGraphLoad`. That shared FIFO
covers `loadGraphData`, API JSON imports, and A1111 parameter imports. Parsing
may be concurrent, but those queued operations and their lifecycle hooks are
serialized. Discovery releases its slot after dispatch, not after the queued
load finishes.

Media, mesh, and template branches mutate the current canvas outside the
mutation FIFO, so a mixed selection has no end-to-end completion ordering
across every file type. A single file can hit the same gap: when it carries
both workflow and prompt data and its workflow load throws, `handleParsedFile`
falls back to the prompt branch after that file's discovery slot has been
released, so the fallback can enqueue behind a later file. A workflow load
that resolves `false` does not fall back.

Missing-model and missing-media scanning runs outside the queue slot. The
queued operation returns a `surfaceWarnings` continuation bound to the graph
it configured, and `loadGraphData` awaits that continuation after the slot is
released, so a slow scan no longer delays the next queued mutation. The
continuation and its warning publication are therefore detached and unordered
with respect to later loads. It returns without starting a scan once the graph
it was bound to is no longer the visible root.

Publication from a scan that already started is gated on that scan's abort
signal rather than on the current root. Each pipeline run replaces and aborts
the store's previous verification controller, and `presentRootGraph` aborts it
and empties the stores, so a serialized workflow load or a live-graph switch,
which both go through `presentRootGraph`, cancels an earlier graph's pending
publication. API JSON and A1111 imports provide no such boundary: they call
`activateRootGraph` directly and run no scan of their own. While one of those
imports is on screen, a scan still pending for a graph its own workflow
continues to own can publish into the singleton missing-model and
missing-media stores.

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
the per-call options object with an own enumerable symbol, and `handleFile`
rejects graph-bearing content from that invocation after discovery. The
provenance travels with the call, so an asynchronous forwarding wrapper can
preserve it, and two calls sharing one `File` remain distinct. An ordinary
spread copy keeps the brand, and the proxy brands whatever the hook passes, so
a hook that omits the argument entirely is still protected. Provenance is lost
only below the proxy: a wrapper already installed on `app.handleFile` when the
dispatch began, which the proxy delegates to, can drop that argument or rebuild
it without copying its symbol properties. If the hook then awaits the resulting
real queued load, it can deadlock behind itself. The rejection recognizes
workflow, prompt, and A1111 parameter content, but not template content.

### Scope load state to the graph being configured

`graphLoadState` holds the graphs under load in a `WeakSet`. The loader marks
its target graph with `beginGraphLoad` and clears it with `endGraphLoad` in the
`finally` of the configuration block, so a throwing load cannot leave it set.
A `ChangeTracker` reports `isLoadingGraph` for its own workflow's graph, so a
load that configures a background graph suppresses capture and scans for that
graph alone, and the workflow on screen keeps capturing.

`rootGraphForLoad` chooses that graph: a workflow that already owns one keeps
it, so reopening a workflow preserves graph identity; a clean load over a graph
another workflow owns gets a new root graph. Because a replacement therefore
configures a different graph from the one being replaced, the outgoing
tracker's final capture in `useWorkflowService().beforeLoadNewGraph` is not
suppressed and the workflow being replaced keeps its last edits, without
depending on the order of those two calls.

A clean reload of the active workflow is the one case where the target graph
is also the outgoing graph, so marking it does suppress that workflow's own
final capture. The loader serializes the graph before marking it and restores
that snapshot if configuration fails, which is what makes a failed reload
non-destructive.

API JSON and A1111 imports do not use graph load state; they wrap their
mutation in `beginChangeCaptureSuppression` instead, which is why their node
mutations are invisible to consumers that read load state. Both run through
`enqueueImport`, which restores the retained workflow if the import throws.

`beforeLoadGraph` starts the extension-visible lifecycle. A request that is
already stale or unready when its queue slot opens, or whose workflow released
its graph before the slot opened, returns `false` before that hook runs, so it
emits no lifecycle hooks at all. Past `beforeLoadGraph`, a successful load ends
with `afterLoadGraph`; a failure before or during configuration ends with
`onGraphLoadError` after the loader presents the error; a load abandoned
because its caller is no longer current, because readiness was lost while the
hook awaited, or because its deferred graph data is no longer available, ends
with `onGraphLoadError` carrying an `AbortError` rather than a presented
failure; and one whose workflow released its graph while the hook awaited ends
with `onGraphLoadError` carrying that cause. Two late exits break the pairing:
a rejection from `afterLoadNewGraph` while the configured graph is still the
visible root, or from the `afterLoadGraph` dispatch itself, leaves the loader
without a terminal hook. The same rejection for a background graph does emit
`onGraphLoadError`.

## Consequences

### Positive

- File discovery order and queued graph mutation order have explicit,
  separate FIFO boundaries.
- The dispatch-provided hook proxy refuses its own nested graph load while
  unrelated callers stay ordered rather than refused.
- A load can configure a workflow's graph without presenting it, and the
  workflow on screen keeps capturing undo state while it does.
- Load state names the graph it applies to, so a consumer asks about one
  graph rather than about the process.
- Asset scanning no longer holds the mutation slot, so a slow scan does not
  delay the next queued load.
- A replacement cannot drop the previous workflow's last edits, because it
  configures a different graph from the one being replaced.
- Every exit between `beforeLoadGraph` and `afterConfigureGraph` emits a
  terminal hook, so a listener that opened state for a load that fails or is
  abandoned there is told the load ended.

### Negative

- A parser that never settles blocks later file discoveries for the session.
- Media, mesh, and template imports bypass the mutation FIFO, so mixed
  selections do not guarantee mutation completion order, and a
  workflow-to-prompt fallback inside one file can enqueue out of order.
- Asset scanning outside the slot is unordered with respect to later loads. It
  is bound to its graph and starts no scan once that graph is not the visible
  root, so the ordering it gives up is the ordering of warnings, not of
  mutation.
- A scan already in flight stops on its abort signal, not on a root change, and
  API JSON and A1111 imports abort nothing, so one of those imports can be on
  screen when an earlier graph's warnings reach the shared stores.
- A rejection from `afterLoadNewGraph` for the visible root graph, or from the
  `afterLoadGraph` dispatch, leaves the loader without emitting
  `onGraphLoadError`, so a `beforeLoadGraph` listener is never told that load
  ended. Recorded here rather than repaired, because the repair is a behavior
  change on `main` and this is a documentation change.
- Every graph replacement entry point must use `enqueueGraphLoad`; bypassing
  it reintroduces overlapping mutation.
- An extension hook can still deadlock the queue by awaiting a load through a
  retained real app, or through a `handleFile` call whose branded options were
  discarded below the proxy.
- Hook dispatch and file discovery have no timeout or settlement bound.
- Template content is not rejected by the graph-bearing hook check.
- A clean reload of the active workflow suppresses that workflow's own final
  capture, so edits made since its last capture are not recoverable through
  undo after the reload succeeds.
- Load state is a graph identity, so a consumer that holds neither a graph nor
  a node cannot ask whether any load is in progress.
- `false` covers both a presented load failure and a load skipped because its
  caller is no longer current. Callers needing a richer distinction require a
  new result type across the workflow-service boundary.
- A rejection from `afterLoadNewGraph` for a background graph returns an
  undefined `loaded` value, and `handleParsedFile` reports every non-`false`
  result as a non-failure, so that outcome is not reported to its caller.

## Alternatives considered

- **One global hook-in-progress flag.** Rejected because an awaited hook would
  refuse unrelated user loads and break FIFO behavior outside that dispatch.
- **A synchronous hook depth counter.** Rejected because it ends before an
  awaited hook resumes and therefore cannot identify asynchronous re-entry.
- **Provenance keyed by `File`.** Rejected because concurrent calls may share a
  `File`; provenance belongs to an invocation, not to its durable payload.
- **Running parsing, mutation, and asset scans in one queue.** Rejected
  because only mutation needs exclusive ordering; serializing parsing with it
  would add latency without strengthening graph consistency.
- **A process-wide load flag.** Rejected once a workflow could be configured
  off screen, because the flag then suppresses capture and scans for the
  workflow the user is editing, and no consumer can tell which graph the flag
  refers to.
- **Ordering the load flag after the outgoing capture instead of scoping it.**
  Rejected because it only holds while one graph exists; with per-workflow
  graphs the ordering is unobservable for a replacement and insufficient for a
  reload, where the target graph is the outgoing graph.

## References

- [PR #21983](https://github.com/Comfy-Org/ComfyUI_frontend/pull/21983), which
  established FIFO mutation, dispatch-scoped re-entry protection, and the
  capture ordering this record supersedes
- [PR #21571](https://github.com/Comfy-Org/ComfyUI_frontend/pull/21571), which
  gave each workflow its own graph and keyed load state by graph
- [Issue #22480](https://github.com/Comfy-Org/ComfyUI_frontend/issues/22480),
  which asked for this record
