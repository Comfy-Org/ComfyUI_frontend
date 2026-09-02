# Node Data Store

Date: 2026-07-05 (last revised 2026-07-24)
Status: Implemented. Follow-up to the
[link topology store](link-topology-store.md) and
[reroute chain store](reroute-chain-store.md).

Design record for extracting the remaining Node-owned components into a
dedicated store per [ADR-ECS](../adr/ECS-entity-component-system.md),
eliminating the `VueNodeData` mirror and, ultimately, all of
`src/composables/graph/useGraphNodeManager.ts`.

## Decision 1: One store, one plain state object per node

`nodeDataStore` holds a single plain `NodeState` object per node,
registered by reference with proxy-returning registration (the
`BaseWidget` pattern, [reroute store Decision 4](reroute-chain-store.md)).
ADR-ECS's Node component rows (`NodeVisual`, `Execution`, ...) become
field groupings inside `NodeState`, not separate records or stores.

The store uses the same flat root-scoped identity model as link and reroute
components:

```text
RootGraphId -> { byId, idsByOwner }
```

The root key groups one loaded workflow. `byId` enforces root-wide node
identity, while `idsByOwner` provides direct owner-local lookup and teardown.
`graphId` is association data, not an identity namespace. Registered ids are
immutable; deletion also verifies component identity and owner.

## Decision 2: Field set — what is NodeState, what is elsewhere

```text
NodeState {
  id: NodeId
  graphId: UUID            // owning (sub)graph association + locator ids
  type: string             // identity
  title: string
  titleMode?: TitleMode
  mode: LGraphEventMode
  flags: { collapsed?, pinned?, ghost? }
  color?: string
  bgcolor?: string
  shape?: RenderShape
  resizable?: boolean
  showAdvanced?: boolean
  inputs: INodeInputSlot[]
  outputs: INodeOutputSlot[]
}
```

Excluded — owned or derived elsewhere; referencing them here would be a
mirror (the hard constraint of this phase):

