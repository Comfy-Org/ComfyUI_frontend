# Serialization Callback Migration Notes

Covers `node.onSerialize`, `node.onConfigure`, `graph.onSerialize`, and
`graph.onConfigure` (the workflow save/load hooks) following the ECS
data-centralization refactor. For connection-timing hooks
(`onConnectionsChange`, etc.) see
[Connection callbacks migration](connection-callbacks-migration.md); for
`node.widgets` and widget value storage see
[Widget system migration](widgets-migration.md); this note does not repeat
that content.

## Signatures and firing order are unchanged

`node.onConfigure` and `node.onSerialize` remain declared with their existing
signatures (`src/lib/litegraph/src/LGraphNode.ts:818-819`):

```ts
onConfigure?(this: LGraphNode, serialisedNode: ISerialisedNode): void
onSerialize?(this: LGraphNode, serialised: ISerialisedNode): void
```

`node.onConfigure` still fires at the very end of `LGraphNode.configure()`,
after properties, inputs, outputs (each re-firing `onConnectionsChange`), and
`widgets_values` have all been restored onto the node
(`src/lib/litegraph/src/LGraphNode.ts:1174`). `node.onSerialize` still fires
at the end of `LGraphNode.serialize()`, after `pos`, `size`, `flags`, `order`,
`mode`, `inputs`, `outputs`, `title`, `properties`, and `widgets_values` have
all been written into the object it receives
(`src/lib/litegraph/src/LGraphNode.ts:1180-1238`). `graph.onConfigure` and
`graph.onSerialize` (declared `src/lib/litegraph/src/LGraph.ts:504-505`) keep
the same relative position too: `graph.onConfigure` fires after every node,
link, reroute, group, and subgraph definition has been configured
(`src/lib/litegraph/src/LGraph.ts:2805`, immediately before
`incrementVersion()`); `graph.onSerialize` fires once the graph's serialisable
shape (nodes, groups, topology, extra) has been assembled
(`src/lib/litegraph/src/LGraph.ts:2541`, inside `asSerialisable()`). An
extension that only reads or writes the object it is passed needs no changes
here.

## Active Pinia is now mandatory for configure()

Constructing or configuring any root `LGraph` requires an active Pinia.
`LGraph.configure()` calls directly into the ECS stores while clearing and
rebuilding the graph: `useLinkStore().clearGraph(...)`,
`useRerouteStore().clearGraph(...)`, `useNodeDataStore().clearGraph(...)`,
`useWidgetValueStore().clearGraph(...)`, and
`usePreviewExposureStore().clearGraph(...)` for a root graph, or the matching
`clearOwner(...)` calls for a subgraph
(`src/lib/litegraph/src/LGraph.ts:2589-2602`). A test harness, worker, or
standalone LiteGraph consumer that calls `new LGraph(serializedData)` or
`graph.configure(data)` without an active Pinia now fails outright, rather
than silently getting an empty graph. This mirrors the same requirement
already documented for link registration in
[Link registration migration](link-registration-migration.md), which notes
that "constructing a root `LGraph`, or configuring one from serialized data,
requires an active Pinia because graph topology is store-backed throughout
its lifecycle."

## `onSerialize`/`onConfigure` can still write straight through to canonical state, unchecked

The hooks still receive full, mutable data: `onConfigure` gets the raw parsed
node/graph object, and `this` inside either hook is the live node/graph
instance, so an extension can read or write any field from inside the
callback exactly as before, including stashing extra keys into the object
`onSerialize` is given and reading them back from the equivalent field in
`onConfigure` on the next load. What's different is what's on the other end
of that write: node/graph shell fields are now store-backed
(`nodeDataStore`, `linkStore`, `widgetValueStore`, ...), and assigning to them
from inside `onSerialize`/`onConfigure` writes through to those stores with no
schema, ownership, replay, transaction, or undo boundary of its own. This is
documented as a currently open compatibility gap, not a guarantee:

> Node and graph `onSerialize` hooks can mutate complete persistence DTOs,
> while generic configure assignment and `onConfigure` expose equivalent
> load-time mutation channels. These extension hooks can override
> store-backed fields without schema, ownership, replay, transaction, or undo
> boundaries.
> Source: `docs/architecture/ecs/ecs-migration-plan.md:124-127`

