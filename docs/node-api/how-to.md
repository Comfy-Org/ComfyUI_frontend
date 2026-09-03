# Migration how-to: LiteGraph intent to the published API

This guide answers “I used to do X through LiteGraph or `app`; how do I preserve
that behavior through the published API?” It is based on the custom-node
conversion corpus, including cases where the correct replacement was not the
API with the most similar name.

The published entry point is always:

```js
import { comfy } from '/comfy/api/v2.js'
```

Use this guide for live frontend behavior. If an object came from `JSON.parse`,
a workflow file, `graphToPrompt`, or a backend response, it is data rather than
a live node. Do not replace fields inside serialized data with handle methods.

## Start with the behavior

Before choosing a replacement, state what the old code accomplishes for the
user. One old mechanism often served several unrelated purposes:

| Old mechanism                       | Possible intent                | Published destination                                  |
| ----------------------------------- | ------------------------------ | ------------------------------------------------------ |
| `onDrawForeground`                  | Show a small status label      | `node.addBadge()`                                      |
| `onDrawForeground`                  | Draw a control                 | `node.widgets.canvas()`                                |
| `onDrawForeground`                  | Enforce node size              | `node.setSizeConstraints()`                            |
| `onDrawForeground`                  | Poll a value                   | A widget, node, graph, or viewport event               |
| `onDrawForeground`                  | Keep DOM aligned               | `node.widgets.mount()` and `comfy.onViewportChanged()` |
| `getCustomWidgets`                  | Render one backend input type  | `comfy.defs.defineWidgetType()`                        |
| `getCustomWidgets`                  | Add a surface to one live node | `node.widgets.mount()`                                 |
| `widgets.splice()`                  | Reorder widgets                | `widgets.reorder()` or `widgets.move()`                |
| Remove and reinsert the same widget | Invalidate changed options     | `widget.setOption()`                                   |
| `node.type = value`                 | Defensive self-assignment      | Delete the write                                       |
| `node.type = newType`               | Replace the node type          | `comfy.graph.replace()`                                |
| `widget.callback(value)`            | Commit a new value             | `widget.setValue(value)`                               |
| Capture and chain `widget.callback` | Observe changes                | `widget.on('change', listener)`                        |
| Button `widget.callback()`          | Run an action                  | `widget.on('activate', listener)`                      |

Do not migrate by spelling alone. Trace what the callback reads, what it writes,
when it runs, and which saved or queued bytes it affects.

## Quick lookup by legacy surface

This index gives the usual destination. Follow the detailed recipe whenever the
row names more than one destination or changes saved workflow topology.

