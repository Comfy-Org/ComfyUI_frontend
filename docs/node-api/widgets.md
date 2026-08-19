# Widgets

Widgets are addressed by name through `node.widgets`. The API separates
ordinary value widgets, per-node mounted surfaces, per-node canvas surfaces,
and type-level widget renderers.

## Widget collections

```js
const widgets = node.widgets

widgets.length
widgets.get('seed')
widgets.at(0)
widgets.all()
widgets.names()
```

Use names whenever possible. `at(index)` is explicitly positional and becomes
stale when widgets are inserted, removed, or reordered.

All list reads are frozen snapshots. The collection itself provides mutation
operations:

```js
widgets.add({
  type: 'button',
  name: 'refresh'
})

widgets.move('refresh', 0)
widgets.reorder(['refresh', 'model', 'seed'])
widgets.remove('refresh')
```

`reorder()` requires every current name exactly once. It updates both legacy
and Nodes 2.0 render order. `add()` rejects duplicate names.

For behavior that belongs to every node of a type, prefer
`NodeDefBuilder.addWidget()` and install listeners from `onCreated`.

## Values and commits

```js
const seed = node.widgets.get('seed')
if (!seed) return

const current = seed.getValue()
seed.setValue(Number(current) + 1)
```

`setValue()` is not a bare assignment. It commits exactly as the host's user
edit protocol does:

- writes the value;
- synchronizes a property-backed widget;
- runs the host and pack callback chain;
- calls node widget-change behavior;
- fires one `change` event;
- advances graph change state.

Writing an equal value is a no-op. A programmatic commit never fires
`activate`; that event represents a user act.

## Widget events

```js
const stopChange = widget.on('change', (value, previous) => {
  updatePreview(value, previous)
})

const stopActivate = widget.on('activate', () => {
  performAction()
})

const stopRemoved = widget.on('removed', () => {
  releaseWidgetState()
})
```

| Event             | Use it for                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `change`          | A committed value changed. Receives new and old values.                                      |
| `activate`        | The user acted: clicked a button or committed a control. Programmatic writes do not fire it. |
| `removed`         | The widget left the node.                                                                    |
| `textInteraction` | Caret, input, keyboard, selection, and wheel behavior for a host-owned multiline editor.     |
| `beforeSerialize` | Synchronously replace the value for workflow, prompt, or embedded serialization.             |

Listeners are additive. Do not capture or replace `widget.callback`.

## Visibility, disabled state, labels, and options

```js
widget.setHidden(true)
widget.setDisabled(true)
widget.setLabel('Resolved model')
widget.setOption('min', 0)
widget.setOption('max', 1)
```

`setHidden()` is the replacement for assigning the special
`'converted-widget'` type. It retains the value and cascades to linked controls.
Visibility, disabled state, and serialization are independent.

Use:

- `isHidden()`;
- `isDisabled()`;
- `isSerialized()`;
- `getOptions()` for a frozen options view;
- `setOption(key, value)` for one option.

Options include common numeric bounds, combo values, read-only and multiline
flags, placeholders, presentation flags, and widget-input metadata. Do not
mutate the object returned by `getOptions()`.

## Linked widgets

Compound controls use an explicit relationship:

```js
seed.setLinked(['control_after_generate'])
const controls = seed.linked()
```

Every name passed to `setLinked()` must identify another widget on the node.
Pass an empty array to clear the relationship. Hiding the owner automatically
hides linked controls; reading `linked()` is useful when their current values
affect behavior.

## Height and layout

```js
widget.setHeight(120)
const allocated = widget.getHeight()
```

`setHeight()` pins the widget's allocation in graph units. `getHeight()` returns
the latest host allocation, or `undefined` before layout.

This differs from `MountDef.height`: the mount option gives the inner container
a height, while `WidgetHandle.setHeight()` changes how much node layout assigns
to the widget. Leave the height unpinned for an editor intended to fill spare
space.

Use `node.setSizeConstraints()` for node-level minimum, maximum, or auto-height
behavior instead of reassigning a size callback.

## Serialization

### Declared widgets

`WidgetDef.serialize` controls whether an added widget writes to the saved
workflow:

```js
definition.addWidget({
  type: 'text',
  name: 'status',
  value: '',
  disabled: true,
  serialize: false
})
```

### Destination-specific values

```js
widget.on('beforeSerialize', (event) => {
  if (event.context === 'prompt') {
    event.setSerializedValue(expandPrompt(String(event.value)))
  }
})
```

Contexts are:

- `workflow`: a workflow saved by the user;
- `prompt`: the API payload sent for execution;
- `embedded`: the workflow copy embedded into output from that prompt.

