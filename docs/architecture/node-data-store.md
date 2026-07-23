# Node Data Store

Date: 2026-07-05
Status: Draft (design interview in progress; follow-up to the
[link topology store](link-topology-store.md) and
[reroute chain store](reroute-chain-store.md))

Design record for extracting the remaining Node-owned components into a
dedicated store per [ADR 0008](../adr/0008-entity-component-system.md),
eliminating the `VueNodeData` mirror and most of
`src/composables/graph/useGraphNodeManager.ts`.

## Decision 1: One store, one plain state object per node

`nodeDataStore` holds a single plain `NodeState` object per node,
registered by reference with proxy-returning registration (the
`BaseWidget` pattern, [reroute store Decision 4](reroute-chain-store.md)).
ADR 0008's Node component rows (`NodeVisual`, `Execution`, ...) become
field groupings inside `NodeState`, not separate records or stores.

Buckets are root-graph-scoped (`rootGraph.id`), keyed by `NodeId`.
Node-id uniqueness across sibling subgraph definitions is already
guaranteed by the load-time dedup pass
(`src/lib/litegraph/src/subgraph/subgraphDeduplication.ts`).

## Decision 2: Field set — what is NodeState, what is elsewhere

```
NodeState {
  id: NodeId
  graphId: UUID            // owning (sub)graph — partitioning + locator ids
  type: string             // identity, with apiNode?: boolean
  title: string
  titleMode?: TitleMode
  mode: number
  flags: { collapsed?, pinned?, ghost? }
  color?: string
  bgcolor?: string
  shape?: number
  resizable?: boolean
  showAdvanced?: boolean
}
```

Excluded — owned or derived elsewhere; referencing them here would be a
mirror (the hard constraint of this phase):

| Field                   | Owner                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `selected`              | `canvasStore.selectedNodeIds` (already what `LGraphNode.vue` reads)                                                                                    |
| `executing`             | `executionStore` via `useNodeExecutionState` (already what Vue reads)                                                                                  |
| `hasErrors`             | derived from `executionErrorStore` / missing-model/media stores; `node.has_errors` stays a legacy-canvas class field written by `useNodeErrorFlagSync` |
| position / size / z     | `layoutStore`                                                                                                                                          |
| widget values / order   | `widgetValueStore`                                                                                                                                     |
| input link connectivity | `linkStore` (`getInputSlotLink` / `isInputSlotConnected`)                                                                                              |
| `badges`                | `nodeBadgeStore` — plain `BadgeData` rows written by a badge system; see [Node Badge Store](node-badge-store.md)                                       |
| `inputs` / `outputs`    | deferred — see Decision 3                                                                                                                              |

`VueNodeData.selected` and `.executing` are dead fields today (no
production consumer reads them); they are deleted, not migrated.

## Decision 3: Slot arrays deferred; `inputs[].link` readers migrate now

`NodeInputSlot` / `NodeOutputSlot` are class instances with methods —
Slot entity extraction (ADR 0008 `SlotIdentity` etc.) is its own future
phase. The slot arrays stay class-side, keeping the `shallowReactive`
graft for renderer reactivity.

What this phase does remove is the last `inputs[].link` dependency: the
three remaining readers (`nodeDataUtils.linkedWidgetedInputs` used by
`NodeSlots`, and `usePartitionedBadges`' badge computed plus its
exported `trackNodePrice`) move to `linkStore.isInputSlotConnected`
queries — presence is all any of them needed — which deletes the
`node:slot-links:changed` → `refreshNodeInputs` reprojection in
`useGraphNodeManager`, the dead `node:slot-errors:changed` handler
(zero emitters repo-wide), and the node-removal refresh-all loop.
With their last listeners gone, both trigger actions are deleted
outright — emitters, event-map entries, and types (the badge system
sources connectivity from `linkStore`, not events; resurrect from git
if a consumer ever materialises). Readers get the root graph id from
`canvasStore.rootGraphId`, the shared tracked accessor, rather than
per-site `canvas?.graph?.rootGraph.id` chains.
Shipped ahead of the store itself (2026-07-05).

## Decision 4: Renderer consumes the NodeState proxy, `VueNodeData` dies