| Legacy surface                                     | Published destination                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `app.registerExtension(...)`                       | Split registration across `comfy.defs`, `settings`, `commands`, UI, and lifecycle APIs |
| `beforeRegisterNodeDef`                            | `comfy.defs.extend(selector, builder => ...)`                                          |
| `nodeType.prototype.onNodeCreated`                 | `builder.onCreated()`                                                                  |
| `nodeType.prototype.onConfigure`                   | `builder.onConfigured()`                                                               |
| `nodeType.prototype.onExecuted`                    | `builder.onExecuted()`                                                                 |
| `nodeType.prototype.onRemoved`                     | `builder.onRemoved()`                                                                  |
| `nodeType.prototype.onConnectionsChange`           | `builder.onConnectionsChanged()`                                                       |
| `nodeType.prototype.onDragOver` / `onDragDrop`     | `builder.onDragOver()` / `builder.onDrop()`                                            |
| `nodeType.prototype.onSerialize`                   | `builder.onSerialize()` for pack-owned fields                                          |
| `extends LGraphNode` / `registerNodeType`          | `comfy.defs.define()`                                                                  |
| `app.graph._nodes`                                 | `comfy.graph.nodes()`                                                                  |
| `graph.getNodeById(id)`                            | `comfy.graph.node(id)` or a scoped `graph.node(id)`                                    |
| `graph._groups`                                    | `comfy.graph.groups()` or a scoped `graph.groups()`                                    |
| `canvas.selected_nodes`                            | `comfy.graph.selection()`                                                              |
| `canvas.selectNode(...)`                           | `comfy.graph.select(...)`                                                              |
| `canvas.centerOnNode(node)`                        | `comfy.graph.centerOn(node)`                                                           |
| `LiteGraph.createNode()` plus `graph.add()`        | `comfy.graph.add()`                                                                    |
| `node.clone()` plus `graph.add()`                  | `comfy.graph.duplicate()`                                                              |
| `graph.remove(node)`                               | `node.remove()` or `comfy.graph.remove()`                                              |
| Replace or retype a live node                      | `comfy.graph.replace()`                                                                |
| `graph.beforeChange()` / `afterChange()`           | `comfy.graph.batch()`                                                                  |
| `graph._version++`                                 | Delete the write; published mutations update `graph.version`                           |
| Document pointer listeners for a node gesture      | `comfy.onNodeMoved()` and, in Nodes 2.0, `comfy.onNodeDragEnd()`                       |
| `canvas.connecting_links` / `resizing_node`        | `comfy.isInteracting()`                                                                |
| `node.pos` / `node.size`                           | `getPosition()` / `setPosition()` and `getSize()` / `setSize()`                        |
| `node.getBounding()`                               | `node.getBounds()`                                                                     |
| `node.getConnectionPos()`                          | `node.getSlotPosition()`                                                               |
| Canvas transform and `graph_mouse`                 | `node.getScreenRect()` and `comfy.graph.pointerPosition()`                             |
| `input.link`                                       | `input.isConnected`, `input.link()`, `input.source()`, or `input.disconnect()`         |
| `output.links`                                     | `output.links()`, `output.connectTo()`, or `output.disconnect()`                       |
| Disconnect then reconnect to another output        | `output.moveLinksTo()`                                                                 |
| `node.addInput()` / `addOutput()`                  | `node.inputs.add()` / `node.outputs.add()`                                             |
| `node.removeInput()` / `removeOutput()`            | `node.inputs.remove()` / `node.outputs.remove()`                                       |
| Direct slot name, type, label, or shape writes     | `slot.modify()`                                                                        |
| Mutate slot arrays to reorder                      | `node.inputs.reorder()` / `node.outputs.reorder()`                                     |
| `LiteGraph.isValidConnection()`                    | `comfy.defs.isTypeCompatible()`                                                        |
| Read or merge a connected Primitive's config       | `input.widgetConfig()` / `input.mergeWidgetConfig()`                                   |
| Patch `connectByType` for a link dropped on a node | `builder.onUnplacedLink()`                                                             |
| `widget.value = value; widget.callback(value)`     | `widget.setValue(value)`                                                               |
| Replace or chain `widget.callback`                 | `widget.on('change')` or `widget.on('activate')`                                       |
| `widget.type = 'converted-widget'`                 | `widget.setHidden(true)`                                                               |
| `widget.options[key] = value`                      | `widget.setOption(key, value)`                                                         |
| `widget.disabled = value`                          | `widget.setDisabled(value)`                                                            |
| `widget.linkedWidgets`                             | `widget.linked()` / `widget.setLinked()`                                               |
| `widget.computeSize`                               | `widget.setHeight()` or node size constraints                                          |
| `widgets.push()` / `removeWidget()`                | `widgets.add()` / `widgets.remove()`                                                   |
| `widgets.splice()` / replace widget array          | `widgets.move()` / `widgets.reorder()` after classifying intent                        |
| `node.addDOMWidget()`                              | `node.widgets.mount()`                                                                 |
| `widget.inputEl`                                   | `textInteraction` for a host editor, or `widgets.mount()` for a pack control           |
| `getCustomWidgets` for an input type               | `comfy.defs.defineWidgetType()`                                                        |
| `widget.serializeValue`                            | Widget serialization flags or `beforeSerialize`                                        |
| Name-keyed object written into `widgets_values`    | Delete the write; use named handles and migrate old data in `onConfigured()`           |
| Custom upload UI beside an upload-declared input   | Delete it; use the host's built-in upload control                                      |
| `node.imgs = ...` for pack drawing                 | `node.widgets.canvas()` and `CanvasHandle.redraw()`                                    |
| Draw status text in node chrome                    | `node.addBadge()`                                                                      |
| `onDrawForeground` / `onDrawBackground`            | Canvas widget, semantic event, mount lifecycle, or size constraint based on intent     |
| `canvas.setDirty()` / `setDirtyCanvas()`           | Usually delete; use `CanvasHandle.redraw()` for external canvas-widget data            |
| Read `node.imgs` / `imageIndex` from another node  | `getOutputImages()` / `getDisplayedImageIndex()`                                       |
| `getExtraMenuOptions`                              | `builder.addMenuItem()`                                                                |
| `new LiteGraph.ContextMenu(...)`                   | `comfy.ui.showMenu()` when the pack owns the triggering gesture                        |
| Inject sidebar, top-bar, action-bar, or modal DOM  | `comfy.ui` contributions                                                               |
| `app.ui.settings` / extension `settings`           | `comfy.settings`                                                                       |
| Replace the canvas background draw hook            | Write the core `Comfy.Canvas.BackgroundImage` setting                                  |
| Extension `commands`, keybindings, and toast       | `comfy.commands`                                                                       |
| `api.fetchApi()` / `api.apiURL()`                  | `comfy.backend.fetch()` / `comfy.backend.url()`                                        |
| `api.addEventListener()` for pack messages         | `comfy.backend.on()`                                                                   |
| Global preview and executing listeners             | Definition `onPreview()` or root execution observers                                   |
| `app.queuePrompt()`                                | `comfy.queue` plus serialization, resolution, or supply for the actual intent          |
| Read or mutate queue setting stores                | `queue.autoQueueMode()`, `setAutoQueueMode()`, `batchCount()`, or `setBatchCount()`    |
| `graphToPrompt` wrapper used only for a sidecar    | Pack backend route, partial queueing, and correlated execution events                  |
| `app.loadGraphData()`                              | `comfy.workflow.open()`                                                                |
| `app.applyTextReplacements()`                      | `comfy.workflow.applyTextReplacements()`                                               |
| `localStorage` or direct user-data APIs            | `comfy.storage` for user-authored pack documents                                       |
| `LGraphCanvas.node_colors[name]`                   | `comfy.defs.nodeColor(name)`                                                           |
| Read or write pack link-type colors                | `comfy.defs.typeColor()` / `setTypeColor()`                                            |

## Registration and lifecycle

### How do I replace `app.registerExtension()`?

Split the registration by behavior. The old extension object combined node
definition hooks, commands, settings, custom widgets, and application
lifecycle. The published API gives each one an explicit owner.

| Legacy extension field                 | Published API                                  |
| -------------------------------------- | ---------------------------------------------- |
| `beforeRegisterNodeDef`                | `comfy.defs.extend()`                          |
| `registerCustomNodes`                  | `comfy.defs.define()`                          |
| `getCustomWidgets`                     | `comfy.defs.defineWidgetType()`                |
| `settings`                             | `comfy.settings.declare()`                     |
| `commands` and keybindings             | `comfy.commands.register()`                    |
| `setup` for registration               | Run at module scope                            |
| `setup` that needs the initialized app | `comfy.onReady()`                              |
| Workflow setup                         | Definition hooks or `comfy.onWorkflowLoaded()` |

Old:

```js
app.registerExtension({
  name: 'MyPack.SamplerTools',
  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== 'KSampler') return

    const previous = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function () {
      previous?.apply(this, arguments)
      installSamplerTools(this)
    }
  }
})
```

