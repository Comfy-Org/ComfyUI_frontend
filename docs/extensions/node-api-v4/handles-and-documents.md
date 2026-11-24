# Handles and documents

## Handles

A pack holds a node, slot, widget, group or graph through a handle: a frozen
object that names the entity and reads it live each time it is asked.

- There is one handle per entity, so two handles to one node are the same
  object. A handle is a stable `Map` or `WeakMap` key, and
  `comfy.sameEntity(a, b)` gives the same answer as `a === b` for node,
  group, slot, widget and graph-scope handles. It is `false` for anything
  else, `comfy.graph` and a document handle included.
- A handle belongs to the document it came from and to its own graph, and
  stops resolving whenever a workflow loads: another document, a return to
  this document's tab, or a reload of it. It stops as the load starts, before
  the new graph appears, and from then an edit through it returns `false`. Take a fresh handle when the
  document is shown again. A node, widget, group or graph handle survives
  undo and redo; a slot handle does not, because undo and redo rebuild slots.
  An undo or redo that steps back or forward across a load of another
  workflow into the same tab is a load too.
- Once its entity is gone, a handle still gives its identity (`id`, and
  `graphId` for a node) and reports `isDeleted`. Every other read returns
  `undefined`, a list included, and an edit through it changes nothing.
- A node, group or graph that an undo or redo brings back may be the same
  handle again, or its handle may be retired; check `isDeleted` and take a
  fresh handle from its graph when it is. Today a node keeps its handle
  through any number of undos and redos, in a subgraph as in the root graph,
  and a handle is retired when an undo goes back to before its entity was
  made, because the editor reuses the ids of removed nodes and groups (core
  issues #23333 and #23733). A widget's handle is retired when an undo or
  redo removes its node, even while the node's own handle comes back, so
  take the widget's handle again from the node.

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

Each call to `comfy.graph` asks which graph is on screen at that moment, so
`comfy.graph.add`, `links()`, `groups()`, `select` and the other graph-level
members reach another graph once the user opens or leaves a subgraph. A
handle does not follow the user: a node, slot, widget or group handle edits
its entity in its own graph, on screen or not. To make several graph-level
calls on one graph, compare `comfy.graph.id` between them.

```ts
import { comfy } from '/comfy/api/v4.js'

const everySampler = comfy.graph.queryNodes({
  scope: 'root-and-subgraphs',
  type: ['KSampler', 'KSamplerAdvanced']
})
const subgraphNames = comfy.graph.subgraphs().map((graph) => graph.name)
console.info(everySampler.length, subgraphNames)
```

`comfy.graph.version` counts the changes to the whole open document, so it
reads the same whichever of its graphs is on screen. Every edit through a
handle advances it, in any graph of the document, `workflow.setExtra`
included, and so do some of the editor's own changes, but not all: a move or
a color does not. Every undo, redo and load changes it, so an undo and the
redo after it read differently; a different reading means the document
changed, and an equal one does not prove that nothing did.

```ts
import { comfy } from '/comfy/api/v4.js'

let seen = comfy.graph.version

setInterval(() => {
  const version = comfy.graph.version
  if (version === seen) return
  seen = version
  console.info('the open document changed')
}, 1000)
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

`onDocumentClosed` fires when a document is closed, and also when the host
replaces an open tab that is not on screen because its file changed on the
server; the file then opens as a new document with a new id.

`onWorkflowLoaded` fires after every load, undo and redo, with the open
document. After a load, an edit a listener makes is the first undo step and
marks the workflow modified; after an undo or redo it is part of the
restored state, and redo is kept. A handle taken before any other load, of
this document or another, reports `isDeleted` from then on.
