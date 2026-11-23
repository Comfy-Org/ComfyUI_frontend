# Node definitions and hooks

`comfy.defs` reads node types, defines the pack's own, and extends types with
hooks.

## The pack's id

`define` and `extend` take the pack's id first. A module gets it with
`comfy.registerPack(import.meta)`; every module of the pack gets the same
object. Its `id` and `version` are the `[project] name` and `version`
of the pack's own `pyproject.toml`, which the backend checks at startup and
serves to the editor before any pack loads, so nothing about the pack is typed
in JavaScript. A module outside `/extensions/<folder>/` (under the install's
base path), or of a folder the backend refused, throws a `TypeError`. Against
an older backend that does not check packs, the `id` is the folder
name, lower-cased, and the `version` is `undefined`.

```ts
import { comfy } from '/comfy/api/v4.js'

export const packId = comfy.registerPack(import.meta)
console.info(packId.id, packId.version)
```

The pack id says which pack a definition and a saved field belong to: the
fields a pack's `onSerialize` hooks return are saved under the node's
`extensions[packId.id]`, and the nodes of a type the pack defines are made with
`properties.cnr_id` (and `ver`), so a workflow opened without the pack can
offer to install it. `setProperty` refuses `cnr_id`, `aux_id` and `ver`.

## Extending a type

`extend(packId, selector, apply)` calls `apply` once for each type the selector picks,
now and as types register later, and again for each type when the
definitions reload (`defs.refresh`, or the editor reloading them). The selector is a type name, a list of
names, a pattern, `{ category }`, or a test of the definition. The builder's
methods can be called only while `apply` runs.

```ts
import { comfy } from '/comfy/api/v4.js'

const packId = comfy.registerPack(import.meta)
const stop = comfy.defs.extend(packId, 'KSampler', (builder) => {
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
  `false` to refuse, `onSerialize` returns fields to save, a property event's
  `setValue` and `reject`, and `onDragOver` and `onDrop` return `true` to
  take a drop.
- A hook reaches a node that joined a graph after the `extend` call, from the
  moment it joins. **A late `extend` reaches only nodes that join afterwards**:
  it never reaches a node already in a graph, and `onCreated` is not replayed
  for existing nodes. Read those through `comfy.graph`.
- A hook runs only for a node in a graph, with that node's handle. App mode
  does not ask `onDragOver` or `onDrop`: it calls the drag methods on a copy
  of the node's state, which no hook can reach (core issue #23732).
- A load, an undo and a redo rebuild the graph: their nodes are `loading` in
  `onCreated`, and `onRemoved` is called for every node they replace, not only
  for a node the user deleted.
- A hook that throws is reported; the editor and the other hooks go on.
- Unsubscribing removes the extension's hooks.

`onSerialize` returns fields to save with the node. They are saved under the
pack's own entry of the node's `extensions`, never on the node itself, so they
cannot change what the node is or meet another pack's fields; a field the
node saves itself (`title`, `properties`, `widgets_values` and the rest) or
`extensions` is refused with the whole result. The results of a pack's hooks
merge, a later one winning, and a hook that returns nothing keeps what the
node loaded with. `onConfigured` gives the saved node with the pack's own
fields beside the node's, and no other pack's. It also has the fields a V1
extension saved at the top level of the node, so a pack converted from V1
reads what its V1 version saved in old workflows; the pack's own field wins
over such a field of the same name, and the node's own fields win over both. An entry an older backend
saved under the pack's folder name is found too, and the next save writes it
under the id.

```ts
import { comfy } from '/comfy/api/v4.js'

const packId = comfy.registerPack(import.meta)
comfy.defs.extend(packId, /^MyPack\./, (builder) => {
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

`define(packId, definition)` registers a type the pack owns, and stamps each
of its nodes with the pack's `cnr_id` and `ver` as it is made; a saved
workflow's own values replace them when it loads. Its `execution` defaults to
`'frontend'`: the node is left out of the prompt. A type the backend runs
needs `execution: 'backend'`. Its `widgets` are saved with a node only while
`node.isSerializingWidgets()` is true, and that flag is not saved, so a type
whose widget values should be kept calls `node.setSerializeWidgets(true)` as
each node is made. `presentation.resizable: false` lasts until the user unpins
a node, as in the editor, and a load or undo sets it again.

```ts
import { comfy } from '/comfy/api/v4.js'

const packId = comfy.registerPack(import.meta)
const undefine = comfy.defs.define(packId, {
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