Published API:

```js
comfy.defs.extend('KSampler', (definition) => {
  definition.onCreated((node, event) => {
    installSamplerTools(node, event)
  })
})
```

Definition callbacks compose. Do not capture and invoke a previous prototype
method.

### How do I run code after a node is restored?

Use `onCreated` for a live, addressable node and inspect its event:

```js
comfy.defs.extend('MyPack/Node', (definition) => {
  definition.onCreated((node, event) => {
    if (!event.restored) initializeFreshNode(node)
    if (event.loading) restoreDocumentResources(node)
  })

  definition.onConfigured((node, savedData) => {
    migratePackOwnedState(node, savedData)
  })
})
```

`restored` covers nodes carrying saved state, including duplicate and paste.
`loading` distinguishes a workflow load. Use `onConfigured` when the behavior
needs the saved node record.

### How do I keep private state on a node?

Do not assign custom fields to `LGraphNode` or `NodeHandle`. Keep pack state in
a map and include graph scope in its key:

```js
const state = new Map()
const keyOf = (node) => `${node.graphId}:${node.id}`

comfy.defs.extend('MyPack/Node', (definition) => {
  definition.onCreated((node) => {
    state.set(keyOf(node), { expanded: false })
  })

  definition.onRemoved((node) => {
    state.delete(keyOf(node))
  })
})
```

## Nodes and graphs

### How do I read or change node state?

Handles use methods so reads can resolve current store state and writes can use
host mutation behavior.

| Legacy live-node access | Published API                                              |
| ----------------------- | ---------------------------------------------------------- |
| `node.title`            | `node.getTitle()` / `node.setTitle(title)`                 |
| `node.mode`             | `node.getMode()` / `node.setMode(mode)`                    |
| `node.flags.collapsed`  | `node.isCollapsed()` / `node.setCollapsed(value)`          |
| `node.flags.pinned`     | `node.isPinned()` / `node.setPinned(value)`                |
| `node.color`            | `node.getColor()` / `node.setColor(color)`                 |
| `node.bgcolor`          | `node.getBgColor()` / `node.setBgColor(color)`             |
| `node.shape`            | `node.getShape()` / `node.setShape(shape)`                 |
| `node.properties[name]` | `node.getProperty(name)` / `node.setProperty(name, value)` |
| `node.pos`              | `node.getPosition()` / `node.setPosition(point)`           |
| `node.size`             | `node.getSize()` / `node.setSize(size)`                    |
| `{ ...node }`           | `node.snapshot()`                                          |

Assigning a new property to a closed handle is not a mutation API. Use the
setter, or a pack-owned map when the value is not entity state.

### How do I enumerate or find nodes?

```js
const visibleNodes = comfy.graph.nodes()
const sampler = comfy.graph.node(nodeId)
const samplers = comfy.graph.nodesOfType('KSampler')
const selected = comfy.graph.selection()
```

These replace `app.graph._nodes`, `app.graph.getNodeById()`,
`canvas.selected_nodes`, and renderer selection stores for node selection.
Returned arrays are frozen snapshots.

`comfy.graph` is the graph currently visible. For document-wide work, preserve
scope rather than flattening IDs:

```js
const scopes = [comfy.graph.root(), ...comfy.graph.subgraphs()].filter(Boolean)

for (const scope of scopes) {
  for (const node of scope.nodes()) indexNode(scope.id, node)
}
```

### How do I add, clone, remove, or replace a node?

| Legacy operation                                    | Published API                                    |
| --------------------------------------------------- | ------------------------------------------------ |
| `LiteGraph.createNode(type)` plus `graph.add(node)` | `comfy.graph.add(type, init)`                    |
| `graph.add(node.clone())`                           | `comfy.graph.duplicate(node.id, position)`       |
| `graph.remove(node)`                                | `node.remove()` or `comfy.graph.remove(node.id)` |
| Delete and recreate to refresh a definition         | `comfy.graph.replace(node.id, node.type)`        |
| Change `node.type`                                  | `comfy.graph.replace(node.id, newType)`          |

```js
const replacement = comfy.graph.replace(node.id, 'KSamplerAdvanced')
```

`replace()` carries compatible state and links and groups the operation into one
undo step on the visible graph. A defensive write such as
`node.type = node.type ?? undefined` has no user behavior and should be removed
instead of converted.

### How do I make several edits one undo step?

Replace `graph.beforeChange()` / `graph.afterChange()` pairs with a synchronous
scope:

```js
comfy.graph.batch(() => {
  const first = comfy.graph.add('CheckpointLoaderSimple')
  const second = comfy.graph.add('KSampler')
  first.outputs.get('MODEL')?.connectTo(second.id, 'model')
  comfy.graph.select([first, second])
})
```

Do not hold a batch across `await`.

### How do I respond to graph changes without polling?

Choose the narrowest semantic signal:

| Intent                                 | Published signal                    |
| -------------------------------------- | ----------------------------------- |
| A widget value changed                 | `widget.on('change', listener)`     |
| A connection changed                   | `definition.onConnectionsChanged()` |
| A property changed                     | `definition.onPropertyChanged()`    |
| Any visible or document node changed   | `comfy.onNodeChanged()`             |
| A node moved                           | `comfy.onNodeMoved()`               |
| A Nodes 2.0 drag ended                 | `comfy.onNodeDragEnd()`             |
| Pan, zoom, or viewport resize          | `comfy.onViewportChanged()`         |
| Coarse “did graph state change?” check | Compare `comfy.graph.version`       |

Do not increment `graph._version` yourself. Published mutations and committed
widget values advance host change state. Treat `graph.version` as an opaque
token, not a counter or event log.

### How do I accept a file dropped from the browser?

