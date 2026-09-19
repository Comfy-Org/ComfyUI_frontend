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
(`import-x/no-restricted-paths`, `eslint.config.ts`: workbench must not
import renderer).

This is a contract gap, not a rendering bug: an agent write bypasses the live
widget's `value` accessor, its `callback`, and its node's `onWidgetChanged`,
so anything an extension or core node hangs on those never runs for an agent
edit. Two concrete beneficiaries in core:

- The **Custom Combo** node (`src/extensions/core/customWidgets.ts`) redefines
  each `option*` widget's `value` accessor; the setter rebuilds the combo's
  `options.values` through `updateCombo()`. An agent write lands in the store
  and never passes through that accessor, so the combo's option list does not
  follow the agent's edits. The `widget.value = value` step below is what
  closes this, not the callback.
- **`PrimitiveNode`** (`src/extensions/core/widgetInputs.ts`) chains
  `callback → applyToGraph()`, which propagates the primitive's value to every
  linked target widget. An agent edit to a primitive today changes the
  primitive and none of its targets.

The visible symptom that surfaced this work is the false "invalid" ring on
combo widgets in agent workflow tabs (PM-1273): `WidgetSelectDefault.vue`
marks a value invalid when it is not in the widget's own `options.values`.
Two mechanisms were traced. Mechanism A, a freshly agent-created node's
placeholder widget carrying `options: {}` until the node materializes, is
fixed in the component on this branch. Mechanism B is the contract gap above.
The ring on a **core static combo** is not a consequence of mechanism B: no
production `callback` rebuilds a static combo's `options.values` (those lists
refresh through `app.reloadNodeDefs` and `PrimitiveNode.refreshComboInNode`,
driven by the refresh command; remote combos read `options.values` through a
getter in `useComboWidget.ts` / `useRemoteWidget.ts`). A static combo that
still rings after mechanism A is a stale node definition, out of scope here.
The pinned repro in `graphMutations.test.ts` therefore asserts the contract
(the live widget's `callback` is invoked for an agent-set value the way it is
for a human edit), not the ring; the ring is one consumer of that contract,
and ring clearance additionally depends on the option mutation being
reactive (see Notes).

Forces:

- **Layering.** Semantic mutation code stays renderer-free. The module already
  resolves this tension with a port (`SemanticLayoutMutationPort`, implemented
  at the composition root `AgentPanelRoot.vue`). The live-widget access this
  ADR needs (`getNodeByLocatorId`, `mapLiveWidgetsById` in `@/utils`,
  `app.canvas` in `@/scripts/app`) does not itself cross the lint boundary;
  the honest rationale for a port is dependency inversion: the semantic
  layer's tests run without a live graph, and the semantic layer does not
  learn what a callback is.
- **Plain-data components.** No behavior on `WidgetState`; no back-references.
- **Extension ecosystem.** `callback`, `onWidgetChanged`, and callback timing
  are observed by 40+ custom-node repositories. Any change needs a stated
  contract and migration guidance.
- **No-echo.** The mint port (`mintPortWiring.ts`) mints a human `set_widget`
  for every store value change that does not carry a
  `RemoteMutationContext`. A callback that writes a widget writes without
  context. The follower clones every object value on the way in
  (`cloneWidgetValue`), so identity is never a usable change signal for
  objects and arrays.
- **Atomic batches.** `createGraphMutations` validates a whole batch against a
  simulated final state and then commits synchronously. Third-party code must
  not be able to break that commit halfway.
- **Follower reentrancy.** `EcsFollowerAdapter.applyFrame` drains a
  per-session queue under an `applying` guard (`ecsFollowerAdapter.ts`);
  `AgentCrdtProjection.reconcileLiveGraph` (`agentCrdtProjection.ts`) then
  materializes store-only nodes under `runMintPortsSuppressed`.
  `useAgentCrdtFollower.ts` only calls them.
- **Concurrent edits to the same seam.** #18089 pins that a doc value must
  not overwrite a newer local value; its recency guard lands in the same
  write helper this ADR introduces.

## Decision

