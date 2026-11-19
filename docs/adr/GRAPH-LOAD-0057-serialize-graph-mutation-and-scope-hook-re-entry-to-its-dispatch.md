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

This ADR records the lifecycle implemented on `main`, where the application
owns a single root `LGraph` and load state is the process-wide
`ChangeTracker.isLoadingGraph` flag. Giving each open workflow its own graph,
and keying configuration state by graph, is proposed separately in
[PR #21571](https://github.com/Comfy-Org/ComfyUI_frontend/pull/21571) and
[PR #21717](https://github.com/Comfy-Org/ComfyUI_frontend/pull/21717). Neither
is on `main`, and this ADR does not decide that model.

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

Missing-model and missing-media scans run inside the queued operation, after
the replacement mutation and after the load flag is cleared. They are ordered
with the load and hold its queue slot. The loader rechecks that the configured
graph state is still current before each terminal hook.

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
spread copy keeps the brand. A wrapper that drops the options argument, or
rebuilds it without copying its symbol properties, loses the provenance; if
the hook then awaits the resulting real queued load, it can deadlock behind
itself. The rejection recognizes workflow, prompt, and A1111 parameter
content, but not template content.

### Order replacement capture around the outgoing tracker

`loadGraphDataNow` calls `useWorkflowService().beforeLoadNewGraph` and applies
the returned canvas replacement before it sets `ChangeTracker.isLoadingGraph`.
The outgoing tracker's final capture therefore runs while capture is still
enabled, so the workflow being replaced keeps its last edits. The flag is
cleared before the post-load asset scans and again in the loader's `finally`,
so a throwing load cannot leave it set. API JSON and A1111 imports do not use
that flag; they wrap their mutation in `beginChangeCaptureSuppression`
instead, which is why their node mutations are invisible to consumers that
read the loading flag.

`beforeLoadGraph` starts the extension-visible lifecycle. A successful load
ends with `afterLoadGraph`, and a configuration failure ends with
`onGraphLoadError` after the loader presents the error. A load that is
replaced by a newer queued load, or skipped because its caller is no longer
current, also ends with `onGraphLoadError`, carrying an `AbortError` rather
than a presented failure.

## Consequences

### Positive

- File discovery order and queued graph mutation order have explicit,
  separate FIFO boundaries.
- The dispatch-provided hook proxy refuses its own nested graph load while
  unrelated callers stay ordered rather than refused.
- Load state is raised only after the outgoing tracker has flushed, so a
  replacement cannot drop the previous workflow's last edits.
- Consumers that must ignore load-time mutation read one flag, and every
  loader exit clears it.
- Every pre-`afterLoadGraph` exit emits a terminal hook, so a listener that
  opened state in `beforeLoadGraph` is always told the load ended.

### Negative

- A parser that never settles blocks later file discoveries for the session.
- Media, mesh, and template imports bypass the mutation FIFO, so mixed
  selections do not guarantee mutation completion order, and a
  workflow-to-prompt fallback inside one file can enqueue out of order.
- Asset scans sit inside the queued operation, so a slow model or media check
  delays the next queued load even though it is not a mutation.
- Every graph replacement entry point must use `enqueueGraphLoad`; bypassing
  it reintroduces overlapping mutation.
- An extension hook can still deadlock the queue by awaiting a load through a
  retained real app, or through a `handleFile` call whose branded options were
  discarded.
- Hook dispatch and file discovery have no timeout or settlement bound.
- Template content is not rejected by the graph-bearing hook check.
- `ChangeTracker.isLoadingGraph` is process-wide and cannot say which graph is
  loading. That is sufficient while one root graph exists, and it is the
  constraint the per-workflow graph work addresses.
- `false` covers both a presented load failure and a load skipped because its
  caller is no longer current. Callers needing a richer distinction require a
  new result type across the workflow-service boundary.
- A replaced load returns an undefined `loaded` value, and `handleParsedFile`
  treats every non-`false` result as success, so a superseded load is not
  reported as such to its caller.

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
- **Moving asset scans out of the queued operation.** Not adopted. It would
  need a cancellation boundary for API and A1111 imports that does not exist
  yet, and without one a late scan could publish warnings for a workflow the
  user has already left.
- **Keying load state by graph.** Out of scope here. It becomes necessary only
  once a load can configure a background graph while another graph is visible,
  which `main` cannot do.

## References

- [PR #21983](https://github.com/Comfy-Org/ComfyUI_frontend/pull/21983), which
  established FIFO mutation, dispatch-scoped re-entry protection, and the
  capture ordering recorded here
- [Issue #22480](https://github.com/Comfy-Org/ComfyUI_frontend/issues/22480),
  which asked for this record