`GraphCanvas` iterates the store's bucket for the active graph (filtered
by `NodeState.graphId`) and passes the reactive `NodeState` proxy down
the existing prop-drilling path (`LGraphNode` → `NodeHeader` /
`NodeSlots` / `NodeContent` / `NodeWidgets`). Children read proxy fields
directly; Vue tracks the store state, so the per-property
`node:property:changed` → snapshot-rewrite handlers in
`useGraphNodeManager` are deleted wholesale.

Slot arrays reach `NodeSlots` via the existing live-node access
(`getNodeByLocatorId`), not through `NodeState`.

`LGraphNodePreview` constructs a synthetic `NodeState` (as it does a
synthetic `VueNodeData` today). `AppModeWidgetList` stops calling
`extractVueNodeData` and reads the registered `NodeState` + live node.

## Decision 5: Registration lifecycle and class adoption

Follows the shipped trio convention (`LLink` / `Reroute`):

- `LGraphNode` constructs its `_state: NodeState` at instantiation;
  `registerNodeState(graph, node)` inserts it by reference and the class
  adopts the returned reactive proxy; `node._graphId` (root id) is the
  registration-ownership marker.
- Chokepoints: `LGraph.add` / `LGraph.remove` (the canonical sites),
  `unregisterAllNodeStates(graph)` on graph `clear()`, identity-checked
  delete (`toRaw` compare) so only the registered state vacates its key.
- Class fields become accessors reading through `_state`. Reads go
  through the reactive proxy directly (there is no `_stateRaw` raw view),
  so `node.title` / `node.mode` / … track inside Vue effects, matching a
  read of the store's `NodeState`. The one measured tight loop that reads
  `id` per node — `LGraph.computeExecutionOrder` — hoists it to a local
  once per iteration.
  `LGraphNodeProperties`' instrumented descriptors keep their
  get/set + `node:property:changed` emission but store the value in
  `_state` instead of a closure — trigger consumers (minimap,
  `useErrorClearingHooks`) keep working unchanged.
- `serialize()` / `toJSON` are unaffected: they read each field through
  its accessor, so the wire format is identical. Raw enumeration is not —
  see Decision 7.

## Decision 6: What remains of useGraphNodeManager

Deleted: `extractVueNodeData`, the `vueNodeData` map, all
`node:property:changed` handlers, `syncWithGraph`, `getNode()`
(consumers use `graph.getNodeById`), the `node:slot-links:changed`
handler (Decision 3).

Remaining renderer-side lifecycle, slimmed into `useVueNodeLifecycle`
(or a small successor):

- layoutStore seeding on node add/remove (`createNode`/`deleteNode`
  layout mutations, including the `onAfterGraphConfigured` deferral) —
  layout is renderer policy, not entity data.
- `node:slot-label:changed` slot-array reprojection — dies with the
  Slot extraction phase.

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
  `JSON.stringify(node)` do not include them. (`LGraphNodeProperties`
  instruments `title` / `mode` / `color` / `bgcolor` / `showAdvanced`
  with own enumerable accessors, so those reappear on instrumented
  nodes — do not rely on either behavior.) To snapshot shell state, read
  the node's accessors or the registered `NodeState` from
  `useNodeDataStore().getNode(rootGraphId, id)`, not a spread of the node.
- **`type` is now read-only.** It is a getter with no setter on every
  node class; assigning `node.type = …` fails type-checking and throws in
  strict mode. `type` is fixed at construction (`LiteGraph.createNode` /
  the `LGraphNode(title, type)` constructor); deserialization sets it via
  `configure`. Extensions that need a different type should create the
  correct node rather than mutating an existing one.

Extension migration map: read a field → `node.<field>` (reactive) or
`useNodeDataStore().getNode(rootGraphId, node.id)`; snapshot all shell
state → read that `NodeState`, not `{ ...node }`; set `title` / `mode` /
colours / `flags` / `shape` / `showAdvanced` → assign the accessor (writes
through to the store); set `type` → construct the intended node type.

## Scope

Covers node shell state, the `VueNodeData` deletion, and the
`inputs[].link` reader migration. Out of scope: Slot entity extraction,
`Properties` (`properties` / `properties_info`) and `NodeType` metadata
beyond `type`/`apiNode` (`category`, `nodeData`, `description` remain on
the class/constructor), badges, `WidgetContainer` (already owned by
`widgetValueStore`), and command-pattern mutators (future work per
ADR 0003/0008).
