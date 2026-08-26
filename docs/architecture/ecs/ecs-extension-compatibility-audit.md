# ECS extension compatibility audit

Status: Current implementation audit
Verified: 2026-08-20 against `13a302eadda871b939b148ecb87e3d845ceefff2`

This audit describes the implemented extension-facing contract. It does not
catalog every internal refactor.

## Preserved behavior

### Graph and type discovery

- `LiteGraph.registered_node_types`, `registerNodeType()`,
  `unregisterNodeType()`, `createNode()`, `getNodeType()`, and node-type
  enumeration remain available in `LiteGraphGlobal.ts`.
- Slot registries (`registered_slot_*_types`, `slot_types_in/out`, and
  `slot_types_default_in/out`) remain available. `auto_load_slot_types` retains
  its constructor-based discovery behavior.
- Node `type`, slot `type`, `getInputDataType()`, `getOutputNodes()`, and search
  helpers remain extension-visible. Store migration does not require extensions
  to enumerate Pinia internals.

### Geometry facade

`LGraphNode.pos`, `size`, `boundingRect`, `getBounding()`, `setPos()`, and
`setSize()` remain the supported node facade. Reads project the authoritative
layout-store rectangle and writes commit through it. In-place typed-array size
mutations remain synchronized. Extensions should keep using node geometry, not
reach into `layoutStore` or depend on its scoped key format.

### Lifecycle surface

`node.onAdded(graph)`, `node.onRemoved()`, graph `onNodeAdded` /
`onNodeRemoved`, and `onConnectionsChange()` remain. Graph events
`node:added`, `node:before-removed`, and `node:removed` provide an additional
typed observation surface. Connection veto hooks (`onConnectInput`,
`onConnectOutput`) and normal connection callbacks remain in `LGraphNode.ts`.

Removal ordering is intentional. `node:before-removed` and `onRemoved` occur
while the departing node can still identify its graph-owned state; cleanup is
completed before `node:removed`. Input replacement registers the new link
before old-link disconnect callbacks, so callback queries observe the
replacement rather than a transient empty input.

## Deprecated compatibility behavior

| Surface                                 | Read behavior                                                                   | Write / migration behavior                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `graph.links[id]`                       | Proxy-backed indexed access remains temporarily.                                | Use `graph.links.get(id)` and normal `Map` iteration.                                              |
| `input.link`                            | Returns the current store-derived ID or `null` and emits deprecation telemetry. | Assigning `null` disconnects; ID assignment is ignored. Prefer `connect()` or `disconnectInput()`. |
| `output.links`                          | Returns a stable store-derived ID view or `null` and emits telemetry.           | Removing IDs disconnects; additions are discarded. Prefer `connect()` or `disconnectOutput()`.     |
| `node.badgePosition`                    | Returns the fixed top-right position.                                           | Assignment is ignored; badges always render top-right.                                             |
| `LGraphCanvas.repositionNodesVueMode()` | Alias remains callable.                                                         | Use `applyNodePositions()`.                                                                        |
| Graph `onBeforeChange`                  | Hook remains declared.                                                          | Prefer `LGraphCanvas.onBeforeChange`; graph hook is scheduled for removal.                         |

Serialized slot `link`/`links` fields are still emitted for workflow
compatibility, but constructors strip those mirrors before rebuilding topology.
They are serialization data, not mutable runtime storage.

## Changed behavior

### Active Pinia is mandatory

Constructing or configuring a root `LGraph` calls `useLinkStore()` immediately.
Tests, extensions, workers, and standalone LiteGraph consumers must install and
activate Pinia before graph construction. Missing Pinia is no longer interpreted
as an empty topology store. Subgraphs inherit the root's store context.

### `graph.links` and `graph.floatingLinks`

Both are owner-filtered `LinkMap` views over `linkStore`, not native `Map`
storage. `graph.links` contains complete links; `floatingLinks` contains links
with an unassigned endpoint. Reads, `size`, iteration, `forEach`, `clear`, and
`delete` retain Map-shaped behavior. Membership snapshots are cached by store
revision, so acquire a new iterator after topology changes. Do not call
`Map.prototype` methods with a view as receiver or inspect native Map storage.

`LinkMap.set(id, link)` still returns the view, as `Map.set()` does. It rejects a
mismatched key (`id !== link.id`). Registration also rejects an occupied link ID
or complete target input and preserves the incumbent. Therefore `set()` does
not prove registration. Verify `get(id) === link`, allowing for the store-held
reactive object where applicable, or use graph connection APIs.

`addFloatingLink()` now returns `LLink | undefined`. It returns the stored link
for success or idempotent re-registration, and `undefined` for collision. Never
retain or render the incoming object before checking. Full examples and
import-boundary rules are in
[Link registration migration](../../extensions/link-registration-migration.md).

### Store-derived connectivity

Topology is authoritative in `linkStore`; slot mirrors no longer drive links.
Callback code reading the deprecated accessors sees current store state. Code
that clears `input.link` or removes IDs from `output.links` is routed through
topology operations for compatibility. Adding a link ID remains a no-op and
must move to `connect()`, which has the endpoint context needed to create it.

The graph triggers `node:slot-links:changed` and
`node:slot-errors:changed` were removed with their emitters and event-map
types. Connectivity observers should use reactive `linkStore`/`slotLinks`
queries or `onConnectionsChange` when callback timing is required. Error
observers should use the missing-model, missing-media, and execution error
stores or the `nodeErrorState` projection. Extensions that subscribed to the
removed trigger strings require migration; there is no compatibility event.

### Node shell properties and enumeration