The extension-compatibility audit reaches the same conclusion and names the
intended fix: restricting these hooks to "a controlled adapter for
validated, namespaced plain-data payloads" instead of live DTOs/objects, as
future work, contingent on measuring real extension usage first
(`docs/architecture/ecs/ecs-extension-compatibility-audit.md:127-137`). Don't
write new extension code that depends on this staying wide open. Keep
extension-owned serialized data in `node.properties[...]` /
`graph.extra[...]`, which are the stable, intended extension surfaces for
persisted data, rather than mutating canonical shell fields from inside these
hooks.

## Node shell fields are no longer own-enumerable: `serialize()` is the correct read path, not enumeration

`id`, `type`, `title`, `flags`, `mode`, `color`, `bgcolor`, `shape`, and
`showAdvanced` are now accessor properties over `nodeDataStore` rather than
own data properties on the node instance
(`docs/architecture/ecs/ecs-extension-compatibility-audit.md:106-118`). This
doesn't affect `onSerialize`/`onConfigure` themselves (they build/consume the
DTO through explicit field access, `src/lib/litegraph/src/LGraphNode.ts:1180-1238`),
but it does affect any extension code that implements its own
serializer/inspector by enumeration instead of calling `node.serialize()`:
`Object.keys(node)`, `for...in`, and `{ ...node }` no longer surface these
fields, even though ordinary reads/writes (`node.title`, `node.mode = ...`)
keep working unchanged. `inputs`, `outputs`, and `widgets` remain own
enumerable properties for exactly this reason, so spread/enumeration still
picks those three up. If your extension has generic code that walks a node's
own properties to build a serialized or debug representation, switch it to
`node.serialize()` or explicit named-field access.

## Undo/redo calls the same two entry points, unaffected

`ChangeTracker.captureCanvasState()` still snapshots the graph by calling
`app.rootGraph.serialize()`, and restores a snapshot by calling
`graph.configure()` (`docs/architecture/change-tracker.md:8-12`). So
`onSerialize`/`onConfigure` still fire once per undo/redo step, exactly as
before this refactor. Nothing here requires extension changes.

## Widget-level `serializeValue` is unrelated, and its own contract is unchanged (for now)

`widget.serializeValue` builds the API prompt payload, not the workflow JSON
(a different serialization layer from everything above, and unaffected by
it). Its existing async, side-effecting contract (resolving random values,
mutating widget/workflow shadows, uploading files, updating UI state) is
called out as unchanged, with tightening described only as later work
(`docs/architecture/ecs/ecs-extension-compatibility-audit.md:147-155`,
`docs/architecture/ecs/ecs-migration-plan.md:128-131`). See
`docs/WIDGET_SERIALIZATION.md` for the distinct `widget.serialize` (workflow
persistence) vs. `widget.options.serialize` (prompt/API payload) properties,
which this refactor also left alone.

## Current behavior: `graph.onSerialize` sees the newer schema shape, and a custom top-level field can be dropped by `graph.serialize()`

This behavior is not attributed to this refactor specifically (pre-refactor
history was not available to confirm when it was introduced), but it is
worth knowing if you rely on `graph.onSerialize`/`graph.serialize()` directly
rather than the app's save path. `graph.onSerialize` actually fires inside
`LGraph.asSerialisable()`, against that method's current-schema data shape
(`LGraph.serialisedSchemaVersion`, `src/lib/litegraph/src/LGraph.ts:2500-2543`).
The classic `LGraph.serialize()` entry point (marked `@deprecated` in favor of
`asSerialisable()`, `src/lib/litegraph/src/LGraph.ts:2435-2440`) then
destructures only a fixed set of known keys out of that result: `config`,
`state`, `groups`, `nodes`, `reroutes`, `extra`, `floatingLinks`, and
`definitions`, to build its own 0.4-schema return value, recomputing `links`
separately in the legacy array format
(`src/lib/litegraph/src/LGraph.ts:2440-2476`). A consequence: if your
extension adds a new top-level key to the data object from inside
`graph.onSerialize`, it survives when the caller uses `asSerialisable()`
directly, but is silently dropped when the caller goes through
`serialize()`. Node-level `onSerialize` has no equivalent allowlist:
`LGraphNode.serialize()` returns the exact object `onSerialize` was given,
so this asymmetry is graph-level only. `graph.extra[...]` is preserved by
both entry points and remains the place for extension-owned graph data.

## Not independently verified

This note describes the current implementation and the ECS audit/migration
docs' account of it. This behavior has not been independently verified
against pre-refactor history, so "changed" above means "documented by the
project's own ECS audits as changed, and confirmed present in current code"
rather than a verified before/after comparison. If your extension depends on
exact `onSerialize`/`onConfigure` behavior not covered above, file a report
with a reproduction rather than assuming it is unchanged.
