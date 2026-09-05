# Nodes and definitions

Node type registration and live node editing are separate APIs. Use the
definition registry to install behavior by type, and a `NodeHandle` to work with
one node that already belongs to a graph.

## Reading definitions

```js
const definition = comfy.defs.get('KSampler')

if (definition) {
  console.info(definition.title, definition.category)
  console.info(definition.inputs)
  console.info(definition.outputs)
}
```

`NodeDef` is frozen metadata:

| Field                                      | Meaning                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `type`, `title`, `category`, `description` | Stable definition identity and presentation.                                                             |
| `inputs`                                   | Declared inputs, including name, type, localized name, combo values, and a frozen `options` passthrough. |
| `outputs`                                  | Declared output names and types.                                                                         |
| `hidden`                                   | Backend hidden-input declarations. These are not connectable slots.                                      |
| `isOutputNode`                             | Whether the backend marks the node as an output.                                                         |
| `source`                                   | The backend-reported pack that supplied the type, if known.                                              |

`inputs[].options` and `hidden` deliberately preserve pack-owned backend data.
They are declarations, not live widget values or hidden-input execution values.

Use `defs.all()` to take a snapshot of every definition and `defs.has(type)` for
an existence check. `defs.refresh()` asks the backend to reload definitions;
`defs.onRefreshed()` observes completion.

## Extending definitions

```js
const stop = comfy.defs.extend('KSampler', (definition) => {
  definition.setTitle('KSampler with tools')
  definition.addWidget({
    type: 'button',
    name: 'reset_seed'
  })

  definition.onCreated((node, event) => {
    if (!event.restored) node.setColor('#334155')
    node.widgets.get('reset_seed')?.on('activate', () => {
      node.widgets.get('seed')?.setValue(0)
    })
  })
})
```

Builder registrations compose. The host applies every matching extension rather
than making each pack capture and call a previous prototype method.

### Builder configuration

| Method                                            | Purpose                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `setTitle(title)`                                 | Change the displayed type title.                                        |
| `setCategory(category)`                           | Change where the type appears in node search.                           |
| `setExecution('backend' \| 'frontend', resolve?)` | Mark a backend-defined type frontend-only or restore backend execution. |
| `setSupply(supplier)`                             | Declare broadcast-style edges into other nodes' unconnected inputs.     |
| `addWidget(def)`                                  | Add a declared widget to every instance.                                |
| `hideWidget(name)`                                | Hide a declared widget while retaining its value.                       |
| `addMenuItem(item)`                               | Add a host-rendered context-menu entry.                                 |

Structural changes to a live node—dynamic slots, values, ordering, or
connections—belong on the instance handles supplied by lifecycle callbacks.

### Lifecycle and behavior hooks

| Hook                                | When it runs                                               |
| ----------------------------------- | ---------------------------------------------------------- |
| `onCreated(node, event)`            | The node joined a graph and is addressable.                |
| `onConfigured(node, data)`          | Saved node data was applied.                               |
| `onRemoved(node)`                   | The node left its graph.                                   |
| `onExecuted(node, result)`          | The backend returned the node's execution result.          |
| `onPreview(node, frame)`            | A preview frame was correlated with this executing node.   |
| `onConnectionsChanged(node, event)` | A slot connected or disconnected.                          |
| `onBeforeConnect(node, event)`      | A proposed connection may be accepted or vetoed.           |
| `onUnplacedLink(node, event)`       | A link dropped on the node had no unique destination slot. |
| `onResized(node, size)`             | A user or layout operation resized the node.               |
| `onHover(node, hovering)`           | The pointer entered or left the node.                      |
| `onDoubleClick(node)`               | The node was double-clicked.                               |
| `onPropertyChanged(node, event)`    | A user edited a node property.                             |
| `onDragOver(node, event)`           | Decide whether the node accepts a browser drag.            |
| `onDrop(node, event)`               | Handle a browser drop the node accepted.                   |
| `onSerialize(node)`                 | Return pack-owned fields to merge into the saved node.     |

`onBeforeConnect` returns `false` to veto. `onUnplacedLink` returns `true` after
the callback wires the link itself. `onDragOver` returns `true` to route the
drop; `onDrop` returns `true` to claim it.

`onSerialize` must return deterministic, synchronous, pack-owned data. Its data
comes back through `onConfigured`. Do not return core workflow fields or mutate
a serialization object supplied by the host.

## Defining a frontend-owned node