Register the behavior on the node definition instead of replacing renderer
drop methods:

```js
comfy.defs.extend('MyPack/ImageNode', (definition) => {
  definition.onDragOver((_node, event) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files')
  )

  definition.onDrop(async (node, event) => {
    const file = event.dataTransfer?.files?.[0]
    if (!file) return false

    const uploadedName = await uploadFile(file)
    node.widgets.get('image')?.setValue(uploadedName)
    return true
  })
})
```

Returning `true` from `onDragOver` asks both renderers to present and route the
drop. Returning `true` from `onDrop` claims it; handlers after the claimant do
not run. The host gets the first opportunity, so this extends file handling
rather than replacing behavior another pack or core already owns.

## Slots and links

### How do I inspect an input connection?

| Legacy input access                            | Published API            |
| ---------------------------------------------- | ------------------------ |
| `input.link != null`                           | `input.isConnected`      |
| `graph.links[input.link]`                      | `input.link()`           |
| Find the immediate source                      | `input.source()`         |
| Follow frontend reroutes and virtual values    | `input.resolvedSource()` |
| Determine the arriving type through a boundary | `input.connectedType`    |

```js
const input = node.inputs.get('model')
if (input?.isConnected) {
  console.info(input.source())
  console.info(input.resolvedSource())
}
```

Use the physical source for graph editing and the resolved source for reasoning
about execution.

### How do I connect or disconnect slots?

```js
const output = source.outputs.get('IMAGE')

output?.connectTo(target.id, 'image')
target.inputs.get('image')?.disconnect()
output?.disconnect(target.id)
output?.disconnect()
```

These replace editing `input.link`, pushing into `output.links`, and mutating
the graph's link map. Normal compatibility checks and connection-veto hooks
still run.

### How do I add or remove dynamic inputs and outputs?

```js
comfy.defs.extend('MyPack/MultiImage', (definition) => {
  definition.onConnectionsChanged((node) => {
    const last = node.inputs.at(node.inputs.length - 1)
    if (last?.isConnected) {
      node.inputs.add(`image_${node.inputs.length + 1}`, 'IMAGE')
    }
  })
})
```

Use `node.inputs.add/remove` and `node.outputs.add/remove` instead of
`addInput`, `removeInput`, `addOutput`, or array mutation. Removing a slot
disconnects its links through the host.

### How do I rename or retype a slot?

Use one atomic patch:

```js
node.outputs.get('value')?.modify({
  name: 'model',
  label: 'MODEL',
  type: 'MODEL',
  shape: 'directional'
})
```

This replaces direct writes to `slot.name`, `slot.type`, `slot.label`, and
renderer shape fields. Existing links remain attached.

### How do I reorder slots safely?

```js
node.inputs.reorder(['model', 'positive', 'negative', 'latent_image'])
```

The list must be a complete permutation. The host updates serialized endpoint
indexes while preserving which logical slots the links reach.

### How do I move links to another output?

```js
node.outputs.get('old_output')?.moveLinksTo('new_output')
```

Use this instead of disconnecting and reconnecting. It preserves link IDs,
which is required for workflow wire compatibility.

### How do I veto or observe a proposed connection?

Use `onBeforeConnect` only when the old hook can refuse:

```js
comfy.defs.extend('MyPack/StrictInput', (definition) => {
  definition.onBeforeConnect((_node, event) => {
    if (
      event.side === 'input' &&
      event.peerType &&
      !comfy.defs.isTypeCompatible(event.peerType, 'MODEL')
    ) {
      return false
    }
  })
})
```

If the old `onConnectInput` or `onConnectOutput` never returned `false`, it was
an observer. Use `onConnectionsChanged` instead.

### How do I preserve widget-backed input constraints?

A socket converted from a widget carries the declaration a connected
Primitive node should render. Read or intersect that declaration through the
input handle:

```js
const input = node.inputs.get('seed')
const current = input?.widgetConfig()

const merged = input?.mergeWidgetConfig({
  type: 'INT',
  options: { min: 0, max: 0xffffffffffff, step: 1 }
})

if (!merged) reportIncompatibleDeclarations(current)
```

`mergeWidgetConfig()` updates the declaration only when the two widget types
are compatible. It returns `undefined` and leaves the input unchanged when
they are not. For a dynamic socket that represents one of the node's widgets,
pass both `widget` and `widgetConfig` to `inputs.add()`, or apply them together
with `input.modify()`. The widget name must already exist on that node.

### How do I handle a link dropped on a node when no one slot fits?

Use `onUnplacedLink` when the node understands a bundle or pipe and can expand
one gesture into its own connections:

```js
comfy.defs.extend('MyPack/ContextPipe', (definition) => {
  definition.onUnplacedLink((node, event) => {
    if (event.type !== 'CONTEXT' || event.side !== 'output') return false

    return connectContextToPeer(node, {
      nodeId: event.peerNodeId,
      outputIndex: event.peerIndex,
      replaceExisting: event.replaceExisting
    })
  })
})
```

The callback must make the connections through slot handles and return `true`
only when it placed the link. Both ends can be offered the gesture and the
first claimant wins. This replaces a global `connectByType` patch without
changing link-routing behavior for every other node in the document.

## Widgets

### How do I read and write a widget value?

```js
const widget = node.widgets.get('seed')
const previous = widget?.getValue()
widget?.setValue(42)
```

`setValue()` replaces both a bare `widget.value = value` and the common pair
`widget.value = value; widget.callback?.(value)`. It uses the host's commit
protocol: property synchronization, host callback behavior, node change
behavior, one `change` event, and graph change tracking.

An equal value is a no-op. A programmatic write does not fire `activate`.

### How do I replace a chained `widget.callback`?

Observe values additively:

```js
const stop = widget.on('change', (value, previous) => {
  refreshPreview(value, previous)
})
```

