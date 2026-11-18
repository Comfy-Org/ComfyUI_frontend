# Node definitions and hooks

`comfy.defs` reads node types, defines the pack's own, and extends types with
hooks.

## Extending a type

`extend(selector, apply)` calls `apply` once for each type the selector picks,
now and as types register later. The selector is a type name, a list of
names, a pattern, `{ category }`, or a test of the definition. The builder's
methods can be called only while `apply` runs.

```ts
import { comfy } from '/comfy/api/v4.js'

const stop = comfy.defs.extend('KSampler', (builder) => {
  builder.onCreated((node, event) => {
    if (!event.loading) node.setColor('#353')
  })
  builder.onExecuted((node, result) => {
    console.info(node.id, result.text, result.images.length)
  })
  builder.onConnectionsChanged((node, event) => {
    console.info(node.id, event.side, event.name, event.connected)
  })
  builder.addMenuItem({
    label: 'Reset seed',
    run: (node) => node.widgets.get('seed')?.setValue(0)
  })
})
stop()
```

### When hooks run

- Hooks are listeners, not overrides. They run after the method the node's
  class already had, in the order the extensions were made, and can change
  the outcome only where their contract says: `onBeforeConnect` returns
  `false` to refuse, `onSerialize` returns fields to add, a property event's
  `setValue` and `reject`, and `onDragOver` and `onDrop` return `true` to
  take a drop.
- A hook reaches a node that joined a graph after the `extend` call, from the
  moment it joins. **A late `extend` reaches only nodes that join afterwards**:
  it never reaches a node already in a graph, and `onCreated` is not replayed
  for existing nodes. Read those through `comfy.graph`.
- A hook runs only for a node in a graph, with that node's handle.
- A load, an undo and a redo rebuild the graph: their nodes are `loading` in
  `onCreated`, and `onRemoved` is called for every node they replace, not only
  for a node the user deleted.
- A hook that throws is reported; the editor and the other hooks go on.
- Unsubscribing removes the extension's hooks.

`onConfigured` gives the saved node, including fields an `onSerialize` hook
added:

```ts
import { comfy } from '/comfy/api/v4.js'

comfy.defs.extend(/^MyPack\./, (builder) => {
  builder.onSerialize((node) => ({
    myPackLastRun: node.getProperty('lastRun')
  }))
  builder.onConfigured((node, data) => {
    console.info(node.id, data.myPackLastRun)
  })
  builder.onPropertyChanged((node, event) => {
    if (event.name === 'scale' && typeof event.value !== 'number')
      event.reject()
  })
})
```

## Defining a type

`define` registers a type the pack owns. Its `execution` defaults to
`'frontend'`: the node is left out of the prompt. A type the backend runs
needs `execution: 'backend'`.

```ts
import { comfy } from '/comfy/api/v4.js'

const undefine = comfy.defs.define({
  type: 'MyPack.Note',
  title: 'Pack note',
  category: 'MyPack',
  widgets: [{ type: 'text', name: 'text', value: '' }],
  onCreated(node) {
    node.setSize({ width: 300, height: 120 })
  }
})
console.info(comfy.defs.has('MyPack.Note'), typeof undefine)
```

## Reading types

```ts
import { comfy } from '/comfy/api/v4.js'

const sampler = comfy.defs.get('KSampler')
console.info(
  sampler?.inputs.map((input) => input.name),
  sampler?.category
)
console.info(
  comfy.defs.typeColor('MODEL'),
  comfy.defs.isTypeCompatible('MODEL', '*')
)
const stopColor = comfy.defs.setTypeColor('MYPACK_MASKS', '#c80')
comfy.defs.onRefreshed(() => console.info(comfy.defs.all().length, 'types'))
stopColor()
```
