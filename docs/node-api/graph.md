# Graphs and groups

`comfy.graph` is the editing surface for the graph currently shown to the user.
It provides graph-safe node, selection, viewport, group, link, and mutation
operations without exposing `LGraph` or `LGraphCanvas`.

## Visible graph, root graph, and subgraphs

The active view is not always the document root:

```js
const visible = comfy.graph
const root = comfy.graph.root()
const definitions = comfy.graph.subgraphs()
```

| Handle                                         | Scope                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GraphHandle` (`comfy.graph`)                  | The graph currently shown in the editor. Includes editing and viewport operations. |
| `GraphScopeHandle` (`root()` or `subgraphs()`) | One graph definition. Read-oriented: nodes, groups, and resolved supplies.         |

A subgraph entry represents a definition, not each placed instance. If the same
definition is placed three times, it appears once and its internal nodes appear
once.

Node IDs must be resolved inside their owning graph. Do not collect all document
nodes into a map keyed only by ID:

```js
function documentNodes() {
  const scopes = [comfy.graph.root(), ...comfy.graph.subgraphs()].filter(
    Boolean
  )

  return scopes.flatMap((scope) =>
    scope.nodes().map((node) => ({ graphId: scope.id, node }))
  )
}
```

Use `node.graphId` when persisting pack-owned in-memory state about a node.

## Looking up nodes and links

```js
const node = comfy.graph.node('42')
const samplers = comfy.graph.nodesOfType('KSampler')
const allNodes = comfy.graph.nodes()
const links = comfy.graph.links()
```

Every list is a frozen snapshot. `LinkInfo` is inert data with source and target
node IDs, slot IDs, types, and endpoint indexes at snapshot time. Indexes are
volatile; do not store them across slot mutations.

Use `node.inputs` and `node.outputs` to edit connectivity. `graph.links()` is for
inspection, not mutation.

`graph.nodeAt({ x, y })` returns the topmost node at a graph-space point using
the rendered layout and z-order. It can find nothing before the first render.

## Creating and removing nodes

```js
const node = comfy.graph.add('KSampler', {
  title: 'Preview sampler',
  position: { x: 360, y: 220 }
})

const copy = comfy.graph.duplicate(node.id, { x: 680, y: 220 })
comfy.graph.remove(node.id)
```

`add()` constructs through the registered definition. It throws when the type
does not exist. `duplicate()` carries serializable widgets and properties but
does not copy links. It returns `undefined` when the source is gone or cannot be
constructed.

`NodeHandle.remove()` removes its own node. `graph.remove(id)` is the equivalent
when only an ID is available.

## Replacing a node

Node type is identity and is read-only. Rebuild with `replace()`:

```js
const replacement = comfy.graph.replace(node.id, 'KSamplerAdvanced')
```

The operation carries position, a user-customized title, colors, mode,
compatible properties, widget values by name, and every link that still fits.
It matches slots by name first and by index as a fallback. Incompatible links
are dropped with a warning rather than forced into the wrong slot. The complete
replacement is one undo step.

Replacing with the same type is useful when a refreshed definition changed and
an existing node must be rebuilt without discarding its state.

## Compound edits and undo

Use `batch()` for one synchronous user operation:

```js
comfy.graph.batch(() => {
  const loader = comfy.graph.add('CheckpointLoaderSimple', {
    position: { x: 100, y: 100 }
  })
  const sampler = comfy.graph.add('KSampler', {
    position: { x: 500, y: 100 }
  })
  loader.outputs.get('MODEL')?.connectTo(sampler.id, 'model')
  comfy.graph.select([loader, sampler])
})
```

The scope closes even when the callback throws. It is synchronous by design;
never include an `await` inside it.

## Selection and viewport

```js
const selected = comfy.graph.selection()
comfy.graph.select([node])
comfy.graph.select([another], { add: true })
comfy.graph.select([]) // clear

comfy.graph.centerOn(node)
comfy.graph.setZoom(1.25)
const pointer = comfy.graph.pointerPosition()
```

Selection and viewport methods address the visible graph and active editor.
`pointerPosition()` is in graph coordinates and can return `undefined` when no
canvas is available. `centerOn()` does not change zoom.

For a panel anchored to a node, read `node.getScreenRect()` and update it when
the viewport changes:

```js
const stop = comfy.onViewportChanged(() => {
  const rectangle = node.getScreenRect()
  if (rectangle) positionPanel(rectangle)
})
```

Do not read or reconstruct canvas pan, scale, offsets, title height, or device
pixel ratio.

## Groups

```js
for (const group of comfy.graph.groups()) {
  console.info(group.id, group.getTitle(), group.nodes().length)
}
```

`GroupHandle` provides:

- `getTitle()` / `setTitle()`;
- `getColor()` / `setColor()`;
- `nodes()` for the nodes geometrically contained by the group;
- `getBounds()` in graph space;
- `centerOn()` for the visible view.

Groups are derived rectangles, not parents that own a stored child list. Ask
`nodes()` again after layout changes. A subgraph scope's `groups()` reads groups
inside that definition.

## Structural version token

`graph.version` changes when graph-visible state changes, including node or slot
structure, connections, node flags, and widget values committed through the
host protocol.

Treat it as an opaque token:

```js
const before = comfy.graph.version
await refreshExternalData()
if (comfy.graph.version !== before) rebuildIndex()
```

Do not subtract versions, assume increments of one, or use it as a replayable
event log. Pack state held outside the graph and widget model does not affect
it. A custom canvas widget whose external drawing data changed should call its
own `redraw()`.

## Node and graph observation

There is no per-frame tick. Observe the semantic operation:

### Node property changes

```js
const stop = comfy.onNodeChanged(
  ({ graphId, node, property, from, to }) => {
    updateIndex(graphId, node.id, property, from, to)
  },
  { scope: 'document' }
)
```

The default scope is `visible`. `scope: 'document'` includes the root and every
subgraph definition. Each event names its graph because node ID alone is not a
document-wide key.

The tracked fields are title, mode, foreground color, background color, shape,
and advanced-widget visibility. Position uses the movement stream instead
because it changes continuously during a drag.

### Movement and drag completion

```js
const stopMove = comfy.onNodeMoved(({ node, position }) => {
  updateGuide(node, position)
})

const stopEnd = comfy.onNodeDragEnd((nodes) => {
  commitDropBehavior(nodes)
})
```

A pack that moves nodes from its own movement handler must guard against
re-entry. `onNodeDragEnd` is available under Nodes 2.0; the legacy renderer does
not publish a drag lifecycle.

### Editor interaction state

`comfy.isInteracting()` reports whether the editor is already handling a link,
node, or widget gesture. A pack starting its own pointer gesture should stand
down while it is true.

## Resolved supply inspection

`graph.resolvedSupplies()` runs the same pure supplier and priority arbitration
used by prompt construction and returns the winning graph-local edges without
mutating the graph. It is intended for editor commands that materialize virtual
broadcasts as real links. Exact-priority ties are absent, matching execution.

See [Execution and resolution](./execution.md) for supplier semantics.