An agent-applied widget value change is followed by the same live-widget
effects a human edit produces. The effects are requested through a
renderer-owned port on `GraphMutationsDeps`, are gated on the store value
actually changing, and run after the batch has committed.

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
cheapest place to catch that. `graphMutations.ts` reports that a store value
was applied; it does not know what a callback is.

### What `graphMutations.ts` does

- Every widget write in `commit` (the named path formerly in `setWidgetValue`
  and the positional path in `applyWidgetValues`) goes through one helper,
  `applyWidgetWrite(scope, nodeId, name, value, context) → { applied,
previous }`. It reads `previous` from the store record, writes with the
  remote context, and reports whether the write was applied. A write for a
  widget with no store record registers a placeholder and reports `applied`
  with `previous: undefined`. The recency guard #18089 adds (skip a doc
  value the local value has superseded) belongs inside this helper and
  reports `applied: false`.
- The caller records an effect `{ nodeId, name, value, previous }` only when
  the write was applied **and** the store's post-write value differs from
  `previous`. Difference is `Object.is` for primitives and structural
  equality (`isEqual` from es-toolkit) for objects and arrays. Effects are
  never recorded from a pre-computed comparison of the requested value: a
  guarded write that did not land must not fire a callback with a value the
  store does not hold.
- `previous` is re-read from the store per write, so a widget written twice
  in one batch (a `reconcileNode` full `widgets_values` followed by a
  `changedWidgets` `setWidget` of the same value, which
  `ecsFollowerAdapter.ts` produces) yields one effect.
- Node creation (`addNode`, `replaceNode`, and the placeholder records they
  register) records nothing: those are registrations, not writes, and no
  live node can exist for an id the batch is creating.
- The effect list is a local of the `batch` call, never instance state.
  After `commit` returns, `batch` drains it in commit order, which is payload
  order, calling `deps.widgets.valueApplied(...)` for each entry. Each call is
  isolated: a throwing port is reported through `reportError` with
  `errorType: 'error_applying_agent_widget_effects'` and the remaining entries
  still run. `batch` still returns `true`; the store commit succeeded. A
  rejected batch records and drains nothing.
- A callback that re-enters `graphMutations` with a remote context (a nested
  `batch`) drains its own effects before returning to the outer drain, so
  drains never interleave.

### What the port implementation does

`src/workbench/extensions/agent/crdt/liveWidgetEffects.ts` (new) exports
`createLiveWidgetEffectPort({ getGraph, getCanvas })`. It lives beside
`mintPortWiring.ts`, takes its graph and canvas by injection for the same
reason that module does, and is wired at `AgentPanelRoot.vue` with the getters
the follower and mint ports already use. Per call, resolution happens at
drain time, so a callback earlier in the same drain that removes a later
entry's widget or node makes that entry a no-op:

1. Take `getGraph()?.rootGraph`; if there is none, or its id is not
   `scope.rootGraphId`, do nothing. `getScope()` is per workflow and
   `app.rootGraph` is the displayed workflow; without this check a frame for
   one workflow could resolve node ids in another.
2. Resolve the live node with
   `getNodeByLocatorId(rootGraph, locatorIdFromState({ id: nodeId, graphId:
scope.owningGraphId }, rootGraph.id))`; `locatorIdFromState` returns
   `null` for an unparseable id, which is a no-op. Then require
   `useNodeDataStore().ownsNode(scope, node._state)`, the same check
   `agentNodeMaterializer.ts` uses to tell a live node from an orphan.
   Effects run before `reconcileLiveGraph`, so the live node for an id the
   batch just replaced, re-added, deleted, or cleared is still in the graph
   with a state object the store no longer holds; it must not receive a
   value meant for its successor.
3. Resolve the live widget with
   `mapLiveWidgetsById(node).get(widgetId(scope.rootGraphId, nodeId, name))`.
   This is the resolution `processedWidgetRenderModel.ts` uses, so duplicate
   widget names resolve the same way on both paths. No live widget (a widget
   an extension removed, or a doc entry the node never had) is a no-op.
4. `widget.value = value`. Store-backed `BaseWidget`s already read through;
   the assignment is for live widget objects that do not, such as plain
   objects an extension pushed into `node.widgets`, and for accessors an
   extension defined on top of a widget, such as Custom Combo's `option*`
   setters. It is mandatory.
