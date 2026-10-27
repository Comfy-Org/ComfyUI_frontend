# Key concepts

The published API is organized around definitions, handles, snapshots, scopes,
and host-owned behavior. Understanding those five ideas prevents most migration
mistakes.

## Definitions and instances are different surfaces

A node definition describes a type. A node handle addresses one node in one
graph.

| Surface          | Purpose                                                     | Typical entry point                            |
| ---------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| `NodeDef`        | Frozen metadata read from a backend or frontend definition. | `comfy.defs.get(type)`                         |
| `NodeDefBuilder` | Register behavior for every matching instance.              | `comfy.defs.extend(selector, apply)`           |
| `NodeDefinition` | Declare a frontend-owned node type as plain data.           | `comfy.defs.define(definition)`                |
| `NodeHandle`     | Read or edit one live node.                                 | A lifecycle callback or `comfy.graph.node(id)` |

Register type behavior at module load. Use an instance handle only after the
node has joined a graph. This is why `onCreated` runs later than a legacy
constructor hook: an ID-backed handle cannot address a node that has no graph or
ID yet.

## Handles are closed, ID-backed capabilities

`NodeHandle` and `WidgetHandle` are closed proxy objects. A handle stores public
identity and resolves the current entity on each access; it does not expose the
live internal object.

Consequences:

- unknown members are not an escape hatch to internal data;
- a handle does not keep a deleted entity alive;
- mutations pass through host-owned behavior;
- no handle exposes a constructor, prototype, store, renderer, or Vue proxy;
- `isDeleted` is available on every entity handle.

Keep handles when convenient, but check `isDeleted` before writing through a
long-lived one. Identity reads remain useful after deletion. Other reads return
no value, while a write to a deleted entity throws `ComfyDeletedError` instead
of being silently discarded.

### Handle identity

Do not assume object identity across API instances, majors, events, or graph
scopes:

```js
first === second // only reliable inside one handle cache
comfy.sameEntity(first, second) // supported identity comparison
```

`comfy.adopt(handle)` re-resolves a foreign node handle into the current API
instance. It returns `undefined` for a non-handle, a deleted node, or a handle
kind that cannot be adopted independently.

## Collection reads are snapshots

List-shaped reads return frozen array snapshots:

```js
const nodes = comfy.graph.nodes()
const links = node.outputs.get('IMAGE')?.links() ?? []

for (const link of links) {
  // Safe even though disconnecting changes the live graph.
  node.outputs.get('IMAGE')?.disconnect(link.targetNodeId)
}
```

The array does not update after it is returned. Ask again when you need current
state. Objects such as `NodeSnapshot`, `SlotSnapshot`, `LinkInfo`, definition
metadata, execution results, and resolver views are also inert, read-only data.

Use collection operations to mutate live state; never mutate an array returned
by `all()`, `nodes()`, `links()`, `names()`, or similar methods.

## Graph scope is part of identity

`comfy.graph` means the graph currently shown by the editor. It can be the root
graph or a subgraph the user entered.

Use:

- `comfy.graph.root()` for the document root even while another graph is shown;
- `comfy.graph.subgraphs()` for subgraph definitions;
- `GraphScopeHandle.node(id)` to resolve an ID inside its owning graph;
- `node.graphId` when recording a node outside the callback that supplied it.

Do not flatten a document into a map keyed only by node ID. Independently
authored subgraph definitions may contain the same IDs. A durable in-memory key
must include graph and node identity.

Supply and frontend-node resolution also run per graph scope. A supplier inside
a subgraph may feed unconnected inputs in that subgraph, but resolution does not
cross the boundary and create invisible dependencies on outside state.

## Mutations use host behavior

Set values through methods such as `setTitle`, `setValue`, `modify`,
`connectTo`, and `replace`. These methods preserve the host behavior associated
with the edit: callbacks, property synchronization, link identity, layout,
redraw, serialization, and undo boundaries as applicable.

`WidgetHandle.setValue()` is a full programmatic commit. It behaves like a user
edit for the value protocol:

