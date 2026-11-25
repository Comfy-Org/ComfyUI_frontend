# Reading and editing the graph

`comfy.graph` reads the graph, and the handles change it. Every edit of a
node, slot, link or group runs through one edit core inside the editor, so the
editor's undo, modified state and rendering stay right. The handle methods
(`node.setTitle`, `slot.modify`, `node.inputs.add`, `group.setBounds`) and
`comfy.graph.add` and `comfy.graph.batch` are the way in; the core itself is
not published. Widget values and the workflow's `extra` have their own
members ([Widgets](./widgets.md), `workflow.setExtra`).

## Reading

Reads go to the live node each time and return frozen copies. A position is
a `Point`, `{ x, y }`, and a size a `Size`, `{ width, height }`, both in graph
space; `getBounds` gives a `Bounds`, which has all four fields. A `Bounds`
passed to `setPosition` or `setSize` is refused for its extra fields: pass
`{ x, y }` or `{ width, height }`.

```ts
import { comfy } from '/comfy/api/v4.js'

for (const node of comfy.graph.selection()) {
  const position = node.getPosition()
  const size = node.getSize()
  console.info(node.type, node.getTitle(), node.getMode(), position, size)
  console.info(node.getProperty('Node name for S&R'))
  for (const input of node.inputs) {
    console.info(input.name, input.type, input.isConnected, input.source())
  }
}
```

`comfy.graph.links()`, `groups()` and `resolvedSupplies()` are empty, never
`undefined`, before there is a graph.

## Editing

Each edit is one undo step and returns `false` when its node is gone.
`setProperty` stores a copy of what the workflow saves unchanged; a `Date`, a
`NaN` or a function inside the value throws, and `undefined` deletes the
property.
`setColor` and `setBgColor` restore the default for `null` or `undefined`.
`node.setResizable` is not saved and makes no undo step; a `false` lasts until
the user unpins the node, which makes it resizable again, as the editor does
(core issue #23731).

```ts
import { comfy } from '/comfy/api/v4.js'

const node = comfy.graph.selection()[0]
if (node) {
  node.setTitle('Upscaled')
  node.setBgColor('#335')
  node.setColor(null)
  node.setPosition({ x: 100, y: 200 })
  node.setMode('bypass')
  node.setProperty('upscale', 2)
}
```

`comfy.graph.batch` runs several edits as one undo step. Loop inside one
batch, not one batch per item. `comfy.graph.add` adds a node to the graph on
screen.

```ts
import { comfy } from '/comfy/api/v4.js'

comfy.graph.batch(() => {
  const loader = comfy.graph.add('CheckpointLoaderSimple', {
    position: { x: 0, y: 0 }
  })
  const sampler = comfy.graph.add('KSampler', { position: { x: 400, y: 0 } })
  if (loader && sampler) {
    loader.outputs.byName('MODEL')?.connectTo(sampler.id, 'model')
  }
})
```

## Slots and links

A slot is named by a `SlotRef`: its id, else its name, else
`{ index: n }` for its position. A bare number is not a `SlotRef`.
`inputs.at` and `outputs.at` take a negative index to count back from the
end, as `widgets.at` does.

```ts
import { comfy } from '/comfy/api/v4.js'

const [source, target] = comfy.graph.selection()
if (source && target) {
  const input = target.inputs.add('extra', 'IMAGE')
  input?.modify({ label: 'Extra image', color: '#8c8' })
  const output = source.outputs.at(0)
  output?.connectTo(target.id, { index: 0 })
  output?.links()?.forEach((link) => {
    console.info(link.targetNodeId, link.targetIndex, link.type)
  })
  console.info(target.inputs.at(-1)?.name)
  target.inputs.remove('extra')
}
```

A slot's `color`, `colorWhenUnconnected` and `'directional'` shape show in
the canvas renderer; under Vue nodes the dot keeps its type's color and is a
circle until the Nodes 2.0 fix (#24161), while `direction` shapes the links in
both renderers.

A load, undo or redo rebuilds the slots a node's type makes. For a backend
type, their type, shape, translated name, widget and place come back from the
type, a removed one comes back, and a renamed input comes back under its own
name beside the renamed one. For any other type, such as one `define` makes,
the saved slots are merged into the type's by position, and a removed one
comes back after the others. Labels, colors, positions, directions and every
edit of a slot the pack added are kept. A subgraph
node's slots follow its subgraph, so only `inputs.reorder` works on them, and
only while the subgraph is placed once. A reorder of inputs leaves floating
links (links detached onto a reroute) at their slot index, as the host does,
so such a link then names the input that moved there (core issue #23466,
fixed by PR #24205 once it lands). Removing an input removes its floating
links.

While the workflow is shared with other participants, as the editor's agent
shares it in its collaborative mode, the slot edits (`modify`, `add`,
`remove`, `reorder`) and `moveLinksTo` change nothing and answer `false`, or
`undefined` where they give a slot or links: the editor cannot yet send these
edits to the others (core issue #23382). Titles, modes, connections and the
other edits work as usual.

## Groups, badges and the view

```ts
import { comfy } from '/comfy/api/v4.js'

for (const group of comfy.graph.groups()) {
  console.info(group.getTitle(), group.getBounds(), group.nodes()?.length)
}

const node = comfy.graph.nodes()[0]
if (node) {
  const removeBadge = node.addBadge({ text: 'checked', bgColor: '#264' })
  comfy.graph.centerOn(node)
  comfy.graph.setZoom(1.5)
  removeBadge()
}
```

`select` and `centerOn` act on the graph on screen and return `false` for a
node that is gone or not on screen. Under Vue nodes, a badge added or removed after the node is
first drawn shows or goes when its badges are next recomputed (#24163).
