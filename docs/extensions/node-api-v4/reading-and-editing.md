# Reading and editing the graph

`comfy.graph` reads and `comfy.edit` writes. Every edit goes through
`comfy.edit`, so the editor's undo, modified state and rendering stay right.
The edit methods on handles (`node.setTitle`, `slot.modify`,
`node.inputs.add`) are one-line calls into `comfy.edit`.

## Reading

Reads go to the live node each time and return frozen copies. A position or
size is an object, `{ x, y }` or `{ width, height }`, in graph space.

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

## Editing

Each edit is one undo step and returns `false` when its node is gone. A field a
patch leaves out stays as it is.

```ts
import { comfy } from '/comfy/api/v4.js'

const node = comfy.graph.selection()[0]
if (node) {
  comfy.edit.updateNode(node, {
    title: 'Upscaled',
    bgColor: '#335',
    position: { x: 100, y: 200 }
  })
  node.setMode('bypass')
  node.setProperty('upscale', 2)
}
```

`comfy.edit.batch` runs several edits as one undo step. Loop inside one batch,
not one batch per item.

```ts
import { comfy } from '/comfy/api/v4.js'

const root = comfy.graph.root()
if (root) {
  comfy.edit.batch(() => {
    const loader = comfy.edit.addNode(root, 'CheckpointLoaderSimple', {
      position: { x: 0, y: 0 }
    })
    const sampler = comfy.edit.addNode(root, 'KSampler', {
      position: { x: 400, y: 0 }
    })
    const model = loader?.outputs.byName('MODEL')
    const input = sampler?.inputs.byName('model')
    if (model && input) comfy.edit.connect(model, input)
  })
}
```

## Slots and links

A slot is named by a `SlotRef`: its id, else its name, else
`{ index: n }` for its position. A bare number is not a `SlotRef`.

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
  target.inputs.remove('extra')
}
```

A load, undo or redo rebuilds the slots a node's type makes: their type,
shape, translated name, widget and place come back from the type, a removed one
comes back, and a renamed backend input comes back under its own name beside
the renamed one. Labels, colors, positions, directions and every edit
of a slot the pack added are kept. A subgraph
node's slots follow its subgraph, so only `inputs.reorder` works on them.

## Groups, badges and the view

```ts
import { comfy } from '/comfy/api/v4.js'

for (const group of comfy.graph.groups() ?? []) {
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
node that is gone or not on screen.