5. `widget.callback?.(value, canvas, node)`, with `canvas` from `getCanvas()`
   and no pointer arguments, the signature `createWidgetUpdateHandler` uses.
   `canvas.graph` may be a subgraph the user has opened inside the displayed
   workflow, so `canvas.graph !== node.graph` is possible; the Vue path has
   the same property.
6. `node.onWidgetChanged?.(name, value, previous, widget)`.
7. `node.widgets?.forEach((w) => w.triggerDraw?.())`.

It does not call `graph.incrementVersion()`: the frame is not a local undo
step, and the Vue human path does not bump it either. It does not run inside
`runMintPortsSuppressed`; see reentrancy below.

### What "placeholder" means

A write fires effects when a live node with that widget exists, regardless
of whether the store held a record for the widget before the write. The
semantic layer reports every applied write; the port decides by live
presence. Consequences:

- An agent-created node that has not materialized has no live node: its
  writes fire nothing. Materialization runs `LGraphNode.configure()`, which
  assigns widget values without callbacks, exactly as opening a workflow
  does. Agent-created nodes get load semantics; agent edits to live nodes get
  edit semantics.
- A live widget with no store record (a plain-object widget `LGraph.add`
  cannot bind, a widget skipped for a duplicate name) receives its first
  agent write as a live write, with `previous: undefined`. Defining the
  placeholder by store-record absence instead would make the first write to
  such a widget silent and the second one live, which is not a contract an
  extension author can reason about.

### `onWidgetChanged` on an agent write

Nothing in core treats `onWidgetChanged` as evidence of a pointer gesture.
The canvas path reaches it through `BaseWidget.setValue`; the Vue path skips
it and calls `clearWidgetRelatedErrors` directly; core programmatic writers
(`nodeWidgetValues.ts`, `uploadAudio.ts`, `createAssetWidget.ts`,
`useImageUploadWidget.ts`) fire it without a gesture. What it triggers in
core is `useErrorClearingHooks.ts`, which chains it to clear execution and
validation errors for that widget (a `required_input_missing` on the input
the agent just filled, an out-of-range value the agent just corrected). An
agent write therefore clears the same errors a human edit clears, which is
the desired contract and is pinned by a test.

### Answers to the open design questions

**Are agent writes indistinguishable from human edits at the callback
level?** For a live widget, yes, at the Vue path's signature. See "What
placeholder means" for the unmaterialized case.

**Where does the live-widget access live?** Not in `graphMutations.ts`
(dependency inversion; it would also need `app.canvas`), not on the store
(plain data), not in `useAgentCrdtFollower.ts` (a transport and lifecycle
shell). It is a port on `GraphMutationsDeps` like `layout`, implemented in a
workbench module with injected graph and canvas getters, wired at the
composition root.

**How is an N-callback storm against stale intermediate values avoided?**
Three properties together: effects are change-gated on the applied store
value, structurally for objects, so the first frame of a session, the
tab-switch full reconcile, and the retry after a rejected batch fire nothing
for unchanged values, object-valued or not; effects run after commit, so
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
A throwing callback is isolated and reported instead of breaking the frame.

**Reentrancy against the follower's own resync.** Effects run synchronously
at the end of `batch`, inside `applyFrame`'s per-session `applying` guard, and
before `reconcileLiveGraph`. The follower never writes the shared document,
so no callback can produce a new frame directly. A callback that writes a
widget (`widget.value = x`, no remote context) is minted as a human
`set_widget` by the mint port, and that is deliberate: the derived value is
new information the document does not have, the human edit path mints it the
same way, and suppressing it would let the next reconcile revert the derived
value. The loop bound is structural equality on the applied write. Consider
the echo of such a mint: the server applies the human `set_widget`, `Y.Map.set`
always emits an update, the follower's `changedWidgets` path calls
`batch.setWidget` with a fresh clone, and the store now holds the callback's
own object. Under identity comparison the clone always counts as a change and
a callback that normalizes its value into a new object (`widget.value = {
...v }`) loops forever through mint, server, and echo. Under structural
equality the echo is unchanged, fires nothing, and the callback's rewrite
mints exactly once. A loop then requires a callback that changes the
_content_ of its value on every invocation, which is a pre-existing bug
under human editing too.

