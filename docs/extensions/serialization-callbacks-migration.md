# Serialization Callback Migration Notes

Configuring a root `LGraph` from serialized data now requires an active
Pinia instance. `LGraph.configure()` clears and rebuilds the graph directly
against the ECS stores, so a test harness, worker, or standalone LiteGraph
consumer that calls `new LGraph(data)` or `graph.configure(data)` without an
active Pinia now fails outright instead of silently producing an empty
graph. This is the same requirement documented in
[Link registration migration](link-registration-migration.md).

Extensions running in ComfyUI use the application's active Pinia instance.
Do not create or activate a separate Pinia instance from extension code.

`node.onConfigure`, `node.onSerialize`, `graph.onConfigure`, and
`graph.onSerialize` keep their existing signatures and firing order. For
connection-timing hooks see
[Connection callbacks migration](connection-callbacks-migration.md); for
`node.widgets` and widget value storage see
[Widget system migration](widgets-migration.md).

## Store custom data in properties or extra

Use `node.properties` for per-node extension data and `graph.extra` for
per-graph extension data. These remain the stable, intended extension
surfaces for persisted data.

`onSerialize` and `onConfigure` are called with `this` bound to the live
node/graph object; the argument passed to the callback is the serialized
data object (`ISerialisedNode`/`ISerialisedGraph`), not the live node/graph.
Because `this` is still the live object, a hook can mutate any field on it,
including fields that are now store-backed. Don't use these hooks to
overwrite core fields: a write via `this` from inside
`onSerialize`/`onConfigure` goes straight through to the store, with no
schema, ownership, or undo boundary of its own.

If you write graph-level extension data from `graph.onSerialize`, keep it
under `graph.extra`. A custom top-level key added anywhere else survives
`LGraph.asSerialisable()` but is silently dropped by the legacy
`LGraph.serialize()` entry point, which only carries a fixed set of known
keys forward. `graph.extra` is preserved by both.

## Serialize nodes instead of enumerating properties

If your extension builds a serialized or debug representation of a node by
enumerating its own properties, switch it to `node.serialize()`.

`id`, `type`, `title`, `flags`, `mode`, `color`, `bgcolor`, `shape`, and
`showAdvanced` are now accessor properties over the node data store instead
of own data properties on the node instance. `Object.keys(node)`,
`for...in`, and `{ ...node }` no longer surface these fields, though direct
reads and writes (`node.title`, `node.mode = ...`) keep working unchanged.
`inputs`, `outputs`, and `widgets` remain own-enumerable, so
spread/enumeration still picks those three up.

For widget-level `serializeValue`, a separate serialization layer that
builds the API prompt payload, not the workflow JSON, see
[Widget system migration](widgets-migration.md).
