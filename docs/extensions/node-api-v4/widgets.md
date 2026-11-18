# Widgets

`node.widgets` lists a node's widgets in the order the node shows them. A
widget handle names a widget by its node and its name.

## Values and options

`setValue` commits as a user's edit does: the widget's callbacks run and it is
one undo step. Values are what a workflow can save: text, a finite number, a
boolean, `null`, or a plain object or list of those.

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

`change` runs after a commit changes the value; `activate` after each commit
`setValue` did not make, such as a button press; `removed` once when the widget
goes. `beforeSerialize` changes only the queued prompt, not the saved
workflow. A listener belongs to the widget it was added to: a widget added
again under the same name, or rebuilt by undo, starts with none.

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
`serialize` decides whether it is saved, and follows whether `defaultValue` is
given; `sendToPrompt` decides whether it is sent, and follows `serialize`.

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
