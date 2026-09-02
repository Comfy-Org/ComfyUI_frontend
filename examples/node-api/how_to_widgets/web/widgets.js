/* global document */
// eslint-disable-next-line import-x/no-unresolved -- provided by the ComfyUI host
import { comfy } from '/comfy/api/v2.js'

const api = comfy.forMajor(2)

api.require('defs.define')
api.require('node.resolve')
api.require('widgets.canvas')
api.require('widgets.mount')
api.require('widgets.textInteraction')
api.require('widgets.typeContext')
api.require('serialization.control')

api.defs.defineWidgetType('HOW_TO_RATING', {
  defaultValue: 3,
  minWidth: 160,
  serialize: true,
  render(container, value, name, context) {
    const label = document.createElement('label')
    const output = document.createElement('span')
    const input = document.createElement('input')

    label.textContent = `${name}: `
    input.type = 'range'
    input.min = '1'
    input.max = '5'
    input.step = '1'
    input.value = String(value.get())
    output.textContent = input.value
    label.append(input, output)
    container.append(label)

    const onInput = () => value.set(Number(input.value))
    input.addEventListener('input', onInput)
    const stopValue = value.onChange((next) => {
      input.value = String(next)
      output.textContent = input.value
    })
    const stopReady = context.onNodeReady((node) =>
      node.addBadge(() => ({ text: `${value.get()}/5` }))
    )

    return () => {
      input.removeEventListener('input', onInput)
      stopValue()
      stopReady()
    }
  }
})

api.defs.define({
  type: 'HowTo/WidgetEvents',
  title: 'How-To: Widget Events',
  category: 'API Examples/Widgets',
  description: 'Uses additive widget activation listeners.',
  outputs: [{ name: 'count', type: 'INT' }],
  widgets: [
    {
      type: 'number',
      name: 'count',
      value: 0,
      disabled: true,
      serialize: true
    },
    { type: 'button', name: 'increment', value: null, serialize: false }
  ],
  execution: 'frontend',
  resolve: ({ self }) => ({
    count: { literal: Number(self.widgetValue('count') ?? 0) }
  }),
  onCreated(node) {
    const count = node.widgets.get('count')
    node.widgets.get('increment')?.on('activate', () => {
      count?.setValue(Number(count.getValue()) + 1)
    })
  }
})

const canvasCleanups = new Map()

api.defs.define({
  type: 'HowTo/CanvasMeter',
  title: 'How-To: Canvas Meter',
  category: 'API Examples/Widgets',
  description: 'Draws and edits a value through a canvas widget.',
  outputs: [{ name: 'amount', type: 'FLOAT' }],
  widgets: [
    {
      type: 'number',
      name: 'amount',
      value: 0.5,
      hidden: true,
      serialize: true
    }
  ],
  execution: 'frontend',
  resolve: ({ self }) => ({
    amount: { literal: Number(self.widgetValue('amount') ?? 0) }
  }),
  onCreated(node) {
    const amount = node.widgets.get('amount')
    let width = 1
    const surface = node.widgets.canvas({
      name: 'meter',
      height: 48,
      serialize: false,
      draw(context, [nextWidth, height], theme) {
        width = nextWidth
        const value = Number(amount?.getValue() ?? 0)
        context.fillStyle = theme.surface
        context.fillRect(0, 0, width, height)
        context.fillStyle = theme.border
        context.fillRect(0, 0, width * value, height)
        context.fillStyle = theme.text
        context.fillText(`${Math.round(value * 100)}%`, 8, height / 2 + 4)
      },
      onPointerDown({ x, event }) {
        event.preventDefault()
        amount?.setValue(Math.max(0, Math.min(1, x / width)))
      }
    })
    canvasCleanups.set(
      node.id,
      amount?.on('change', () => surface.redraw())
    )
  },
  onRemoved(node) {
    canvasCleanups.get(node.id)?.()
    canvasCleanups.delete(node.id)
  }
})

api.defs.define({
  type: 'HowTo/MountedSlider',
  title: 'How-To: Mounted Slider',
  category: 'API Examples/Widgets',
  description: 'Mounts an accessible DOM control with explicit teardown.',
  outputs: [{ name: 'amount', type: 'FLOAT' }],
  widgets: [
    {
      type: 'number',
      name: 'amount',
      value: 0.5,
      hidden: true,
      serialize: true
    }
  ],
  execution: 'frontend',
  resolve: ({ self }) => ({
    amount: { literal: Number(self.widgetValue('amount') ?? 0) }
  }),
  onCreated(node) {
    const amount = node.widgets.get('amount')
    let destroy
    node.widgets.mount({
      name: 'slider',
      height: 36,
      render(container) {
        const label = document.createElement('label')
        const input = document.createElement('input')
        label.textContent = 'Amount '
        input.type = 'range'
        input.min = '0'
        input.max = '1'
        input.step = '0.01'
        input.value = String(amount?.getValue() ?? 0)
        label.append(input)
        container.append(label)

        const onInput = () => amount?.setValue(Number(input.value))
        input.addEventListener('input', onInput)
        const stopValue = amount?.on('change', (next) => {
          input.value = String(next)
        })
        destroy = () => {
          input.removeEventListener('input', onInput)
          stopValue?.()
        }
      },
      destroy() {
        destroy?.()
      }
    })
  }
})

api.defs.extend('HowToTemplateText', (definition) => {
  definition.onCreated((node) => {
    node.widgets.get('text')?.on('beforeSerialize', (event) => {
      if (event.context === 'prompt') {
        event.setSerializedValue(
          api.workflow.applyTextReplacements(String(event.value))
        )
      }
    })
  })
})

api.defs.define({
  type: 'HowTo/TextInteraction',
  title: 'How-To: Text Interaction',
  category: 'API Examples/Widgets',
  description: 'Observes keyboard input in a host-owned text editor.',
  outputs: [{ name: 'text', type: 'STRING' }],
  widgets: [
    {
      type: 'text',
      name: 'text',
      value: 'Press Ctrl/Cmd+Enter',
      options: { multiline: true },
      serialize: true
    }
  ],
  execution: 'frontend',
  resolve: ({ self }) => ({
    text: { literal: String(self.widgetValue('text') ?? '') }
  }),
  onCreated(node) {
    node.widgets.get('text')?.on('textInteraction', (event) => {
      if (
        event.kind === 'keydown' &&
        event.key === 'Enter' &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault()
        api.commands.notify({
          severity: 'success',
          summary: 'Text interaction received',
          detail: event.value
        })
      }
    })
  }
})