| Field                   | Owner                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selected`              | `canvasStore.selectedNodeIds` (already what `LGraphNode.vue` reads)                                                                                           |
| `executing`             | `executionStore` via `useNodeExecutionState` (already what Vue reads)                                                                                         |
| `hasErrors`             | derived from `executionErrorStore` / missing-model/media stores; `node.has_errors` stays a legacy-canvas class field written by `useNodeErrorFlagSync`        |
| position / size / z     | `layoutStore`                                                                                                                                                 |
| widget values / order   | `widgetValueStore`                                                                                                                                            |
| input link connectivity | `linkStore` (`getInputSlotLink` / `isInputSlotConnected`)                                                                                                     |
| `badges`                | derived on read by `nodeBadges()` in `src/systems/badgeSystem.ts`; the badge store was shipped and then deleted — see [Node Badge Store](node-badge-store.md) |

`VueNodeData.selected` and `.executing` are dead fields today (no
production consumer reads them); they are deleted, not migrated.

## Decision 3: Slot identity deferred; `inputs[].link` readers migrate now

`NodeInputSlot` / `NodeOutputSlot` are class instances with methods —
Slot entity extraction (ADR-ECS `SlotIdentity` etc.) is its own future
phase, so slot _identity_ stays class-side.

Slot _reactivity_ does not wait for it, and is no longer a graft
(revised 2026-07-24; see ecs-migration-plan.md 2e). `LGraphNode.inputs` /
`.outputs` are accessors over `shallowReactive` arrays whose setters
replace contents in place, and `NodeSlot`'s constructor returns
`shallowReactive(this)`. Both live in the class, so every node is
reactive from construction whether or not the renderer is mounted, and
`makeReactiveNodeArrays`' runtime `Object.defineProperty` grafting is
deleted. Shallow is deliberate: nested values (`boundingRect`, `_widget`,
`pos`) stay raw so identity comparisons and `NodeInputSlot`'s `WeakMap`
index cache keep working.

The slot arrays are fields on `NodeState`, held by reference rather than
copied. There is no per-slot key and no slot id: index is a property of the
containing array, and reorder operations mutate that array in place.

What this phase does remove is the last `inputs[].link` dependency: the
three remaining readers (`nodeDataUtils.linkedWidgetedInputs` used by
`NodeSlots`, and `usePartitionedBadges`' badge computed plus its
exported `trackNodePrice`) move to `linkStore.isInputSlotConnected`
queries — presence is all any of them needed — which deletes the
`node:slot-links:changed` → `refreshNodeInputs` reprojection in
`useGraphNodeManager`, the dead `node:slot-errors:changed` handler
(zero emitters repo-wide), and the node-removal refresh-all loop.
With their last listeners gone, both trigger actions are deleted
outright — emitters, event-map entries, and types. This is an extension-facing
change: connectivity observers must use reactive `linkStore`/`slotLinks`
queries or `onConnectionsChange`; error observers must use the dedicated error
stores or `nodeErrorState`. Readers get the root graph id from
`canvasStore.rootGraphId`, the shared tracked accessor, rather than
per-site `canvas?.graph?.rootGraph.id` chains.
Shipped ahead of the store itself (2026-07-05).

## Decision 4: Renderer consumes the NodeState proxy, `VueNodeData` dies

`GraphCanvas` reads the active owning graph's bucket and passes the reactive
`NodeState` proxy down
the existing prop-drilling path (`LGraphNode` → `NodeHeader` /
`NodeSlots` / `NodeContent` / `NodeWidgets`). Children read proxy fields
directly; Vue tracks the store state, so the per-property
`node:property:changed` → snapshot-rewrite handlers in
`useGraphNodeManager` are deleted wholesale.

Slot arrays reach `NodeSlots` through `NodeState`, not via
`getNodeByLocatorId`.

`LGraphNodePreview` constructs a synthetic `NodeState` (as it does a
synthetic `VueNodeData` today). `AppModeWidgetList` stops calling
`extractVueNodeData` and reads the registered `NodeState` + live node.

## Decision 5: Registration lifecycle and class adoption

Follows the shipped trio convention (`LLink` / `Reroute`):

- `LGraphNode` constructs its `_state: NodeState` at instantiation (via
  `createNodeShellState`); `registerNodeState(graph, node)` inserts it by
  reference and the class adopts the returned reactive proxy;
  `node._graphId` (root id) is the registration-ownership marker.
- Chokepoints: `LGraph.add` / `LGraph.remove` (the canonical sites),
  `unregisterAllNodeStates(graph)` on graph `clear()`, identity-checked
  delete (`toRaw` compare) so only the registered state vacates its key.
- Two ways that lifecycle can silently drift are asserted rather than left to
  the renderer to expose: re-registering an already-registered node under a
  different root graph (its old bucket entry would strand), and unregistering a
  state the bucket does not hold (`deleteNode` returning `false` — a ghost the
  renderer keeps drawing). Re-registering the _same_ state object under the
  _same_ root stays legal: `reactive()` returns a cached proxy, so
  unregister→register sequences (`useNodeReplacement`) are idempotent.
- `assert` throws in DEV and reports (Sentry) elsewhere, so both paths repair
  the store before reporting rather than relying on the throw to stop them:
  `registerNodeState` deletes the stale entry from the previous root's bucket
  and drops `node._graphScope` with it; `unregisterNodeState` clears
  `_graphScope` regardless of the outcome. A production build is left
  consistent, and a DEV throw cannot strand the node it names.
- Not asserted: a second `NodeState` object for a `(graphId, id)` the bucket
  already holds. Deserialising a graph keeps its persisted id, so two live
  `LGraph` instances round-tripped from one workflow share a bucket and collide
  on every node id by design. Catching duplicate-id regressions needs bucket
  identity to be per-instance rather than per-id — a separate change.
- The lifecycle coordination itself is app-owned and lives in
  `src/core/graph/nodeShell/`: `nodeShellState.ts` (`createNodeShellState`,
  `setTrackedNodeState`, `registerNodeState`, `unregisterNodeState`,
  `unregisterAllNodeStates`) and `nodeShellLifecycle.ts`
  (`attachNodeToStores`, `releaseGraphStores` — the single calls `LGraph.add`
  and `LGraph.clear` make into the stores). None of these are re-exported from
  the litegraph barrel; the registration surface is internal.
- Class fields become accessors reading through `_state`. Reads go
  through the reactive proxy directly (there is no `_stateRaw` raw view),
  so `node.title` / `node.mode` / … track inside Vue effects, matching a
  read of the store's `NodeState`. The one measured tight loop that reads
  `id` per node — `LGraph.computeExecutionOrder` — hoists it to a local
  once per iteration.
  The former `LGraphNodeProperties` own-property instrumentation was deleted.
  Internal observers use typed graph lifecycle events or reactive store reads
  instead of descriptor-triggered shell snapshots.
- `serialize()` / `toJSON` are unaffected: they read each field through
  its accessor, so the wire format is identical. Raw enumeration is not —
  see Decision 7.

## Decision 6: useGraphNodeManager is deleted (revised 2026-07-24)

Nothing remains. The original plan kept a slimmed successor for layout
seeding and slot reprojection; both were resolved instead:

| Was                                                      | Now                                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `extractVueNodeData`, `vueNodeData` map, `syncWithGraph` | deleted — renderer drills the `NodeState` proxy                                     |
| `node:property:changed` snapshot-rewrite handlers        | deleted — the proxy is already tracked                                              |
| `getNode()` / `nodeRefs`                                 | deleted — `nodeDataStore` for `flags.pinned`, `graph.getNodeById` for the live node |
| `node:slot-links:changed` handler                        | deleted — `linkStore.isInputSlotConnected` (Decision 3)                             |
| `makeReactiveNodeArrays` graft                           | deleted — reactivity is class-side from construction (Decision 3)                   |
| `node:slot-label:changed` array reprojection             | deleted — slot objects are reactive, so `slot.label = …` is tracked                 |
| layoutStore seeding + `onAfterGraphConfigured` deferral  | moved to `LGraph.add` / `LGraph.remove`                                             |
| `onNodeAdded` replay loop over existing nodes            | deleted — every node registers its own geometry as it attaches                      |

Moving layout seeding to `LGraph.add` needed no configure-time deferral:
the entry is created with whatever geometry the node has, and the
`pos`/`size` setters (which already write through to `layoutStore`) update
it as `configure()` applies the real values. This follows the precedent
already set by `LGraph.createReroute`.

Geometry now leaves the store the same way: `LGraph.remove` unregisters one
entry, and bulk teardown goes through one of two paths. A root graph's `clear`
calls `layoutStore.clearGraph(graphId)`, beside the five peer stores cleared
there, because layout is keyed by `rootGraphId` and so has a bucket to wipe.
Graphs that share the root's bucket — subgraphs, unconfigured graphs, and the
orphaned subgraph release — call `detachGraphLayouts` to drop entries
individually, mirroring `unregisterAllNodeStates` exactly. Both live in a
dedicated module so no teardown path re-derives the store writes by hand.

`useVueNodeLifecycle` is gone; `GraphCanvas` owns only the Layout↔LiteGraph
sync lifecycle, and while the Vue renderer is on it drops view-scoped slot and
link geometry when the viewed graph changes.

## Decision 7: Enumerability & extension migration (implemented 2026-07-22)

Adopting `_state` moves the shell-state fields (`title`, `type`, `mode`,
`flags`, `color`, `bgcolor`, `resizable`, `shape`, `showAdvanced`) from
own enumerable data properties on each node to getter/setters on
`LGraphNode.prototype` backed by the store proxy. Consequences for
extension authors:

- **Serialization and reactive reads are unchanged.** `serialize()` /
  `toJSON` still emit every field (explicit accessor reads), and
  `node.<field>` reads/writes still work and are now reactive — reading
  in a Vue effect tracks the store, writing goes through to it.
- **Raw enumeration no longer carries these fields.** They are prototype
  accessors, not own properties, so for a non-instrumented node
  `Object.keys(node)`, `{ ...node }`, `Object.assign({}, node)`, and
  `JSON.stringify(node)` do not include them. To snapshot shell state, read
  the node's accessors or the registered `NodeState` via `node._state` (the
  reactive proxy the node already holds), not a spread of the node.
- **`type` mutation is deprecated.** The compatibility setter warns and updates
  the store-backed state. New code should treat type as fixed at construction
  (`LiteGraph.createNode` / `LGraphNode(title, type)`) and create the correct
  node instead of mutating an existing one.

`inputs` and `outputs` are reinstated as enumerable own accessors in the
constructor (`LGraphNode.ts:1003-1011`), while `initializeWidgetsView` installs
the equivalent `widgets` accessor (`widgetsView.ts:45-65`). They therefore
appear in `Object.keys(node)` and `{ ...node }` — unlike the eight shell-state
fields above. `serialize()` also reads them explicitly so the wire format is
unchanged. Assigning
`node.inputs = [...]` still works and now replaces the array contents in
place rather than swapping the array.

`node.widgets` is now an own accessor backed by a mutation-tracked array Proxy.
Its render order is owned by `widgetValueStore`. Array mutations, indexed and
`length` writes, and assignment to `node.widgets` synchronize that order.
Assignment copies the supplied contents into the tracked array, so extensions
must not depend on the assigned array retaining its identity. Extensions must
also not depend on `widgets` being an own data property or on the exact shape of
its property descriptor. Read and mutate `node.widgets` through its array API,
or prefer `addWidget` / `addCustomWidget` / `removeWidget` for lifecycle-aware
changes.

Plain widget objects added through `addCustomWidget`, widget constructors, or
direct `node.widgets` mutation are normalized to store-backed widget instances.
When the object permits it, normalization preserves that object's identity and
upgrades it in place. A non-extensible object or one with conflicting
non-configurable properties is replaced by an equivalent concrete widget in
`node.widgets`. Extensions may keep using these entry points without code
changes, but must read the resulting `node.widgets` entry instead of assuming a
frozen or sealed input object remains the live widget.

Extension migration map: read a field → `node.<field>` (reactive) or
`node._state` (the reactive proxy the node already holds); snapshot all shell
state → read that `NodeState`, not `{ ...node }`; set `title` / `mode` /
colours / `flags` / `shape` / `showAdvanced` → assign the accessor (writes
through to the store); set `type` → construct the intended node type;
add or remove a widget → prefer `node.addWidget` / `node.removeWidget`; reorder
existing widgets → mutate `node.widgets` in place; add a plain custom widget →
use `addCustomWidget` and retain its return value, or read the resulting
`node.widgets` entry.

## Scope

Covers node shell state, the `VueNodeData` deletion, and the
`inputs[].link` reader migration. Out of scope: Slot entity extraction,
`Properties` (`properties` / `properties_info`) and `NodeType` metadata
beyond `type`/`apiNode` (`category`, `nodeData`, `description` remain on
the class/constructor), badges, `WidgetContainer` (already owned by
`widgetValueStore`), and command-pattern mutators (future work per
ADR-LAYOUT/ADR-ECS).