`id`, `type`, `title`, `flags`, `mode`, `color`, `bgcolor`, `shape`, and
`showAdvanced` are now prototype accessors over `nodeDataStore` state and are
no longer own enumerable properties: `Object.keys(node)`, `for...in`, and
object spread do not carry them. Use named accessors and `serialize()` instead
of generic object enumeration. `inputs`, `outputs`, and `widgets` are
reinstated as enumerable own accessors in the constructor, so they continue to
appear in `Object.keys(node)` and object spread. Ordinary reads and writes for
all of these fields remain, and tracked shell writes still emit
`node:property:changed`. Changing `node.type` after construction now warns and
is deprecated; register/create the correct type or replace the node instead.

### Badges

Extension entries in `node.badges`, including badge thunks, and `LGraphBadge`
content remain supported. Position customization changed: all badge rows render
at the top-right, and `badgePosition` is only an ignored compatibility accessor.
Derived first-party rows are recomputed on read; extension entries remain on
`node.badges` and render after them.

### Persistence hooks

`node.onSerialize`, `node.onConfigure`, `graph.onSerialize`, and
`graph.onConfigure` remain compatibility surfaces. Serialize hooks receive a
mutable DTO view: changes to canonical fields are applied to that serialization,
while JSON-compatible noncanonical fields are persisted under `extensions`.
Configure hooks receive an isolated clone containing canonical data plus the
owner's extension payload; mutating that clone does not reconfigure the graph.

Extensions should persist JSON-compatible data under a unique key in
`data.extensions` and read it from the same key in `onConfigure`. Legacy flat
fields are still projected into configure views, but migrate them to a
namespaced key. Do not use `onConfigure` to rewrite nodes, links, or other
canonical workflow fields; perform graph mutations through supported graph APIs
after configuration instead.

### Custom-widget constructors

The existing `ComfyWidgetConstructor` contract returns a descriptor containing
the created widget: `{ widget, minWidth?, minHeight? }`. The devtools legacy
widget fixture now returns `{ widget }` after adding that same object to the
node, so normal registration and tracking can observe it. This PR fixes the
fixture's compliance; it does not introduce a new constructor contract.

### Execution-value hooks

`widget.serializeValue` remains an async prompt-construction hook. Existing
implementations can resolve random dynamic prompts, mutate workflow value
shadows, capture media, upload files, and update UI state. Extensions must not
assume this is a pure serialization callback. The ECS target must retain needed
pre-queue effects through an explicit effect boundary while recording resolved
execution inputs. Routing durable graph changes through serializable commands
is later architecture work outside this data-centralization phase.

## Unsupported behavior

- `widgets_up` is detected and warned about but is not supported by the Vue
  renderer. Use normal widget ordering/layout.
- ID-only additions through `input.link` or `output.links` are unsupported.
- Treating `LinkMap` as a native Map with internal slots, retaining iterators
  across topology revisions, or assuming `set()` cannot reject is unsupported.
- Constructing a root graph without active Pinia is unsupported.
- Direct use of removed internal layout mutation paths is unsupported. Use
  `LGraphNode` geometry accessors and `LGraphCanvas.applyNodePositions()`; do not
  recreate `useGraphNodeManager`, `useVueNodeLifecycle`, or direct
  `layoutMutations` coupling in extension code.
- Depending on configurable badge placement is unsupported.

## Migration checklist

1. Activate Pinia before creating any root graph in extension tests or isolated
   runtimes.
2. Replace indexed link access and retained iterators with fresh Map-method
   reads from `graph.links` / `floatingLinks`.
3. Handle `addFloatingLink()` failure and verify view insertions; do not choose
   positive runtime IDs. Normalize persisted collisions during import.
4. Replace slot mirror writes with `connect`, `disconnectInput`, and
   `disconnectOutput`; treat compatibility reads as transitional.
5. Use node/canvas geometry facades rather than layout-store APIs.
6. Remove `badgePosition` and `widgets_up` assumptions.
7. Preserve callback ordering assumptions only where covered below; subscribe
   to graph events when observation is sufficient and no override is required.

## Required follow-up evidence

Existing evidence includes `LLink.store.test.ts`, `NodeInputSlot.test.ts`,
`NodeOutputSlot.test.ts`, `slotLinks.test.ts`, `LGraphNode.test.ts`,
`LGraph.test.ts`, `nodeBadgeDraw.test.ts`, and browser geometry/registration
specs under `browser_tests/tests/vueNodes/`.

Before removing compatibility shims, collect ecosystem evidence for:

- indexed `graph.links[id]`, direct slot writes, retained Map iterators, and
  borrowed `Map.prototype` calls;
- graph construction outside the application Pinia bootstrap;
- `badgePosition`, `widgets_up`, and removed layout/composable imports;
- callback consumers that require the old transient-empty input replacement
  state or depend on exact removal ordering;
- extensions mutating `registered_node_types` or slot registries directly,
  including enumeration/property-descriptor assumptions;
- generic node serializers or inspectors depending on shell fields being own,
  enumerable properties, and extensions changing `node.type` after creation;
- node and graph `onSerialize` / `onConfigure` hooks that mutate canonical
  workflow fields rather than an extension-owned namespaced payload;
- async `widget.serializeValue` hooks with random, graph-mutating, media, upload,
  or UI effects during prompt construction;
- geometry consumers mutating `pos`/`size` by index and typed-array methods in
  both canvas renderers.
- listeners for removed `node:slot-links:changed` and
  `node:slot-errors:changed` graph triggers.

The identity consequences behind collisions and owner filtering are documented
in [ECS identity and scope audit](ecs-identity-scope-audit.md). Lifecycle test
scenarios remain in `ecs-lifecycle-scenarios.md`; planned API convergence belongs
in `ecs-migration-plan.md` rather than this compatibility record.
