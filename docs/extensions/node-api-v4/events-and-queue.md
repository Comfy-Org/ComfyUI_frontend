# Events and the queue

Every listener returns a function that removes it.

## Editor events

```ts
import { comfy } from '/comfy/api/v4.js'

comfy.onNodeChanged(
  (event) => {
    if (event.property === 'mode')
      console.info(event.node.id, 'is now', event.to)
  },
  { scope: 'root-and-subgraphs' }
)
comfy.onNodeMoved((event) => console.info(event.node.id, event.position))
comfy.onNodeDragEnd(() => console.info('drag ended'))
comfy.onSelectionChanged((nodes) => console.info(nodes.length, 'selected'))
comfy.onViewportChanged(() => {
  if (!comfy.isInteracting()) console.info('view moved')
})
```

`onNodeChanged` reports title, mode, color and body color changes the user or
a pack makes. `to` is what the node's matching read returns after the change.
Its scope is `'visible'`, the graph on screen, unless the options say
`'root-and-subgraphs'`. A load, undo or redo is not reported as such: it
reports each saved mode other than `'always'` and each saved color, changed or
not, and never a title (core issue #23741). Re-read the nodes in
`onWorkflowLoaded` instead.

`onNodeMoved` sees a pack's own moves too, and a load, undo or redo reports
each node it places twice: first at its saved x and y 10, then at its saved
position (core issue #23745). `onViewportChanged` goes silent if the canvas
menu is hidden or builder mode is entered after its first listener
subscribed, until every listener has left and one subscribes again (core
issue #23740).

## Execution progress

```ts
import { comfy } from '/comfy/api/v4.js'

comfy.onExecutingNodeChanged((node) => {
  console.info(node ? `running ${node.getTitle()}` : 'idle')
})
const nested = comfy.executionNode('12:5')
console.info(nested?.type, comfy.executingNode()?.id)
```

## Documents and importers

```ts
import { comfy } from '/comfy/api/v4.js'

comfy.onWorkflowLoaded((document) => console.info('loaded', document?.name))

comfy.workflow.registerImporter({
  id: 'MyPack.mpwWorkflow',
  extensions: ['.mpw'],
  maxBytes: 1_000_000,
  parse(bytes) {
    const text = new TextDecoder().decode(bytes)
    return text.startsWith('{') ? { workflow: text } : undefined
  }
})
```

`workflow.open(data)` opens a workflow as a new document and resolves whether
the editor loaded it: `false` for an object that is not a workflow. Data that
is not an object throws a `TypeError` at the call, not as a rejected promise.

## The queue

```ts
import { comfy } from '/comfy/api/v4.js'

comfy.queue.onBeforeRun(() => {
  console.info('building a prompt')
  return () => console.info('sent or refused')
})
comfy.queue.onAfterRun((event) => console.info('queued', event.promptIds))
comfy.queue.onRejected(() => console.info('the backend refused a prompt'))
comfy.queue.onPendingChanged((pending) => console.info(pending, 'pending'))

const outputs = comfy.graph.nodesOfType('SaveImage')
if (outputs.length > 0) {
  const queued = await comfy.queue.run({ nodes: outputs })
  if (!queued) console.info('not queued')
}
```

Options `run` cannot use throw a `TypeError` at the call. `run` resolves
`true` once its prompts are submitted, and also when a request
fails with no answer from the backend. It resolves `false` if a node it names
is gone or the run was folded into one in progress, refused, given node errors
or stopped before sending. A run whose every prompt is refused fires only
`onRejected`. A rejected promise from an async `onBeforeRun` is reported, and
gives no cleanup function.