```js
const unregister = comfy.defs.define({
  type: 'MyPack/ConstantText',
  title: 'Constant Text',
  category: 'My Pack',
  outputs: [{ name: 'text', type: 'STRING' }],
  widgets: [{ type: 'text', name: 'value', value: '', serialize: true }],
  execution: 'frontend',
  resolve: ({ self }) => ({
    text: { literal: self.widgetValue('value') ?? '' }
  }),
  onCreated(node) {
    node.setSizeConstraints({ minWidth: 220 })
  }
})
```

`NodeDefinition` is plain data, not a class. It supports inputs, outputs,
widgets, frontend execution, supply, and the common lifecycle callbacks.

For builder-only behavior such as menu entries, preview frames, resize, hover,
double-click, connect veto, or unplaced links, define the type and extend the
same type separately.

## Working with a live node

Node handles can come from lifecycle callbacks, graph lookups, selection,
groups, execution events, or subgraph scopes.

```js
const node = comfy.graph.node(nodeId)
if (!node) return

node.setTitle('Primary sampler')
node.setMode('always')
node.setPosition({ x: 320, y: 180 })
node.setSize({ width: 280, height: 420 })
node.setProperty('role', 'primary')
```

### Identity and presentation

- `id` is identity inside the owning graph.
- `graphId` identifies that graph.
- `type` is immutable definition identity.
- `comfyClass` is the backend class identifier when it differs from `type`.
- title, mode, collapsed state, pinned state, colors, and shape use explicit
  getter/setter pairs.

Do not assign `type`. Use `comfy.graph.replace(node.id, newType)` to rebuild the
node and preserve compatible state and links.

### Properties

Use `getProperty`, `getProperties`, and `setProperty`. `getProperties()` returns
an inert object rather than a mutable reference.

`onPropertyChanged` can normalize or reject a user edit:

```js
definition.onPropertyChanged((_node, event) => {
  if (event.name !== 'strength') return
  const value = Number(event.value)
  if (!Number.isFinite(value)) event.reject()
  else event.setValue(Math.min(1, Math.max(0, value)))
})
```

`setValue()` replaces the pending property value without re-entering the
property callback. `reject()` restores the previous value.

### Geometry

| Method                            | Coordinate space or behavior                             |
| --------------------------------- | -------------------------------------------------------- |
| `getPosition()` / `setPosition()` | Node body position in graph space.                       |
| `getSize()` / `setSize()`         | Size through the host resize protocol.                   |
| `getBounds()`                     | Full node bounds in graph space, including title layout. |
| `getSlotPosition(side, index)`    | Renderer-computed slot center in graph space.            |
| `getScreenRect()`                 | Client-coordinate screen rectangle, if rendered.         |
| `setSizeConstraints()`            | Declarative min/max dimensions and auto-height.          |

Do not reconstruct title height, slot spacing, pan, zoom, or device-pixel-ratio
math from renderer constants.

### Output images

`getOutputImages()` returns URLs for the images or previews the node currently
exposes. It never returns renderer-owned `HTMLImageElement` objects.
`getDisplayedImageIndex()` identifies the image selected or hovered by the user,
or returns `undefined` when there is no such choice.

### Collections and snapshots

Each node exposes:

```js
node.inputs
node.outputs
node.widgets
```

These are operation-oriented collections, not arrays. See
[Slots and links](./slots.md) and [Widgets](./widgets.md).

`node.snapshot()` returns a frozen `NodeSnapshot` with identity, presentation,
position, and size. It can return `undefined` when the entity is gone.

## Menus and badges

Node menu entries are declarative and host-rendered:

```js
definition.addMenuItem({
  label: (node) =>
    node.getMode() === 'never' ? 'Enable node' : 'Disable node',
  when: (node) => !node.isDeleted,
  run(node) {
    node.setMode(node.getMode() === 'never' ? 'always' : 'never')
  },
  order: 20
})
```

An item may instead provide one level of `items`, either a fixed array or a
function of the current node. A submenu parent omits `run`.

Badges are small labels rendered in node chrome under both renderers:

```js
const removeBadge = node.addBadge({
  text: 'cached',
  onClick() {
    clearCache(node)
  }
})
```

Pass a function for a dynamic badge. It runs during drawing, so it must be fast.
The return value removes the badge.

## Pack-owned instance state

Do not add fields to a node or handle. Keep state outside the entity and include
graph scope in the key:

```js
const state = new Map()
const keyOf = (node) => `${node.graphId}:${node.id}`

comfy.defs.extend('MyPack/Node', (definition) => {
  definition.onCreated((node) => state.set(keyOf(node), { open: false }))
  definition.onRemoved((node) => state.delete(keyOf(node)))
})
```

When handles may come from different API instances or scopes, compare them with
`comfy.sameEntity()` rather than `===`.