For an action widget such as a button:

```js
node.widgets.get('refresh')?.on('activate', () => {
  refreshModels()
})
```

Do not capture, replace, or call through another callback. If old code invoked
its own handler once to initialize state, call that handler directly after
subscribing.

### How do I hide a converted widget?

```js
node.widgets.get('seed')?.setHidden(true)
```

This replaces `widget.type = 'converted-widget'` and the bookkeeping that
restored the old type and size function. Hiding and serialization are separate:
`setHidden()` retains the widget's existing saved and prompt behavior. Audit any
old `serializeValue` override separately.

### How do I add, remove, or reorder widgets?

| Legacy mutation                                     | Published API                |
| --------------------------------------------------- | ---------------------------- |
| `widgets.push(widget)`                              | `widgets.add(definition)`    |
| `widgets.splice(index, 1)`                          | `widgets.remove(name)`       |
| Move with `splice()`                                | `widgets.move(name, index)`  |
| Replace `node.widgets` with a sorted array          | `widgets.reorder(names)`     |
| Remove and insert the same widget at the same index | Usually `widget.setOption()` |

```js
node.widgets.add({ type: 'button', name: 'refresh', value: null })
node.widgets.move('refresh', 0)
node.widgets.remove('refresh')
```

`reorder()` requires every current widget name exactly once. It cannot silently
drop widgets or bypass teardown.

### How do I change widget options?

```js
widget.setOption('values', refreshedModels)
widget.setOption('min', 0)
widget.setOption('max', 100)
widget.setLabel('Model')
widget.setDisabled(true)
```

`getOptions()` returns a frozen view. Do not mutate it or remove and reinsert a
widget to make the renderer notice changes.

### How do I replace `addDOMWidget()` or `widget.inputEl`?

For a pack-owned control on one node, mount into a host-owned container:

```js
function addNotes(node) {
  let release

  return node.widgets.mount({
    name: 'notes',
    defaultValue: '',
    serialize: true,
    sendToPrompt: false,
    render(container, value) {
      const textarea = document.createElement('textarea')
      textarea.value = String(value.get())

      const onInput = () => value.set(textarea.value)
      textarea.addEventListener('input', onInput)
      const stopValue = value.onChange((next) => {
        textarea.value = String(next)
      })
      container.append(textarea)

      release = () => {
        textarea.removeEventListener('input', onInput)
        stopValue()
      }
    },
    destroy() {
      release?.()
    }
  })
}
```

The host controls mounting, zoom visibility, and removal. Clean up listeners,
timers, and observers in `destroy()`. Keep one mount per serialized legacy
widget cell unless you have proved that consolidating them preserves
`widgets_values`.

For behavior on a host-owned multiline editor, do not mount a duplicate merely
to access its element. Subscribe to `textInteraction`:

```js
widget.on('textInteraction', (event) => {
  if (event.kind === 'keydown' && event.key === 'Enter' && event.ctrlKey) {
    event.preventDefault()
    runText(event.value)
  }
})
```

### How do I replace `getCustomWidgets` for a backend input type?

Register the renderer for that type before nodes are constructed:

```js
comfy.defs.defineWidgetType('MY_PACK_COLOR', {
  defaultValue: '#ffffff',
  render(container, value, name, context) {
    const input = document.createElement('input')
    input.type = 'color'
    input.value = String(value.get())
    input.ariaLabel = name

    const onInput = () => value.set(input.value)
    input.addEventListener('input', onInput)
    container.append(input)

    const stopReady = context.onNodeReady((node) =>
      installNodeBehavior(node, input)
    )
    return () => {
      stopReady()
      input.removeEventListener('input', onInput)
      input.remove()
    }
  }
})
```

Do not add a second mounted widget for the same input. A type renderer preserves
the original positional `widgets_values` cell and keeps the input a widget
instead of turning it into a socket.

### How do I replace `widget.serializeValue`?

Classify the behavior:

| Old behavior                                | Published mechanism                                        |
| ------------------------------------------- | ---------------------------------------------------------- |
| Pack-owned widget never serializes          | Create it with `serialize: false`                          |
| Mounted value saves but is not sent         | `serialize: true`, `sendToPrompt: false`                   |
| Substitute a value for one destination      | `beforeSerialize`                                          |
| Asynchronously prepare data before queueing | `comfy.queue.guard()` followed by a normal committed value |

```js
widget.on('beforeSerialize', (event) => {
  if (event.context === 'prompt') {
    event.setSerializedValue(expandReferences(String(event.value)))
  }
})
```

The three contexts are `workflow`, `prompt`, and `embedded`. The handler is
synchronous and changes only that write, not the live value.

### How do I migrate a name-keyed `widgets_values` override?

Delete the live override. Runtime widget identity is already the widget name:

```js
node.widgets.get('seed')?.setValue(nextSeed)
```

The positional array remains the workflow wire format and is host-owned. Do
not replace it with a record, rewrite it during serialization, or mirror live
values into it.

Keep compatibility with workflows the old pack already saved. The host applies
normal positional values before `onConfigured`, and that hook also receives
the original saved node data. Read the pack's old record there, translate
renamed or retired keys, and commit the recovered values through named widget
handles. That migration is user-data compatibility; the live serialization
override is not.

```js
comfy.defs.extend('MyPack/LegacyNode', (definition) => {
  definition.onConfigured((node, saved) => {
    const legacy = saved.widgets_values
    if (!legacy || Array.isArray(legacy) || typeof legacy !== 'object') return

    for (const [oldName, value] of Object.entries(legacy)) {
      const currentName = renamedWidgets[oldName] ?? oldName
      node.widgets.get(currentName)?.setValue(value)
    }
  })
})
```

### How do I migrate a custom upload widget?

