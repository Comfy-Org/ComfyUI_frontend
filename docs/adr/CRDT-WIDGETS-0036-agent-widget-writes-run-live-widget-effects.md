# ADR-CRDT-WIDGETS-0036: Agent Widget Writes Run the Live Widget's Effects

Date: 2026-09-19

## Status

Proposed

## Context

A widget value reaches the frontend through two kinds of path, and today
they disagree about what a write means.

**Human edits fire the widget's effects.** The canvas gesture path,
`BaseWidget.setValue`, assigns the value, calls
`callback(value, canvas, node, pos, event)`, calls
`node.onWidgetChanged(name, value, oldValue, widget)`, and bumps the graph
version. The Vue path, `createWidgetUpdateHandler` in
`src/renderer/extensions/vueNodes/composables/processedWidgetRenderModel.ts`,
writes `widgetValueStore.setValue`, assigns `live.widget.value`, calls
`callback(value, app.canvas, node)` with no pointer arguments, and triggers a
redraw. Core programmatic writers do the same without any gesture at all:
`setNodeWidgetValue` (`src/core/graph/widgets/nodeWidgetValues.ts`) fires
`callback` and `onWidgetChanged`; `widgetValuePropagation.ts` fires `callback`
with a fabricated event; `useRemoteWidget.ts` coerces a combo's value into the
freshly loaded option list and fires `callback`. Across the codebase the
`callback` is the contract by which state that depends on a value follows it:
linked-widget propagation, remote option lists, custom-node option coercion,
and `onWidgetChanged` observers in third-party nodes.

**Agent writes do not.** The CRDT follower applies every doc widget entry
through `setWidgetValue` in
`src/workbench/extensions/agent/crdt/graphMutations.ts`, which only calls
`widgetValueStore.setValue(id, value, context)`. This holds for a single
`set_widget` op, for the widget values carried by a `reconcileNode`, and for
the full reconcile the adapter arms on the first frame of a session and on
the inactive-to-active tab edge (`reconcileNextFrame` in
`ecsFollowerAdapter.ts`). The store record is a plain-data `WidgetState`
(`src/types/widgetState.ts`), which by
[ADR-ECS-0008](ECS-0008-entity-component-system.md) and
[ADR-ECS-WIDGETS-0023](ECS-WIDGETS-0023-widget-entities-with-a-legacy-layer.md)
carries no `callback`; `GraphMutationsDeps` is `getScope()` plus a
renderer-owned `layout` port, and the module never imports the renderer
(`import-x/no-restricted-paths`: workbench must not import renderer).

The visible symptom that surfaced this is the false "invalid" ring on combo
widgets in agent workflow tabs (PM-1273): `WidgetSelectDefault.vue` marks a
value invalid when it is not in the widget's own `options.values`. Two
mechanisms produce that. Mechanism A, a freshly agent-created node's
placeholder widget carrying `options: {}` until the node materializes, is
fixed in the component on this branch. Mechanism B, a live widget whose value
changed without its dependent state (here the option list) being told, is the
subject of this ADR. The pinned repro in `graphMutations.test.ts` asserts the
contract (the live widget's `callback` is invoked for an agent-set value the
way it is for a human edit), not the ring itself; the ring is one consumer of
that contract.

Forces:

- **Layering.** Semantic mutation code stays renderer-free. The module already
  resolves this tension with a port (`SemanticLayoutMutationPort`, implemented
  at the composition root `AgentPanelRoot.vue`).
- **Plain-data components.** No behavior on `WidgetState`; no back-references.
- **Extension ecosystem.** `callback`, `onWidgetChanged`, and callback timing
  are observed by 40+ custom-node repositories. Any change needs a stated
  contract and migration guidance.
- **No-echo.** The mint port (`mintPortWiring.ts`) mints a human `set_widget`
  for every store value change that does not carry a
  `RemoteMutationContext`. A callback that writes a sibling widget writes
  without context.
- **Atomic batches.** `createGraphMutations` validates a whole batch against a
  simulated final state and then commits synchronously. Third-party code must
  not be able to break that commit halfway.
- **Follower reentrancy.** `EcsFollowerAdapter.applyFrame` drains a
  per-session queue under an `applying` guard; `reconcileLiveGraph` then
  materializes store-only nodes under `runMintPortsSuppressed`.

## Decision

An agent-applied widget value change is followed by the same live-widget
effects a human edit produces. The effects are requested through a
renderer-owned port on `GraphMutationsDeps`, are gated on the value actually
changing, and run after the batch has committed.