`setSerializedValue()` changes that write only. The live widget stays unchanged.
Handlers are synchronous and the last replacement wins.

## Mounting a DOM control on one node

`widgets.mount()` is the replacement for `addDOMWidget`:

```js
let stopInput

const handle = node.widgets.mount({
  name: 'strength_editor',
  defaultValue: 1,
  serialize: true,
  sendToPrompt: true,
  height: 36,
  render(container, value) {
    const input = document.createElement('input')
    input.type = 'range'
    input.min = '0'
    input.max = '2'
    input.step = '0.05'
    input.value = String(value.get())

    const onInput = () => value.set(Number(input.value))
    input.addEventListener('input', onInput)
    container.append(input)

    const stopValue = value.onChange((next) => {
      input.value = String(next)
    })
    stopInput = () => {
      input.removeEventListener('input', onInput)
      stopValue()
    }
  },
  destroy() {
    stopInput?.()
  }
})
```

The host owns mounting and removal. Release listeners, timers, observers, and
other retained resources in `destroy()`.

Mount behavior:

- `defaultValue` makes the mount value-holding; omit it for decoration;
- `serialize` defaults to `true` for a value-holding control and `false` for a
  decorative mount;
- `sendToPrompt` defaults to `serialize` and can differ for “saved but not sent”
  readouts;
- `hideOnZoom` defaults to `true`;
- `height` reserves an inner container height;
- `hidden` controls initial visibility.

The `MountedValue` accessor offers `get()`, `set(value)`, and `onChange()`.
Object defaults are cloned per node so instances do not share mutable data.

## A canvas surface owned by the widget

`widgets.canvas()` lets a pack keep canvas drawing code without drawing into the
host's shared graph canvas:

```js
let meterWidth = 1

const surface = node.widgets.canvas({
  name: 'meter',
  height: 48,
  defaultValue: 0,
  serialize: false,
  draw(context, [width, height], theme, value) {
    meterWidth = width
    const amount = Number(value?.get() ?? 0)
    context.fillStyle = theme.surface
    context.fillRect(0, 0, width, height)
    context.fillStyle = theme.text
    context.fillRect(0, 0, width * amount, height)
  },
  onPointerDown({ x, event }) {
    event.preventDefault()
    surface.widget.setValue(Math.max(0, Math.min(1, x / meterWidth)))
  }
})

surface.redraw()
```

The surface is a pack-owned DOM canvas positioned by either renderer. The host
handles backing-store scaling and supplies design-system colors on every draw.

Pointer coordinates are in the same CSS-pixel coordinate system as `draw()`.
The underlying `PointerEvent` carries buttons and modifiers. A context-menu
handler claims secondary-click behavior; without one, the node context menu
continues to work.

`CanvasHandle.widget` exposes the ordinary widget handle. Call `redraw()` when
external data used by `draw()` changes.

## Interacting with a host text editor

Do not reach for `widget.inputEl`. Subscribe to `textInteraction`:

```js
widget.on('textInteraction', (event) => {
  if (event.kind === 'keydown' && event.key === 'Enter' && event.ctrlKey) {
    event.preventDefault()
    runText(event.value)
  }

  if (event.kind === 'input') {
    updateCompletions(event.value, event.selection, event.menuEvent)
  }
})
```

All variants expose the current string, selection, a `menuEvent` for positioning
a host menu, `setValue()` with optional restored selection, and `focus()`.
Keyboard and wheel variants expose their relevant modifiers and cancellation
methods.

## Defining a widget type

Use `defs.defineWidgetType()` when a backend input type needs a renderer on
every node:

```js
const unregister = comfy.defs.defineWidgetType('MY_PACK_RATING', {
  defaultValue: 0,
  minWidth: 100,
  serialize: true,
  render(container, value, name, context) {
    const control = buildRatingControl(container, name, value.get())
    control.onChange((rating) => value.set(rating))

    const stopValue = value.onChange((rating) => control.set(rating))
    const stopReady = context.onNodeReady((node) =>
      installNodeSpecificRatingBehavior(node, control)
    )

    return () => {
      stopReady()
      stopValue()
      control.destroy()
    }
  }
})
```

This is different from `widgets.mount()`:

- `defineWidgetType()` declares presentation for an input type before its nodes
  join a graph;
- `mount()` adds one widget to one live node;
- a type-level renderer gets a `WidgetTypeContext`, and obtains a node later
  through `onNodeReady`;
- registered input types remain widgets rather than silently becoming sockets,
  which affects both workflow and prompt serialization.