Inspect the Python input declaration first. If its options already include
`image_upload`, `animated_image_upload`, `video_upload`, or `audio_upload`, the
host supplies the chooser, upload, value commit, and preview. Remove the
duplicate frontend widget.

Do not replace it with `widgets.mount()` merely because the original used DOM.
An extra widget adds a positional `widgets_values` cell and can shift every
later value. Mount only when the pack provides behavior beyond the declared
upload contract, and preserve the original serialized-cell count.

## Drawing, geometry, and editor interaction

### How do I replace an `onDraw*` callback?

Inspect its body first.

#### It draws a small status label

Use a badge when the content belongs in node chrome rather than in an
interactive widget:

```js
const removeBadge = node.addBadge(() => ({
  text: currentStatus(node)
}))
```

The function is evaluated while drawing, so it must return quickly. Keep the
returned removal function when the badge has a shorter lifetime than the node.

#### It actually draws

Move the drawing and hit testing to a pack-owned canvas widget:

```js
const surface = node.widgets.canvas({
  name: 'status',
  height: 32,
  draw(context, [width, height], theme) {
    context.fillStyle = theme.surface
    context.fillRect(0, 0, width, height)
    context.fillStyle = theme.text
    context.fillText(currentStatus(node), 8, height / 2)
  },
  onPointerDown({ event }) {
    if (event.button === 0) openStatus(node)
  }
})

surface.redraw()
```

This renders under both the legacy renderer and Nodes 2.0. Use the supplied
theme instead of LiteGraph color constants.

#### It enforces size

Declare the constraint once:

```js
node.setSizeConstraints({
  minWidth: 280,
  minHeight: 180,
  autoHeight: true
})
```

#### It polls for state

Move the body to the event that changes the state: `widget.on('change')`,
`onPropertyChanged`, `onConnectionsChanged`, `onNodeChanged`, or
`onWorkflowLoaded`.

#### It positions DOM over the graph

Prefer a mounted widget. If the UI must remain outside the node, read
`node.getScreenRect()` and update it from `comfy.onViewportChanged()`.

### How do I replace renderer geometry constants?

| Legacy renderer data                | Published answer                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| `LiteGraph.NODE_TITLE_HEIGHT`       | Difference between `node.getBounds()` and `node.getSize()` when genuinely needed |
| Slot spacing and node position math | `node.getSlotPosition(side, index)`                                              |
| Canvas pan and scale                | `node.getScreenRect()` or `comfy.graph.pointerPosition()`                        |
| Hit test against nodes              | `comfy.graph.nodeAt(point)`                                                      |
| Theme widget colors                 | `CanvasTheme` passed to `widgets.canvas()`                                       |
| Detect a concurrent editor gesture  | `comfy.isInteracting()`                                                          |

Use the answer to the operation instead of publishing another renderer
constant.

### How do I request a repaint?

Do not port `canvas.setDirty()` or `node.setDirtyCanvas()`. Handle mutations
invalidate their own host views. For external data behind a canvas widget, call
that surface's `redraw()`.

### How do I rebuild a node-drag editing gesture?

Observe semantic movement rather than document pointer events and canvas drag
state:

```js
let gesture

const stopMove = comfy.onNodeMoved(({ node, position }) => {
  gesture = {
    dragged: node,
    target: findDropCandidate(node, position)
  }
})

const stopEnd = comfy.onNodeDragEnd((nodes) => {
  if (
    gesture?.target &&
    nodes.some((node) => comfy.sameEntity(node, gesture.dragged))
  ) {
    commitGesture(gesture.dragged, gesture.target)
  }
  gesture = undefined
})
```

`onNodeMoved` works under both renderers. It reports movement, not proof that a
person caused it, so guard mutations made by the gesture against re-entry.
`onNodeDragEnd` is Nodes 2.0 only because the legacy renderer has no published
drag-completion lifecycle. If the action must work under both renderers, design
an explicit command or button rather than pretending release is observable.

Use `comfy.isInteracting()` when the old code read several renderer flags only
to ask whether the editor was already in the middle of any gesture.

## Menus and application UI

### How do I add a node context-menu item?

```js
comfy.defs.extend('KSampler', (definition) => {
  definition.addMenuItem({
    label: (node) => (node.isPinned() ? 'Unpin' : 'Pin'),
    run(node) {
      node.setPinned(!node.isPinned())
    }
  })
})
```

This replaces `getExtraMenuOptions` and node-menu prototype patches. Entries
from multiple packs compose. Use `when`, a dynamic label, or `items` for a
submenu rather than constructing `LiteGraph.ContextMenu`.

### How do I open a menu from my own button or surface?

```js
comfy.ui.showMenu({
  event: mouseEvent,
  title: 'Output type',
  items: [
    { label: 'Image', run: () => choose('IMAGE') },
    {
      label: 'Latent',
      submenu: [{ label: 'Samples', run: () => choose('LATENT') }]
    }
  ]
})
```

The triggering `MouseEvent` gives the host an anchor. This does not add a new
hook to a host-owned canvas or slot menu; use it only when the pack owns the
gesture that asks for the menu.

### How do I replace DOM insertion into ComfyUI chrome?

| Old DOM target               | Published contribution          |
| ---------------------------- | ------------------------------- |
| Sidebar markup               | `comfy.ui.addSidebarTab()`      |
| Top-bar status text          | `comfy.ui.addTopBarBadge()`     |
| Action button                | `comfy.ui.addActionBarButton()` |
| Modal markup                 | `comfy.ui.showDialog()`         |
| Toast                        | `comfy.commands.notify()`       |
| Command palette and shortcut | `comfy.commands.register()`     |

Contributions are declarative so host layout, theme, accessibility, and
lifecycle remain host-owned.

### How do I replace extension settings?

