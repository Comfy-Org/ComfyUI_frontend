# ADR-GRAPH-DOCUMENT-0045: Each Open Workflow Owns Its LGraph

Date: 2026-10-21

## Status

Proposed

Amends [ADR-GRAPH-DOCUMENT-0026](GRAPH-DOCUMENT-0026-frontend-document-model.md)
Phase 5 by landing the live-graph-per-workflow mechanism ahead of the document
container, under the existing `ComfyWorkflow` type.

## Context

The editor has held one `LGraph` since litegraph was adopted. `ComfyApp.setup`
creates it, attaches the only `LGraphCanvas` to it, and every workflow load
after that reuses it: `app.clean()` calls `rootGraph.clear()`, which tears down
every node, unregisters link topologies, wipes every root-keyed store, and
mints a new root id; then `rootGraph.configure(json)` rebuilds the incoming
workflow into the same object. A tab switch is therefore a full destroy and
rebuild, and nothing about the outgoing workflow survives except what
`ChangeTracker.deactivate()` copied into JSON first.

ADR-GRAPH-DOCUMENT-0026 lists the consequences. Every piece of per-tab state that is not on
the snapshot allowlist needs its own stash (previews, pending warnings,
viewport cache, widget histories, run errors) or leaks into the next tab.
Graph ids are recycled, so stores keyed by root graph id are only correct
while the matching workflow is on screen. Custom nodes that capture `app.graph`
or a node reference in `setup` watch it die on the next switch.

The routing infrastructure the rest of the app has moved to is already keyed
by root graph id: `graphMetadataStore`, `entityIdStore`, `linkStore`,
`layoutStore`, `widgetValueStore`, `selectionStore`, `executionErrorStore`,
and the subgraph navigation viewport cache. Two live roots with distinct ids
do not collide in any of them. The `LGraph.id` setter and `Subgraph`
constructor already refuse an id another live root occupies.

## Decision

`ComfyWorkflow` owns an `LGraph`. The instance is created by
`ComfyApp.createRootGraph()`, which installs the per-graph hooks that `setup`
used to install once: the `subgraph-created` registration, the
`onConfigure` wrapper that fires `onGraphConfigured` and
`onAfterGraphConfigured`, and node-added telemetry.

A configure-based load (`loadGraphData`, `loadApiJson`, A1111 import) still
clears and configures, but into the graph the target workflow owns, or into a
fresh instance when the current root belongs to another workflow. After the
load, `activateLoadedWorkflow` hands the configured root to the workflow with
`adoptGraph`.

A tab switch to a workflow whose graph is live no longer configures. It runs
the outgoing bookkeeping (`beforeLoadNewGraph`), calls
`ComfyApp.activateRootGraph(workflow.graph)`, which stops the outgoing graph's
step loop, swaps the canvas with `canvas.setGraph`, points the `rootGraph`
facade at the new instance, starts it, and then restores the tracker,
viewport, previews, and run errors. The switch still invokes the
`beforeLoadGraph` and `afterLoadGraph` extension hooks, because they mark a
change of the visible graph; `beforeConfigureGraph`, `afterConfigureGraph`,
and `loadedGraphNode` do not fire, because the nodes were not rebuilt.
`openWorkflow({ force: true })` and undo/redo keep the configure path.

A workflow releases its graph when it is unloaded (remote metadata change,
close of a persisted workflow) or when a temporary workflow is closed. Release
is `graph.clear()`, so the per-root store rows go with it.

`app.rootGraph`, `app.graph`, and `window.graph` stay as facades over the
active workflow's instance. `window.graph` becomes a getter so the value a
custom node reads is the live root, not the one captured at boot.

The global `domWidgetStore.clear()` on switch is gone. DOM widgets unregister
through `node.onRemoved`, which `graph.clear()` fires; a switch that does not
clear keeps the outgoing workflow's widgets registered and the existing
`litegraph:set-graph` listener marks them inactive.

## Consequences

### Positive

- The guards that exist only because the root was rebuilt in place become
  deletable once E2E coverage confirms the switch path: the
  `configuredGraphState === rootGraph.state` staleness tokens, the
  `pendingWorkflowResetGraph` hash suppression, the `isWorkflowSwitching`
  viewport guard, the preview stash, and the pending-warnings cache.
- Root graph ids are stable for the life of a tab, so id-keyed stores are
  correct across switches without a restore step.
- Node and widget objects survive a switch. Extensions that hold references
  taken during `setup` keep working after the user changes tabs.
- Switching is a pointer swap, the same mechanism subgraph navigation already
  uses.

### Negative

- N open loaded workflows hold N live graphs. `syncWorkflows` already unloads
  background workflows when their remote metadata changes, and closing a tab
  releases the graph, but there is no LRU yet. The hydration policy in
  ADR-GRAPH-DOCUMENT-0026 Phase 5 remains future work.
- Each started graph runs a `requestAnimationFrame` step loop. Background
  graphs are stopped on switch so only the active one runs.
- Two tabs that load the same serialized root id (duplicate, reopen before
  close completes) must mint distinct live ids. `adoptRootGraphId` and the id
  setter refusing occupied ids cover this today; it is the first thing the
  Playwright coverage listed in the tracking issue exercises.

## Alternatives considered

- **Keep the single graph and widen the snapshot allowlist.** Rejected by
  ADR-GRAPH-DOCUMENT-0026: every new per-tab concern becomes a hand-built stash, and
  graph-id recycling cannot be fixed by snapshotting.
- **Wait for the document container (ADR-GRAPH-DOCUMENT-0026 Phase 4) and land per-document
  graphs with it.** Rejected for now: the routing stores are already keyed by
  root id, so the graph can move under `ComfyWorkflow` without the container,
  and doing so first removes the guard code the container would otherwise
  have to preserve.
- **Dehydrate every background tab to JSON immediately.** This is the current
  behaviour with extra steps; it keeps the rebuild cost and the id recycling.
  Memory pressure is handled by an explicit eviction policy later, not by
  never holding more than one graph.
