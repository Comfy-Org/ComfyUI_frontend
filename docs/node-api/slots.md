# Slots and links

Slots and links are exposed through stable handles and frozen snapshots. Use
them instead of `node.inputs`, `node.outputs`, `input.link`, `output.links`, or
mutable link records from LiteGraph.

## Slot identity and references

A slot index is a position and changes when the slot list changes. A `SlotId` is
stable for the lifetime of the slot.

Methods accepting `SlotRef` support:

```js
node.inputs.get('model') // exact name, preferred
node.inputs.get(slotId) // stable runtime identity
node.inputs.get({ index: 0 }) // explicit positional access
```

A bare number is deliberately not accepted. Use `{ index }` so a volatile
positional dependency is visible in code review and search.

String resolution is:

1. exact `SlotId`;
2. exact slot name;
3. while named slots are unavailable, a canonical integer string such as `'0'`
   resolves positionally;
4. no match.

`get(name)` throws `ComfyAmbiguousSlotError` when more than one slot has that
name. `byName(name)` returns `undefined` on ambiguity. Output names may
legitimately repeat, so the API never guesses.

Slot IDs are runtime identity. Workflows still serialize link endpoints by
index, so do not persist a `SlotId` across save and reload.

## Collections

Every node has input and output collections:

```js
const inputs = node.inputs
const outputs = node.outputs

inputs.length
inputs.get('model')
inputs.byId(slotId)
inputs.byName('model')
inputs.at(0)
inputs.all()
inputs.ids()
inputs.names()
```

The returned arrays are frozen snapshots. Collections are iterable and their
handles remain operation-oriented.

## Inspecting an input

```js
const input = node.inputs.get('model')
if (!input) return

console.info(input.id, input.index, input.name, input.type)
console.info(input.label, input.connectedType, input.isConnected)
```

Important input reads:

| Method or field             | Meaning                                                                         |
| --------------------------- | ------------------------------------------------------------------------------- |
| `link()`                    | Frozen `LinkInfo` for the physical incoming link.                               |
| `source()`                  | Physical source node ID and output index. Stops at a frontend reroute.          |
| `resolvedSource()`          | Executable source after frontend-node resolution: output, literal, or omission. |
| `connectedType`             | Type arriving through the connection, including a subgraph boundary.            |
| `isWidgetInput`             | Whether the slot is the socket form of a widget.                                |
| `widgetConfig()`            | Input declaration used by a connected Primitive node.                           |
| `mergeWidgetConfig(config)` | Compatible intersection of this and another declaration.                        |
| `snapshot()`                | Frozen `SlotSnapshot`.                                                          |

Use `source()` to edit physical topology. Use `resolvedSource()` to understand
what execution ultimately receives through reroutes, Get/Set nodes, and other
frontend resolvers.

## Inspecting an output

```js
const output = node.outputs.get('IMAGE')
if (!output) return

const links = output.links()
const targets = output.targets()
```

`links()` and `targets()` are snapshots, so it is safe to iterate while
disconnecting.

## Connecting and disconnecting

```js
const made = source.outputs.get('IMAGE')?.connectTo(target.id, 'image')

target.inputs.get('image')?.disconnect()
source.outputs.get('IMAGE')?.disconnect(target.id)
source.outputs.get('IMAGE')?.disconnect() // all targets
```

`connectTo()` returns the new `LinkInfo`, or `undefined` when the endpoint does
not exist or the host rejects the connection. Normal compatibility and
definition hooks still apply.

Do not update `LinkInfo`; it is a record of one observation. Perform the edit
through the slot handles.

## Adding and removing dynamic slots

```js
const input = node.inputs.add('image_3', 'IMAGE', {
  shape: 'optional',
  localizedName: 'Third image'
})

node.outputs.add('batch', 'IMAGE', { shape: 'list' })
node.inputs.remove(input.id)
```

`SlotOptions` supports:

- `shape`: `'default'`, `'optional'`, `'list'`, or `'directional'`;
- `localizedName`;
- a custom graph-space `position` and link `direction`;
- `widget`, naming the widget whose socket form this input represents;
- `widgetConfig`, the declaration a connected Primitive should render.

Shapes, localized names, positions, directions, colors, and widget-input
metadata can affect saved workflow bytes. Reproduce the original declaration
when wire compatibility matters.

Removing a slot disconnects its links.

## Reordering slots safely

```js
node.inputs.reorder(['model', 'positive', 'negative', 'latent_image'])
```

The names must be a complete permutation of the current slots. The host updates
every affected link endpoint as part of the operation and preserves link IDs.
Permuting an internal slot array directly would silently retarget connections,
because serialized links store endpoint indexes.

The slot order itself is serialized, so reordering changes the workflow by
design while preserving which logical slots its links reach.

## Modifying a slot

Apply related changes atomically:

```js
node.outputs.get('value')?.modify({
  name: 'model',
  label: 'MODEL',
  type: 'MODEL',
  shape: 'directional'
})
```

`SlotPatch` supports name, label, localized name, type, position, direction,
connected and unconnected colors, and shape. `InputSlotPatch` additionally
supports widget identity and widget configuration.

A type may be a string or an array of accepted types. The host normalizes an
array to the comma-separated form used by its compatibility checks.

Retyping keeps existing links. Dynamic wildcard-to-concrete nodes depend on
that behavior; explicitly disconnect a link when the feature requires it.

## Moving output links without replacing them

```js
const moved = node.outputs.get('old_output')?.moveLinksTo('new_output')
```

`moveLinksTo()` moves every link to another output on the same node and
preserves link IDs. Disconnecting and reconnecting would allocate new IDs and
change the serialized workflow.

The move deliberately does not revalidate types. The observed migration pattern
moves links away and then retypes a slot; checking compatibility halfway through
would reject that valid sequence.

## Widget-backed inputs

A dynamic input that is the socket form of a widget must carry the relationship:

```js
node.inputs.add('strength', 'FLOAT', {
  widget: 'strength',
  widgetConfig: {
    type: 'FLOAT',
    options: { default: 1, min: 0, max: 2, step: 0.05 }
  }
})
```

This is not cosmetic. Widget-backed inputs serialize differently from ordinary
sockets, and the widget keeps its position in `widgets_values`.

`InputSlotHandle.modify({ widget, widgetConfig })` updates an existing input.
Use `null` for `widget` to clear the relationship.

## Physical and resolved topology

Frontend-only nodes can forward, replace, or omit execution values without
changing physical links. Keep the distinction explicit:

```js
const physical = input.source()
const executable = input.resolvedSource()
```

An executable source is one of:

- `{ kind: 'output', graphId, nodeId, outputIndex }`;
- `{ kind: 'literal', value }`;
- `{ kind: 'omitted', reason }`.

Resolution is read-only and scoped to the input's graph. See
[Execution and resolution](./execution.md) for defining resolvers and suppliers.