```js
comfy.settings.declare({
  id: 'MyPack.previewQuality',
  name: 'Preview quality',
  type: 'slider',
  defaultValue: 80,
  attrs: { min: 1, max: 100, step: 1 }
})

const quality = comfy.settings.get('MyPack.previewQuality')
await comfy.settings.set('MyPack.previewQuality', 90)
```

Use `settings.onChange()` instead of polling, including for a core setting the
pack does not own. IDs must be namespaced.

### How do I set a temporary graph background?

If the old code replaced the canvas background renderer only to show an image,
write the core setting instead:

```js
const setting = 'Comfy.Canvas.BackgroundImage'
const previous = String(comfy.settings.get(setting) ?? '')

await comfy.settings.set(setting, imageUrl)

async function stopBackgroundMode() {
  await comfy.settings.set(setting, previous)
}
```

The host owns loading and drawing the image under both renderers. Preserve and
restore the user's previous value when the pack's temporary mode ends.

### How do I use host palette colors?

Resolve design tokens at the point of use:

```js
const modelLink = comfy.defs.typeColor('MODEL')
const red = comfy.defs.nodeColor('red')

if (red) {
  node.setColor(red.color)
  node.setBgColor(red.bgColor)
}
```

Use `setTypeColor(type, color)` only for a link type the pack owns; it refuses
core-owned types and returns an unsubscribe that restores the prior mapping.
`nodeColor()` returns the title, body, and group fill colors behind a palette
name. Do not cache or copy the host's internal color tables.

## Execution, previews, and backend services

### How do I replace `api.queuePrompt()` wrappers?

| Intent                                     | Published API                  |
| ------------------------------------------ | ------------------------------ |
| Queue like the Run button                  | `comfy.queue.run()`            |
| Run selected output nodes and dependencies | `comfy.queue.run({ nodes })`   |
| Synchronous final preparation              | `comfy.queue.onBeforeRun()`    |
| Asynchronous validation or confirmation    | `comfy.queue.guard()`          |
| Advance state after submission             | `comfy.queue.onAfterRun()`     |
| Observe backend validation refusal         | `comfy.queue.onRejected()`     |
| Replace one serialized widget value        | `widget.on('beforeSerialize')` |
| Change virtual prompt topology             | Frontend resolution or supply  |

Do not rebuild a prompt wrapper when only one stage is needed.

### How do I read or change auto-queue and batch settings?

Use the queue service rather than queue stores or settings IDs:

```js
const mode = comfy.queue.autoQueueMode()
const batch = comfy.queue.batchCount()

comfy.queue.setAutoQueueMode('change')
comfy.queue.setBatchCount(4)
```

The modes are `disabled`, `change`, and `instant`. Call
`disableAutoQueue()` before a self-interrupting conditional workflow so the
automatic runner does not immediately submit it again. It does not cancel the
run already in progress.

### How do I define a frontend-only or virtual node?

Replace `extends LGraphNode`, `isVirtualNode`, and prompt mutation with plain
data and pure resolution:

```js
comfy.defs.define({
  type: 'MyPack/Reroute',
  inputs: [{ name: 'in', type: '*' }],
  outputs: [{ name: 'out', type: '*' }],
  execution: 'frontend',
  resolve({ self }) {
    const input = self.input('in')
    return { out: input ? { forwardTo: input } : { omit: true } }
  }
})
```

A resolver may omit, forward one of its own inputs, or return a literal. It may
return directly or as a promise, and cannot mutate the graph or prompt. Prompt
execution awaits async resolvers concurrently with a deadline; synchronous
editor inspection treats a pending promise as unresolved.

### How do I implement “use this value everywhere” behavior?

Use a supplier rather than scanning and editing the built prompt:

```js
comfy.defs.extend('MyPack/BroadcastModel', (definition) => {
  definition.setSupply(({ self, unconnectedInputs }) => {
    const output = self.outputs.find(({ name }) => name === 'MODEL')
    if (!output) return []

    return unconnectedInputs()
      .filter(({ type }) => type === 'MODEL')
      .map((input) => ({
        from: { output: output.index },
        to: { nodeId: input.nodeId, input: input.input },
        priority: 10
      }))
  })
})
```

Supply resolution is graph-local and does not cross subgraph boundaries.
`graph.resolvedSupplies()` exposes the winning edges when a command needs to
materialize the same choices as real links.

### How do I correlate execution or preview events with a node?

```js
comfy.defs.extend('MyPack/PreviewNode', (definition) => {
  definition.onExecuted((node, result) => {
    updateResult(node, result)
  })

  definition.onPreview((node, frame) => {
    updatePreview(node, frame.url)
  })
})
```

This replaces global `b_preview`, `b_preview_with_metadata`, and module-level
“currently executing ID” correlation for a node's own frames. For global
execution UI, use `comfy.executingNode()`, `comfy.executionNode(id)`, and
`comfy.onExecutingNodeChanged()`.

### How do I read images produced by another node?

Definition callbacks are intentionally correlated only with the node type they
extend. For a command, panel, or overlay that inspects an arbitrary node, read
that node's output state directly:

```js
const images = producer.getOutputImages()
const displayed = producer.getDisplayedImageIndex()
const selectedUrl = displayed === undefined ? undefined : images[displayed]
```

The image list is a frozen URL snapshot. The displayed index is the image the
user selected or is hovering, and can be `undefined` when no image is singled
out.

### How do I replace a `graphToPrompt` wrapper used for a sidecar cache?

Trace the Python first. A wrapper that only chose a cache filename does not
require access to the built prompt:

1. Use the pack's authenticated route through `comfy.backend.fetch()` to read
   or refresh the sidecar.
2. If the backend needs connected tensors, run that node and its dependencies
   with `comfy.queue.run({ nodes: [node] })`.
3. Refresh correlated state from the definition's `onExecuted` callback and
   `comfy.backend.on('execution_cached', ...)` when the cached-result path also
   matters.
