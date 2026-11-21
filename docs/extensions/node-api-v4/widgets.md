# Widgets

`node.widgets` lists a node's widgets in the order the node shows them. A
widget handle names a widget by its node and its name.

## Values and options

`setValue` commits as a user's edit does: the widget's callbacks run and it is
one undo step. Values are what a workflow can save: text, a finite number, a
boolean, `null`, or a plain object or list of those. `setHeight` is an undo
step too, because the node it grows is saved. Every change (`setValue`,
`setOption`, `setLabel`, `setHidden`, `setDisabled`, `setHeight`, `setLinked`,
and `reorder` and `move` on `node.widgets`) returns `true` when it applied and
`false` when the widget or its node is gone.

```ts
import { comfy } from '/comfy/api/v4.js'

const sampler = comfy.graph.nodesOfType('KSampler')[0]
const steps = sampler?.widgets.get('steps')
if (steps) {
  const current = steps.getValue()
  steps.setValue(typeof current === 'number' ? current + 5 : 20)
  steps.setOption('max', 200)
  steps.setLabel('Steps')
}
sampler?.widgets.get('denoise')?.setHidden(true)
```

## Listening

```ts
import { comfy } from '/comfy/api/v4.js'

const seed = comfy.graph.nodesOfType('KSampler')[0]?.widgets.get('seed')
const stopChange = seed?.on('change', (value, previous) => {
  console.info('seed', previous, '->', value)
})
const stopSerialize = seed?.on('beforeSerialize', (event) => {
  if (event.value === -1) event.setSerializedValue(Date.now())
})
stopChange?.()
stopSerialize?.()
```

`change` runs after a commit leaves a value other than the last commit's;
`activate` after each commit `setValue` did not make, such as a button press;
`removed` once when the widget goes. Neither `change` nor `activate` runs while
a workflow loads, an undo or redo restores it, or an import runs, and that
includes `onWorkflowLoaded` listeners. On a DOM widget (a mount, canvas,
declared type or text area) one commit by the user runs `activate` twice
(core issue #23742). `beforeSerialize` runs each time the app builds a prompt:
to queue it, and for Export, Export (API) and the share dialog. It changes only
that prompt, not the saved workflow. A listener belongs to the widget it was added to: a widget
added again under the same name, or rebuilt by undo, starts with none.

A combo's `options.values` may be a list, a function called with no
arguments, or a getter; it is read each time the combo shows its choices.

## Changing a node's widgets

Undo, redo and a reload rebuild a node from its type, then give the saved
values back. A widget the pack adds, removes or moves after the node is made
is not kept: an undo of the change puts the type's widgets back, but a redo, a
later undo or a reload does not repeat it. By default the values are given
back by position, so after a removed or moved widget they land on the wrong
widgets; with the `Comfy.Workflow.NamedValuesRestore` setting on, they are
given back by name (core issue #23744). Make such changes in the type's
`onCreated` hook, which runs for every rebuilt node too. `move` clamps an index
past the end to the end and throws for a negative one; it returns `false` for
a name the node does not have. `add` lower-cases `type`.

## Adding widgets

`add` takes a widget the editor knows how to draw. `mount` gives the pack an
element to fill with its own tools. `canvas` gives it a `<canvas>` to draw on.

```ts
import { comfy } from '/comfy/api/v4.js'

const node = comfy.graph.selection()[0]
node?.widgets.add({
  type: 'number',
  name: 'strength',
  value: 1,
  options: { min: 0, max: 2, step: 0.1 }
})

node?.widgets.mount({
  name: 'notes',
  height: 80,
  defaultValue: '',
  render(container, value) {
    const area = document.createElement('textarea')
    const current = value.get()
    area.value = typeof current === 'string' ? current : ''
    area.addEventListener('change', () => value.set(area.value))
    value.onChange((next) => {
      area.value = typeof next === 'string' ? next : ''
    })
    container.append(area)
  }
})

const meter = node?.widgets.canvas({
  name: 'meter',
  height: 24,
  draw(context, [width, height], theme) {
    context.fillStyle = theme.surface
    context.fillRect(0, 0, width, height)
    context.fillStyle = theme.text
    context.fillText('level', 4, height / 2)
  }
})
meter?.redraw()
```

A mounted value is any value a workflow can save; `null` reads back as `''`.
The value accessor belongs to its widget: once the widget is removed, `get()`
gives `undefined` and `set()` returns `false`, even if another widget later
takes the name. `set()` returns `true` when it commits.
`destroy` runs once, when the host releases the widget: it is removed, or its
node is deleted. A declared widget type's teardown, the function its `render`
returns, runs once in the same way. Both rely on the host fix #23520, which
is in `main`.
`serialize` decides whether it is saved, and follows whether `defaultValue` is
given; `sendToPrompt` decides whether it is sent, and follows `serialize`.

`height` fixes the widget's height on the litegraph canvas. On Vue nodes a DOM
widget (a mount, canvas, declared type or text area) shares the node's free
height with the others whatever its `height` or `setHeight`, which only grows
the node (core issue #23743).

## Widget types

`comfy.defs.defineWidgetType` makes every input of a data type a widget the
pack renders.

```ts
import { comfy } from '/comfy/api/v4.js'

const removeType = comfy.defs.defineWidgetType('MYPACK_COLOR', {
  defaultValue: '#ffffff',
  height: 32,
  render(container, value) {
    const picker = document.createElement('input')
    picker.type = 'color'
    const current = value.get()
    if (typeof current === 'string') picker.value = current
    picker.addEventListener('input', () => value.set(picker.value))
    container.append(picker)
    return () => picker.remove()
  }
})
console.info(typeof removeType)
```
