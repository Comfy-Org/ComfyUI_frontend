# ECS Extension Compatibility Audit

Status: Current implementation audit
Verified: 2026-08-16 against PR 14246

The categories below describe the implemented extension-facing contract, not
every internal refactor.

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

Removal ordering is intentional: `node:before-removed` and `onRemoved` occur
while the departing node can still identify its graph-owned state; cleanup is
completed before `node:removed`. Input replacement registers the new link
before old-link disconnect callbacks, so callback queries observe the
replacement rather than a transient empty input.

## Deprecated compatibility behavior

| Surface                                 | Read behavior                                                                   | Write / migration behavior                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `graph.links[id]`                       | Proxy-backed indexed access remains temporarily.                                | Use `graph.links.get(id)` and normal `Map` iteration.                                                                          |
| `input.link`                            | Returns the current store-derived ID or `null` and emits deprecation telemetry. | Assignment is ignored. Use `isInputConnected()`, `getInputLink()`, `connect()`, or `disconnectInput()`.                        |
| `output.links`                          | Returns a fresh frozen ID array or `null` and emits telemetry.                  | Assignment and array mutation cannot change topology. Use node queries, `outputLinks()`, `connect()`, or `disconnectOutput()`. |
| `node.badgePosition`                    | Returns the fixed top-right position.                                           | Assignment is ignored; badges always render top-right.                                                                         |
| `LGraphCanvas.repositionNodesVueMode()` | Alias remains callable.                                                         | Use `applyNodePositions()`.                                                                                                    |
| Graph `onBeforeChange`                  | Hook remains declared.                                                          | Prefer `LGraphCanvas.onBeforeChange`; graph hook is scheduled for removal.                                                     |

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
or complete target input and preserves the incumbent. Therefore `set()` is not
proof of registration: verify `get(id) === link` (allowing for the store-held
reactive object where applicable), or use graph connection APIs.

`addFloatingLink()` now returns `LLink | undefined`: the stored link for success
or idempotent re-registration, and `undefined` for collision. Never retain or
render the incoming object before checking. Full examples and import-boundary
rules are in
[Link registration migration](../../extensions/link-registration-migration.md).

### Store-derived connectivity

Topology is authoritative in `linkStore`; slot mirrors no longer drive links.
Callback code reading the deprecated accessors sees current store state. Code
that used `input.link = ...`, `output.links.push(...)`, or replacement of either
property is now a no-op and must move to graph/node mutation APIs.

### Node shell properties and enumeration

`id`, `type`, `title`, `flags`, `mode`, `color`, `bgcolor`, `shape`,
`showAdvanced`, `inputs`, and `outputs` are now accessors over `nodeDataStore`
state rather than instrumented own data properties. Ordinary reads and writes
remain, and tracked shell writes still emit `node:property:changed`. However,
`Object.keys(node)`, `for...in`, own-property descriptors, and object spread no
longer expose those fields exactly as before. Use named accessors and
`serialize()` instead of generic object enumeration. Changing `node.type` after
construction now warns and is deprecated; register/create the correct type or
replace the node instead.

### Badges

Extension entries in `node.badges`, including badge thunks, and `LGraphBadge`
content remain supported. Position customization changed: all badge rows render
at the top-right, and `badgePosition` is only an ignored compatibility accessor.
Derived first-party rows are recomputed on read; extension entries remain on
`node.badges` and render after them.

## Unsupported behavior

- `widgets_up` is detected and warned about but is not supported by the Vue
  renderer. Use normal widget ordering/layout.
- Direct mutation of `input.link` or `output.links` is unsupported.
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
- geometry consumers mutating `pos`/`size` by index and typed-array methods in
  both canvas renderers.

The identity consequences behind collisions and owner filtering are documented
in [ECS identity and scope audit](ecs-identity-scope-audit.md). Lifecycle test
scenarios remain in `ecs-lifecycle-scenarios.md`; planned API convergence belongs
in `ecs-migration-plan.md` rather than this compatibility record.