4. Use a backend hidden `UNIQUE_ID` input when simultaneous node instances need
   distinct identity.

A hidden string whose default is the same for every node is not a frontend API
gap; it is insufficient backend identity. State the simultaneous-node
limitation instead of restoring prompt mutation.

### How do I call my Python routes or receive custom messages?

```js
const response = await comfy.backend.fetch('/my-pack/models')
const stop = comfy.backend.on('my-pack-progress', (detail) => {
  updateProgress(detail)
})
```

Use `backend.fetch()` rather than plain `fetch(backend.url(...))` when the
request needs host credentials. Use `new URL('./asset.css', import.meta.url)`
for a file shipped beside the current module.

### How do I load a workflow or store pack documents?

```js
await comfy.workflow.open(parsedWorkflow)

await comfy.storage.set('MyPack.presets/portrait', JSON.stringify(preset))
const saved = await comfy.storage.get('MyPack.presets/portrait')
```

`workflow.open()` replaces `app.loadGraphData()` for an explicit user action.
`comfy.storage` replaces direct user-data APIs or `localStorage` for named
server-side presets, prompts, and templates.

### How do I apply ComfyUI filename and workflow tokens?

```js
const filename = comfy.workflow.applyTextReplacements(
  '%date:yyyy-MM-dd%_%KSampler.seed%'
)
```

This uses the active root graph and the same token language as core. It throws
when no graph is active. Do not copy the token parser or read workflow widgets
through renderer objects.

## Things not to translate

Some old code should disappear rather than acquire a new spelling:

| Legacy code                                                           | What to do                                          |
| --------------------------------------------------------------------- | --------------------------------------------------- |
| `node.type = node.type ?? undefined`                                  | Delete the defensive no-op.                         |
| `canvas.setDirty()` after a handle write                              | Delete it; the mutation invalidates its view.       |
| Restore fields saved only to undo `converted-widget`                  | Delete the workaround; use `setHidden()`.           |
| Duplicate upload widget for an input already declaring upload options | Delete it; let the host render the upload behavior. |
| Rewrite named widget values into `widgets_values`                     | Delete it; address live widgets by name.            |
| Poll inside a draw callback                                           | Subscribe to the state-changing event.              |

Other mechanisms have no sanctioned equivalent and must not be recreated with
an internal escape hatch:

- patching `LGraph`, `LGraphNode`, `LGraphCanvas`, renderer, or widget
  prototypes;
- mutating the built prompt or core workflow snapshot;
- selecting and restyling host-owned DOM with global selectors;
- publishing or consuming live internal stores and mutable link records;
- making a supplier or resolver cross a subgraph boundary;
- using a per-frame callback as a general tick.

If a user capability remains after checking the supported alternatives, name
that capability precisely as an API gap. Do not invent a plausible member or
reintroduce the old object.

## How do I document a refusal?

A refusal is an architectural decision, not shorthand for “the conversion was
hard” or “I did not find a method.” It must answer **why** the old mechanism or
requested capability is outside the published contract.

Every refusal record must include:

1. **User behavior:** what the feature does from the user's point of view.
2. **Mechanism:** the exact live object, prototype, store, DOM, prompt, or
   renderer operation the original used.
3. **Reason:** which ownership, determinism, wire-format, renderer-independence,
   scope, or lifecycle guarantee that mechanism violates.
4. **Outcome:** the supported replacement and remaining loss. State explicitly
   when the loss is nothing.
5. **Boundary:** the precise published capability or policy change that would
   make the refused remainder supportable, or why it must remain host-owned.

Keep those facts in one adjacent comment block. Use the existing terminal
markers for the outcome rather than inventing another marker:

```js
// REFUSED: replacing LGraphCanvas.prototype.prompt to change the host's
// numeric-entry behavior for every node and every pack.
// Reason: a pack would own host-global editor behavior, and callback order
// would decide which pack's replacement wins.
// RESTORED: this pack's numeric editor uses comfy.ui.prompt from its own menu.
// INOPERABLE: nothing.
// Reconsider if the host publishes a scoped numeric-editor contribution.
```

When behavior is genuinely lost, name the loss rather than softening it:

```js
// REFUSED: wrapping graphToPrompt to replace the built prompt with an implicit
// cross-product of widget values.
// Reason: execution would depend on hidden frontend code rather than the saved
// graph, and multiple wrappers would compose in load order.
// DROPPED: one queue action no longer expands into undeclared executions.
// This remains host-owned unless the graph gains a serializable fan-out node.
```

These are not valid reasons:

- “not supported”;
- “no API”;
- “renderer internals are unavailable”;
- “cannot be converted”;
- a list of removed property names without the behavior they implemented.

Those statements describe absence or effort, not a decision. If the behavior
is acceptable but the public surface is merely missing, classify it as an API
gap. If another published mechanism preserves it, convert through that
mechanism and record the refused technique only as localized rationale.

## Migration safety checklist

- Trace every `inputs`, `outputs`, `links`, `widgets`, and `properties` value to
  determine whether it is live state or serialized data.
- State the user-visible behavior before selecting a replacement.
- Preserve workflow and prompt wire format, including positional widget cells
  and link IDs.
- Use the narrowest semantic event instead of polling or draw-time work.
- Keep frontend resolvers and suppliers pure and graph-scoped.
- Use methods for handle reads and writes; do not attach arbitrary properties.
- Probe optional behavior with `comfy.supports()`.
- Verify both behavioral equivalence and the specific failure the migration is
  intended to fix.

For the detailed contracts behind these recipes, continue with
[Nodes](./nodes.md), [Graphs](./graph.md), [Slots](./slots.md),
[Widgets](./widgets.md), [Execution](./execution.md), and
[Application services](./services.md).