- writes the value;
- synchronizes a property-backed widget;
- runs the widget callback chain and node widget-change behavior;
- notifies `change` listeners;
- advances graph change state.

It does not fire `activate`, because activation reports a user act. Writing the
current value again is a no-op.

Use `graph.batch()` for a synchronous compound edit that should be one undo
step:

```js
comfy.graph.batch(() => {
  const first = comfy.graph.add('CheckpointLoaderSimple')
  const second = comfy.graph.add('KSampler')
  first.outputs.get('MODEL')?.connectTo(second.id, 'model')
})
```

Do not hold a batch across `await`; unrelated user actions during the wait would
be folded into the pack's edit.

## Lifecycle is explicit

An extension module can register definitions, settings, commands, widget types,
and listeners immediately. Use lifecycle signals for state that is not ready at
module evaluation:

| Signal                        | Meaning                                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `comfy.onReady`               | The application, definitions, settings, and graph have finished initial setup. Fires on the next microtask if already ready. |
| `comfy.onWorkflowLoaded`      | A new workflow has finished loading. Fires for every load.                                                                   |
| `NodeDefBuilder.onCreated`    | One matching node has joined a graph and can be addressed.                                                                   |
| `NodeDefBuilder.onConfigured` | Saved node data was applied.                                                                                                 |
| `NodeDefBuilder.onRemoved`    | One matching node left its graph.                                                                                            |

Most registrations and subscriptions return `Unsubscribe`. Retain it when the
registration has a shorter lifetime than the module or owning node.

## Observe the narrowest behavior

Prefer a semantic event to polling, repaint hooks, or broad document scans:

1. a widget's `change`, `activate`, `textInteraction`, or `beforeSerialize`;
2. a definition lifecycle hook such as `onConnectionsChanged` or `onResized`;
3. root observers such as `onNodeChanged`, `onNodeMoved`, or
   `onViewportChanged`;
4. `graph.version` only as an opaque structural-change token.

`graph.version` includes widget values committed through the host protocol, but
it is still an opaque change token rather than a universal edit log. Never
subtract versions or assume consecutive increments. Data a pack keeps outside
the graph and widget model does not affect it.

## Saved workflow and queued prompt are separate destinations

The API distinguishes:

- graph state in the saved workflow;
- input values sent in the API prompt;
- the workflow embedded into an output generated by that prompt.

Mounted widgets expose separate `serialize` and `sendToPrompt` flags. Existing
widgets can replace their value for one serialization destination with a
synchronous `beforeSerialize` listener:

```js
widget.on('beforeSerialize', (event) => {
  if (event.context === 'prompt') {
    event.setSerializedValue(expandReferences(String(event.value)))
  }
})
```

The live widget value is unchanged. Ignoring `event.context` changes all three
destinations. Serialization handlers are synchronous; starting asynchronous
work inside one does not delay the prompt or workflow write.

## Frontend execution is pure resolution

A frontend-only node is ordinary editor state that does not reach the backend.
At prompt time it either:

- is omitted;
- forwards an output to one of its inputs;
- supplies a literal value.

Resolvers and suppliers receive frozen read views and return data. They do not
mutate the graph or a prompt draft. This keeps prompt construction deterministic
and prevents a failed resolver from leaving the document half-edited.

Use ordinary node and graph methods for permanent editor actions. Use resolution
only to describe what execution means.

## Errors are part of the contract

API failures are plain `Error` subclasses with no internal object attached:

| Error                     | Cause                                                 |
| ------------------------- | ----------------------------------------------------- |
| `ComfyApiError`           | Base class for API failures.                          |
| `ComfyDeletedError`       | A mutation targeted a deleted handle.                 |
| `ComfyReadonlyError`      | Code attempted to assign a read-only public property. |
| `ComfyAmbiguousSlotError` | A name matched more than one slot.                    |
| `ComfyUnsupportedError`   | `require()` named a capability the host lacks.        |

The constructors are not currently exported from `/comfy/api/v2.js`. Prefer
capability checks, `isDeleted`, and `undefined` handling for expected absence;
use ordinary `Error` fields when reporting an unexpected failure.
