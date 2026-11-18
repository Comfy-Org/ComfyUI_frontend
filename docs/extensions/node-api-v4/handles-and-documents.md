# Handles and documents

## Handles

A pack holds a node, slot, widget, group or graph through a handle: a frozen
object that names the entity and reads it live each time it is asked.

- There is one handle per entity, so two handles to one node are the same
  object. A handle is a stable `Map` or `WeakMap` key, and
  `comfy.sameEntity(a, b)` gives the same answer as `a === b`.
- A handle belongs to the document it came from and to its own graph, and
  stops resolving whenever a workflow loads: another document, a return to
  this document's tab, or a reload of it. Take a fresh handle when the
  document is shown again. A node, widget, group or graph handle survives
  undo and redo; a slot handle does not, because undo and redo rebuild slots.
- Once its entity is gone, a handle still gives its identity (`id`, and
  `graphId` for a node) and reports `isDeleted`. Every other read returns
  `undefined`, a list included, and an edit through it changes nothing.
- A node that an undo or redo brings back is the same handle again, however
  many undos and redos ran while it was gone, unless one of them went back to
  before the node was added; then take a new one. A group's handle is retired
  for good by an undo or redo that finds the group gone and no newer group in
  its graph, because the next group made takes its id (core issue #23733).

```ts
import type { v4 } from '@comfyorg/comfyui-frontend-types'

import { comfy } from '/comfy/api/v4.js'

const lastSeed = new WeakMap<v4.NodeHandle, number>()

comfy.onWorkflowLoaded(() => {
  for (const node of comfy.graph.nodesOfType('KSampler')) {
    const seed = node.widgets.get('seed')?.getValue()
    if (typeof seed === 'number') lastSeed.set(node, seed)
  }
})
```

A node id alone names a node only within its graph and document: another
document reuses the same ids. Keep the handle, not the id.

## Graphs

`comfy.graph` is the graph on screen. It may be the root graph or a subgraph
the user opened. `comfy.graph.root()` and `comfy.graph.subgraphs()` give a
`GraphScopeHandle` for each graph of the open document, and
`queryNodes({ scope: 'root-and-subgraphs' })` reads all of them at once.

```ts
import { comfy } from '/comfy/api/v4.js'

const everySampler = comfy.graph.queryNodes({
  scope: 'root-and-subgraphs',
  type: ['KSampler', 'KSamplerAdvanced']
})
const subgraphNames = comfy.graph.subgraphs().map((graph) => graph.name)
console.info(everySampler.length, subgraphNames)
```

## Documents

A document is one open workflow, from opening it to closing it. Its id is the
same through undo, redo and tab switches; it means nothing after a page
reload, so do not save it.

```ts
import { comfy } from '/comfy/api/v4.js'

comfy.onDocumentActivated((document) => {
  console.info('now editing', document.name ?? 'an unsaved workflow')
})

comfy.onDocumentClosed((document) => {
  console.info(document.id, 'closed; isDeleted is', document.isDeleted)
})

const workflow = comfy.workflow.snapshot()
console.info(workflow ? Object.keys(workflow) : 'no document yet')
```

`onWorkflowLoaded` fires after every load, undo and redo, with the open
document. A handle taken before any other load, of this document or
another, reports `isDeleted` from then on.
