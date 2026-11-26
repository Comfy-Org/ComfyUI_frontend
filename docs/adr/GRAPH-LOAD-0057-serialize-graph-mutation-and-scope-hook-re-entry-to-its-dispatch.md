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

Files can parse in parallel. `handleFile` reserves a place in
`fileLoadDiscoveryQueue` before parsing, then waits for the preceding
discovery before dispatching its result. The queue has no timeout or
failure-isolation bound, because admitting a later file ahead of a slow valid
one would silently violate the user's order. So if an earlier parser never
settles, later files cannot dispatch, even if they have finished parsing.

Dispatch releases the discovery slot without waiting for the load to finish.
`ComfyApp.enqueueGraphLoad` orders the graph changes and their hooks for
`loadGraphData`, API JSON imports, and A1111 parameter imports.

Media, mesh, and template branches mutate the current canvas outside the
mutation FIFO, so a mixed selection has no end-to-end completion ordering
across every file type. A single file can hit the same gap: when it carries
both workflow and prompt data and its workflow load throws, `handleParsedFile`
falls back to the prompt branch after that file's discovery slot has been
released, so the fallback can enqueue behind a later file. A workflow load
that resolves `false` does not fall back.

The queued mutation returns a `surfaceWarnings` continuation for the graph it
configured. `loadGraphData` awaits `surfaceWarnings` after releasing the
mutation slot, so a slow missing-model or missing-media scan does not delay
the next mutation. `surfaceWarnings` skips the scan if its graph is no longer
the visible root.

Once a scan has started, publication is gated on that scan's abort signal
rather than on the current root. Starting new verification replaces and aborts
the previous controller, and `presentRootGraph` also aborts pending
verification and empties the warning stores, so a serialized workflow load or
a live-graph switch cancels an earlier graph's pending publication. API JSON
and A1111 imports call `activateRootGraph` without cancelling pending
verification and run no scan of their own. While one of those imports is on
screen, an earlier scan can still publish into the singleton missing-model and
missing-media stores if the earlier graph remains owned by its workflow.

### Refuse only dispatch-owned re-entry

The async dispatcher provides an app proxy for `beforeLoadGraph`,
`beforeConfigureGraph`, `afterConfigureGraph`, `afterLoadGraph`, and
`onGraphLoadError`. While the dispatch is unsettled, the proxy's
`loadGraphData` and `loadApiJson` methods resolve `false`. They delegate to the
entry points captured when the dispatch began once it runs its cleanup, which
the settled and rejected paths normally both reach. One exit skips it: an error
raised while logging an extension's failure escapes the callback loop before
cleanup, so a proxy retained across that exit keeps refusing loads for the rest
of the session. Independent callers retain the real app and continue to queue
normally.

This protection applies only to calls made through that dispatch proxy.
Synchronously dispatched hooks, including `loadedGraphNode`, receive the real
app. A hook that retains and awaits the real app, or calls a workflow-service
entry point that enqueues behind the current operation, can form a wait cycle:
the outer load awaits the hook while the nested load awaits the outer load.
Hook awaits also have no timeout, so a hook that never settles holds the
mutation FIFO.

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

A clean reload of the active workflow targets the outgoing graph, so marking
it suppresses that workflow's own final capture. The loader serializes the
graph before marking it and attempts to restore that snapshot if
configuration fails. Recovery is best effort: a throw from the restore is
reported and the load keeps unwinding, so the graph can be left part
configured. The serialization is outside the block whose `catch` performs the
restore, so a graph that cannot be serialized fails the reload before load
state is ever set.

Undo and Redo on the active workflow also target the outgoing graph, through a
non-clean load of a graph its workflow still owns. They take no snapshot; the
change tracker returns the entry to its queue when the load does not restore
it.

API JSON and A1111 imports do not use graph load state; they wrap their
mutation in `beginChangeCaptureSuppression` instead, which is why their node
mutations are invisible to consumers that read load state. Both run through
`enqueueImport`, which restores the retained workflow if the import throws.

### Describe what hooks observe

If a request is already stale or unready, the loader returns `false` before
dispatching any hooks. A non-clean load whose workflow has released its graph
also returns `false` before any dispatch; a clean load does not need that
graph and is not refused.

A normal visible load starts with `beforeLoadGraph` and finishes with
`afterLoadGraph`. A successful background restore calls the configure hooks
without dispatching either of those load hooks.

For failures caught by preflight or configuration, the loader presents the
error and calls `onGraphLoadError`, including for a background restore that
never dispatched `beforeLoadGraph`. If the request becomes stale, loses
readiness, or no longer has deferred graph data, the cancellation path passes
an `AbortError` instead. If a non-clean load's workflow releases its graph
while the loader is preparing it, the loader calls `onGraphLoadError` with
that cause.

Extensions cannot rely on `beforeLoadGraph` being paired with a terminal hook.
If a custom node throws while nodes are sized, the loader clears the graph's
load state and rethrows without calling either terminal hook. A rejection from
`afterLoadNewGraph` also escapes without an error hook if the configured graph
is still visible; if that graph is no longer visible, the loader calls
`onGraphLoadError` instead.

An ordinary extension failure does not reject the dispatch. The dispatcher
logs each extension's throw or rejection and then settles, so that failure in
a graph-load hook neither stops the load nor reaches `onGraphLoadError`. The
isolation is not total, because logging reads the extension's name: an
extension whose `name` getter throws rejects the dispatch itself.

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
- A throw after `beforeLoadGraph` can escape with no terminal hook: node
  sizing, serializing the outgoing graph for a clean reload, and
  `afterLoadNewGraph` for the visible root graph all propagate without
  `onGraphLoadError`. A listener that opened state on `beforeLoadGraph` cannot
  close it on a terminal hook alone. Recorded here rather than repaired,
  because the repair is a behavior change on `main` and this is a
  documentation change.
- An ordinary throw from a graph-load hook is logged and swallowed, so it
  reaches neither the load nor `onGraphLoadError`. An extension that needs its
  failure to stop a load has no hook that will do it.
- A successful background restore dispatches the configure hooks but neither
  load hook, so an extension that tracks loads through `beforeLoadGraph` does
  not see a workflow restored off screen. A failed restore need not reach both
  configure hooks.
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