**Subgraphs.** `getScope()` always yields the root graph in production
(`AgentPanelRoot.vue`, `agentNodeMaterializer.ts`), so the port resolves root
nodes; interior nodes are reached only through promoted host widgets, whose
bridge (`promotedInputWidget.ts` to `widgetMintPort.ts`) is bounded by the
same structural-equality gate. The port still resolves a subgraph-owned
scope correctly through `locatorIdFromState`, for whenever interior scopes
are applied.

### Alternatives considered

- **Read-only `getLiveWidget` accessor on `GraphMutationsDeps`, with
  `graphMutations.ts` calling the callback.** Puts litegraph calls and
  `app.canvas` in the semantic layer. Rejected; the port keeps the same
  reach with the dependency inverted.
- **A store listener, symmetric to the mint port**
  (`widgetValueStore.onValueChange` filtered on `isRemoteMutationContext`).
  Needs no change to `graphMutations.ts`, but the listener fires inside the
  value setter, mid-commit: a throwing callback aborts the batch halfway, and
  no callback sees the batch's final state. Deferring to a microtask would fix
  ordering but makes the effect asynchronous with respect to the frame and
  the tests. Rejected; it remains the natural shape if a second remote writer
  ever appears.
- **Identity (`Object.is`) as the change gate.** Defeated by the clone every
  object value takes on the way in; every full reconcile would fire every
  object-valued widget, and a normalizing callback would loop. Rejected in
  favor of structural equality.
- **Consulting `pendingOpLedger` so the echo of a locally minted op never
  fires effects.** Not needed once the gate is structural: the echo carries
  the value the store already holds. The ledger is also a concern of the
  sender, not of the apply layer. Left as a follow-up if a non-idempotent
  callback ever surfaces in telemetry.
- **Dropping recorded effects for node ids `commit` registered, replaced,
  or deleted, instead of the ownership check in the port.** Equivalent for
  the in-batch cases; the ownership check additionally covers an orphan left
  by an earlier frame whose `reconcileLiveGraph` threw, so the port does it.