### Seam

```typescript
interface SemanticWidgetEffectPort {
  valueApplied(
    scope: GraphScope,
    nodeId: NodeId,
    name: string,
    value: WidgetValue,
    previous: WidgetValue,
    context: RemoteMutationContext
  ): void
}

export interface GraphMutationsDeps {
  getScope(): GraphScope | null
  layout: SemanticLayoutMutationPort
  widgets: SemanticWidgetEffectPort
}
```

The port is required, not optional, for the reason the in-flight placement
port (#18084) gives for its own: an optional member degrades to a silent
no-op at any construction site that forgets it, and the compiler is the
cheapest place to catch that. `graphMutations.ts` reports that a store value was applied; it
does not know what a callback is.

### What `graphMutations.ts` does

- Every widget write in `commit` (the named path in `setWidgetValue` and the
  positional path in `applyWidgetValues`) goes through one helper. It reads
  `previous` from the store, writes with the remote context, and when
  `!Object.is(previous, value)` appends `{ nodeId, name, value, previous }`
  to a per-batch effect list. A placeholder registration (the widget has no
  store record yet) records nothing.
- After `commit` returns, `batch` drains the list in commit order, which is
  payload order, calling `deps.widgets.valueApplied(...)` for each entry. Each
  call is isolated: a throwing port is reported through `reportError` with
  `errorType: 'error_applying_agent_widget_effects'` and the remaining entries
  still run. `batch` still returns `true`; the store commit succeeded.
- Object-valued writes are cloned on the way in (`cloneWidgetValue`), so an
  object value always counts as changed. That matches the human path, which
  fires on every edit, and is accepted.

### What the port implementation does

`src/workbench/extensions/agent/crdt/liveWidgetEffects.ts` (new) exports
`createLiveWidgetEffectPort({ getGraph, getCanvas })`. It lives beside
`mintPortWiring.ts`, takes its graph and canvas by injection for the same
reason that module does, and is wired at `AgentPanelRoot.vue` with the getters
the follower and mint ports already use. Per call:

1. Resolve the live node with `getNodeByLocatorId(rootGraph,
locatorIdFromState({ id: nodeId, graphId: scope.owningGraphId },
scope.rootGraphId))`, and the live widget with
   `mapLiveWidgetsById(node).get(widgetId(scope.rootGraphId, nodeId, name))`.
   This is the resolution `processedWidgetRenderModel.ts` uses, so duplicate
   widget names resolve the same way on both paths. No live node or no live
   widget (a store-only node, a widget an extension removed) is a no-op.
2. `widget.value = value`. Store-backed widgets already read through; the
   assignment is for foreign widget objects that are not store-backed
   (ADR-ECS-WIDGETS-0023).
3. `widget.callback?.(value, canvas, node)`, with `canvas` from `getCanvas()`
   and no pointer arguments, the signature `createWidgetUpdateHandler` uses.
4. `node.onWidgetChanged?.(name, value, previous, widget)`.
5. `node.widgets?.forEach((w) => w.triggerDraw?.())`.

It does not call `graph.incrementVersion()`: the frame is not a local undo
step, and the Vue human path does not bump it either. It does not run inside
`runMintPortsSuppressed`; see reentrancy below.

### Answers to the open design questions

**Are agent writes indistinguishable from human edits at the callback
level?** For a live widget, yes, at the Vue path's signature. For a
placeholder write (the node is not yet materialized) no effect fires:
materialization runs `LGraphNode.configure()`, which assigns widget values
without callbacks, exactly as opening a workflow does. Agent-created nodes get
load semantics; agent edits to live nodes get edit semantics.

**Where does the live-widget access live?** Not in `graphMutations.ts` (layer
rule; it would also need `app.canvas`), not on the store (plain data), not in
`useAgentCrdtFollower.ts` (a transport and lifecycle shell). It is a port on
`GraphMutationsDeps` like `layout`, implemented in a workbench module with
injected graph and canvas getters, wired at the composition root.

**How is an N-callback storm against stale intermediate values avoided?**
Three properties together: effects are change-gated, so the tab-switch full
reconcile of unchanged values fires nothing; effects run after commit, so
every callback observes the batch's final store state and never an
intermediate one; and there is one effect per changed widget, in payload
order, which is the count a human producing those changes would cause.
Effects are not coalesced per node: `callback` is a per-widget contract.

**Do third-party callbacks assume a real gesture or a valid `app.canvas`?**
The signature and the absence of pointer arguments are already what the Vue
edit path passes, and core programmatic writers pass less (`callback(value)`
in `useRemoteWidget.ts` and `customWidgets.ts`, a fabricated event in
`widgetValuePropagation.ts`). An extension that tolerates those tolerates
this. What is new is the trigger: a callback can now run from a socket frame
with no user interaction on that node, as remote-widget refresh already does.
Frames apply only while the target workflow's tab is active, so `getCanvas()`
returns the canvas showing that workflow. A throwing callback is isolated and
reported instead of breaking the frame.

**Reentrancy against the follower's own resync.** Effects run synchronously
at the end of `batch`, inside `applyFrame`'s per-session `applying` guard, and
before `reconcileLiveGraph`. The follower never writes the shared document,
so no callback can produce a new frame. A callback that writes a sibling
widget (`widget.value = x`, no remote context) is minted as a human
`set_widget` by the mint port, and that is deliberate: the derived value is
new information the document does not have, the human edit path mints it the
same way, and suppressing it would let the next reconcile revert the derived
value. The loop bound is the store setter's identity check: an echoed frame
that carries the value the callback already wrote is unchanged and fires
nothing, so a loop requires a callback that changes the value on every
invocation, which is a pre-existing bug under human editing too.

### Alternatives considered

- **Read-only `getLiveWidget` accessor on `GraphMutationsDeps`, with
  `graphMutations.ts` calling the callback.** Puts litegraph calls and
  `app.canvas` in the semantic layer. Rejected on layering; the port keeps
  the same reach with the dependency inverted.
- **A store listener, symmetric to the mint port**
  (`widgetValueStore.onValueChange` filtered on `isRemoteMutationContext`).
  Needs no change to `graphMutations.ts`, but the listener fires inside the
  value setter, mid-commit: a throwing callback aborts the batch halfway, and
  no callback sees the batch's final state. Deferring to a microtask would fix
  ordering but makes the effect asynchronous with respect to the frame and
  the tests. Rejected; it remains the natural shape if a second remote writer
  ever appears.
- **Generic options resync independent of `callback`** (option 2 on the PR).
  No generic hook exists; the sync logic that matters lives inside callbacks
  and `onWidgetChanged`; it would be a second, agent-only contract extensions
  do not implement. Rejected.
- **Re-derive core combo options from the node definition** (option 3).
  Static definition combos cannot go stale, so it fixes nothing there, and it
  misses remote and custom combos and every non-combo dependent effect.
  Rejected.
- **Run effects under `runMintPortsSuppressed`.** Prevents echo but leaves
  derived values unminted, so the document diverges from the live graph until
  a reconcile reverts them. Rejected; see reentrancy above.
- **Run effects after `reconcileLiveGraph` so freshly materialized nodes get
  them.** Contradicts load semantics and fires callbacks a workflow load would
  not. Rejected.
- **Keep the live callback on `WidgetState`.** Violates plain-data components
  and reintroduces the back-reference ADR-ECS-WIDGETS-0023 removes. Rejected.

### Scope: node fields (PM-1155 family) are out

The autogrow display bugs come from a different mechanism:
`nodeDataStore.assignNodeFields` and `prepareNode` replacing a live node's
color and slot metadata wholesale from a document that never carries them.
Node fields have no per-field effect contract to honor (`onConfigure` is a
load-time hook), and the fix is merge-onto-live in the reconcile path, which
is in flight separately. The two share one principle, that the apply layer
must not treat the document payload as the whole truth about a live entity,
and nothing else. This port is not the vehicle for node fields; a node-level
effect, if one is ever needed, is a separate port.

## Implementation plan

Files:

- `src/workbench/extensions/agent/crdt/graphMutations.ts`:
  `SemanticWidgetEffectPort`, `GraphMutationsDeps.widgets`, the shared write
  helper with change gating and effect recording, the post-commit drain in
  `batch`.
- `src/workbench/extensions/agent/crdt/liveWidgetEffects.ts` (new):
  `createLiveWidgetEffectPort({ getGraph, getCanvas })`.
- `src/workbench/extensions/agent/AgentPanelRoot.vue`: pass
  `widgets: createLiveWidgetEffectPort({ getGraph: () => (app.isGraphReady
? app.rootGraph : null), getCanvas: () => app.canvas })`.
- Every test that constructs `createGraphMutations` gains the required port,
  a recording fake by default.

Tests, in TDD order:

1. **Red.** The pinned `it.fails` in `graphMutations.test.ts` becomes the red
   test with two adaptations its assertion needs and the fix does not change:
   the live node is added to an `LGraph` (scope from `graphScopeOf`, as the
   file's `graphWithStoreOnlyNode` already does) so live resolution can find
   it, and `mutations()` is built with the real
   `createLiveWidgetEffectPort({ getGraph: () => graph, getCanvas: () =>
undefined })`. The assertion stays
   `callback` called with `(value, undefined, expect.any(LGraphNode))`.
   It flips from `it.fails` to `it` when green.
2. **Port contract in `graphMutations.test.ts`** with a recording fake, as
   one table: named `setWidget`, positional `reconcileNode`, named
   `reconcileNodeFields`, each yielding one `valueApplied` per changed widget
   with the right `previous`; an unchanged resync yielding none; a
   placeholder write yielding none; order equal to payload order; every
   effect observing the batch's final store state; a throwing port producing
   one `reportError` while later effects still run and `batch` returns
   `true`; a rejected batch yielding no effects.
3. **`liveWidgetEffects.test.ts`** against a real `LGraph` and `LGraphNode`:
   `callback` and `onWidgetChanged` arguments; `widget.value` assignment on a
   foreign widget object; no-op for a store-only node, a missing widget, and
   resolution of a subgraph-owned scope.
4. **Mint echo** (in `mintPortWiring.test.ts` or the adapter integration
   suite): an agent write whose callback writes a sibling widget mints exactly
   one human `set_widget` for the sibling and none for the agent-written
   widget; an idle callback mints nothing.
5. **Component.** The `WidgetSelectDefault` tests on this branch are
   unchanged; the ring is a consumer, not the unit under test.
6. **End-to-end.** Not required to merge. The agent replay harness needs a
   live CRDT-enabled backend (`RUN-CLOUD-E2E.md`), and the ring needs a node
   whose callback rebuilds its option list. A follow-up may add a
   `test.fail`-then-`test` pin next to `agentTabSwitchCatchUp.spec.ts`
   asserting a combo carries no `aria-invalid` after an agent set and a tab
   switch; it is a regression pin, not the proving level.

Rollout: no new flag. The path only runs for agent-applied writes, which are
already behind `agentPanelStore.enabled`
([ADR-CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md)).
Observability is the `reportError` slug above, which makes an extension
callback that breaks under agent writes visible in telemetry instead of
silent.

Migration guidance for extension authors, to accompany the change: a widget's
`callback` and its node's `onWidgetChanged` now also fire when the in-app
agent changes the value, with `(value, canvas, node)` and no pointer
arguments. Treat that invocation as programmatic, like a remote option
refresh, not as a pointer gesture.

## Consequences

### Positive

- One contract for "a widget value changed" regardless of who changed it, so
  dependent state, remote option lists, propagation, and `onWidgetChanged`
  observers stop diverging under agent writes.
- The semantic layer stays renderer-free and plain-data; the only new surface
  is a port shaped like the one that already exists.
- Batches remain atomic and third-party failures are isolated and reported.

### Negative

- Third-party callbacks now run on a new trigger. Callbacks that assume a
  pointer gesture, or that are not idempotent, surface as reported errors or
  as extra minted ops instead of staying latent.
- Callbacks that write sibling widgets mint human ops during an agent frame,
  so an agent turn can produce human-attributed operations on the wire. This
  is convergent, but it changes what the operation log shows.
- `GraphMutationsDeps` grows a second port and every construction site must
  supply it; an in-flight change adds a third (`placement`), so the type will
  see a small merge.

## Notes

- At the time of writing, open pull requests touching this layer add a
  `placement` port to `GraphMutationsDeps` (#18084), merge node fields onto
  live state in `prepareNode` (#18081), and pin reconcile-overwrite repros in
  `graphMutations.test.ts` (#18075, #18089, #18102). None changes
  `setWidgetValue` or `applyWidgetValues`; the expected conflicts are the
  deps type and test-file adjacency.
- The Vue human path omits `onWidgetChanged` while the canvas path fires it.
  That pre-existing inconsistency is not resolved here.
- `setNodeWidgetValue` in `src/core/graph/widgets/nodeWidgetValues.ts` runs
  the same effect sequence for core programmatic writes and could share a
  helper with the port implementation.