- **Placeholder defined by store-record absence.** See "What placeholder
  means". Rejected.
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
is in flight separately (#18081). The two share one principle, that the apply
layer must not treat the document payload as the whole truth about a live
entity, and nothing else. This port is not the vehicle for node fields; a
node-level effect, if one is ever needed, is a separate port.

## Implementation plan

Files:

- `src/workbench/extensions/agent/crdt/graphMutations.ts`:
  `SemanticWidgetEffectPort`, `GraphMutationsDeps.widgets`,
  `applyWidgetWrite`, effect recording with the structural gate, the
  post-commit drain in `batch`.
- `src/workbench/extensions/agent/crdt/liveWidgetEffects.ts` (new):
  `createLiveWidgetEffectPort({ getGraph, getCanvas })`.
- `src/workbench/extensions/agent/crdt/__fixtures__/widgetEffectPorts.ts`
  (new): an inert port and a recording port, mirroring #18084's
  `inertPlacementPort.ts`, for the construction sites that do not exercise
  effects.
- `src/workbench/extensions/agent/AgentPanelRoot.vue`: pass
  `widgets: createLiveWidgetEffectPort({ getGraph: () => (app.isGraphReady
? app.rootGraph : null), getCanvas: () => app.canvas })`.
- Every test that constructs `createGraphMutations` gains the required port:
  `graphMutations.test.ts`, `ecsFollowerAdapter.integration.test.ts`,
  `agentNodeMaterializer.test.ts`, `agentSubgraphFollower.test.ts`,
  `agentCrdtProjection.integration.test.ts`.

Tests, in TDD order:

1. **Red.** The pinned `it.fails` in `graphMutations.test.ts` becomes a plain
   `it`. Its fixture is adapted because the original cannot pass under any
   implementation: the live node was never in an `LGraph`, so nothing can
   resolve it. The adapted test adds the node to a real `LGraph` (scope from
   `graphScopeOf`, because the resolver reads `node.graph.rootGraph.id`),
   which registers the node record itself, so the separate `addNode` and
   `registerLiveWidgets` calls go away, and builds the mutations with the real
   `createLiveWidgetEffectPort({ getGraph: () => graph, getCanvas: () =>
undefined })`. The assertion is unchanged: `callback` called with
   `(value, undefined, liveNode)`, plus the live widget holding the value.
2. **Port contract in `graphMutations.test.ts`** with the recording port, as
   one table: a changed primitive, an unchanged primitive, an unchanged
   object under a new identity, a changed object, a write for a widget with
   no record (`previous: undefined`), and a widget written twice in one
   batch, each with the expected effect list; plus payload order, effects
   observing the batch's final store state, a throwing port producing one
   `reportError` while later effects still run and `batch` returns `true`,
   and a rejected batch yielding no effects.
3. **`liveWidgetEffects.test.ts`** against a real `LGraph` and `LGraphNode`:
   `callback` and `onWidgetChanged` arguments; no-op for a store-only node,
   a missing widget, and a root graph that is not the scope's; no effect on
   the orphan when `setWidget` follows `replaceNode` in one batch; an agent
   write clearing a `required_input_missing` error through
   `installErrorClearingHooks`.
4. **Mint echo** in `agentCrdtProjection.integration.test.ts` (live graph,
   follower, and the real port, with `attachMintPortWiring` attached): an
   agent write whose callback rewrites its own widget with an equal-content
   object mints exactly one human `set_widget`, and the echo frame of that
   mint mints nothing.
5. **Component.** The `WidgetSelectDefault` tests on this branch are
   unchanged; the ring is a consumer, not the unit under test.
6. **End-to-end.** Not required to merge. The agent replay harness needs a
   live CRDT-enabled backend (`RUN-CLOUD-E2E.md`), and the ring needs a node
   whose callback rebuilds its option list reactively. A follow-up may add a
   `test.fail`-then-`test` pin next to `agentTabSwitchCatchUp.spec.ts`
   asserting a Custom Combo carries no `aria-invalid` after an agent set and
   a tab switch; it is a regression pin, not the proving level.

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
refresh, not as a pointer gesture. A callback that rewrites its own value
should produce the same content for the same input; a callback that changes
content on every call will mint a human operation per agent frame.

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
- Callbacks that write widgets mint human ops during an agent frame, so an
  agent turn can produce human-attributed operations on the wire. This is
  convergent, but it changes what the operation log shows.
- `GraphMutationsDeps` grows a second port and every construction site must
  supply it; an in-flight change adds a third (`placement`), so the type will
  see a small merge.
- Structural comparison runs once per applied object-valued write. Widget
  values are small; a pathological value would already be slow to clone.

## Notes

- At the time of writing, open pull requests touching this layer add a
  `placement` port to `GraphMutationsDeps` (#18084), merge node fields onto
  live state in `prepareNode` (#18081), and pin reconcile-overwrite repros in
  `graphMutations.test.ts` (#18075, #18089, #18102). #18089's recency guard
  belongs inside `applyWidgetWrite` and reports `applied: false`; the others
  conflict only on the deps type and test-file adjacency. The README index
  row will conflict with 0035's on merge.
- Ring clearance for a combo whose callback rebuilds `options.values` also
  depends on that mutation being reactive. `WidgetSelectDefault` reads the
  render model's shallow snapshot of the store's options
  (`processedWidgetRenderModel.ts`); a callback assigning
  `widget.options.values = next` writes through the options shim to
  `_rawOptions` (`BaseWidget.ts`), which does not re-trigger the model,
  whereas Custom Combo's `shallowReactive` array with `splice` does. Making
  raw option writes reactive is a renderer concern outside this ADR.
- The Vue human path omits `onWidgetChanged` while the canvas path fires it.
  That pre-existing inconsistency is not resolved here.
- `setNodeWidgetValue` in `src/core/graph/widgets/nodeWidgetValues.ts` runs
  the same effect sequence for core programmatic writes and could share a
  helper with the port implementation.
