// eslint-disable-next-line import-x/no-unresolved -- provided by the ComfyUI host
import { comfy } from '/comfy/api/v2.js'

const api = comfy.forMajor(2)

api.require('backend')
api.require('commands')
api.require('defs.define')
api.require('graph.selection')
api.require('node.menu')
api.require('settings')
api.require('storage')

const textResults = new Map()
const textResultCleanups = new Map()
const keyOf = (node) => `${node.graphId}:${node.id}`

api.defs.extend('HowToTextOutput', (definition) => {
  definition.onCreated((node) => {
    const key = keyOf(node)
    textResults.set(key, 'not run')
    textResultCleanups.set(
      key,
      node.addBadge(() => ({ text: textResults.get(key) ?? 'not run' }))
    )
  })
  definition.onExecuted((node, result) => {
    textResults.set(keyOf(node), result.text[0] ?? 'complete')
  })
  definition.onRemoved((node) => {
    const key = keyOf(node)
    textResultCleanups.get(key)?.()
    textResultCleanups.delete(key)
    textResults.delete(key)
  })
  definition.addMenuItem({
    label: 'Run This Node',
    run: (node) => {
      void api.queue.run({ nodes: [node] })
    }
  })
})

const openMaskEditor = async (node) => {
  if (!api.commands.has('Comfy.MaskEditor.OpenMaskEditor')) {
    api.commands.notify({
      severity: 'warn',
      summary: 'Mask editor is unavailable'
    })
    return
  }
  api.graph.select([node])
  await api.commands.run('Comfy.MaskEditor.OpenMaskEditor')
}

api.defs.extend('HowToMaskEditor', (definition) => {
  definition.onCreated((node) => {
    node.addBadge(() => ({ text: `${node.getOutputImages().length} image(s)` }))
  })
  definition.addMenuItem({
    label: 'Open Mask Editor',
    when: (node) => node.getOutputImages().length > 0,
    run: (node) => {
      void openMaskEditor(node)
    }
  })
})

api.defs.define({
  type: 'HowTo/BackendPing',
  title: 'How-To: Backend Ping',
  category: 'API Examples/Execution',
  description: 'Calls and validates a pack-owned backend route.',
  widgets: [
    { type: 'button', name: 'ping', value: null, serialize: false },
    {
      type: 'text',
      name: 'status',
      value: 'not called',
      disabled: true,
      serialize: false
    }
  ],
  execution: 'frontend',
  onCreated(node) {
    node.widgets.get('ping')?.on('activate', async () => {
      const response = await api.backend.fetch('/how-to-api/ping')
      const body = await response.json()
      const message =
        response.ok &&
        body !== null &&
        typeof body === 'object' &&
        body.ok === true &&
        typeof body.message === 'string'
          ? body.message
          : 'Invalid backend response'
      node.widgets.get('status')?.setValue(message)
      api.commands.notify({
        severity: response.ok ? 'success' : 'error',
        summary: 'Backend ping',
        detail: message
      })
    })
  }
})

const eventStatuses = new Map()

api.backend.on('how-to-api-event', (detail) => {
  if (
    detail === null ||
    typeof detail !== 'object' ||
    !('message' in detail) ||
    typeof detail.message !== 'string'
  ) {
    return
  }
  for (const widget of eventStatuses.values()) {
    widget.setValue(detail.message)
  }
})

api.defs.define({
  type: 'HowTo/BackendEvent',
  title: 'How-To: Backend Event',
  category: 'API Examples/Execution',
  description: 'Emits and validates a pack-owned backend event.',
  widgets: [
    { type: 'button', name: 'emit_event', value: null, serialize: false },
    {
      type: 'text',
      name: 'status',
      value: 'waiting',
      disabled: true,
      serialize: false
    }
  ],
  execution: 'frontend',
  onCreated(node) {
    const status = node.widgets.get('status')
    if (status) eventStatuses.set(keyOf(node), status)
    node.widgets.get('emit_event')?.on('activate', async () => {
      await api.backend.fetch('/how-to-api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Event for node ${node.id}` })
      })
    })
  },
  onRemoved(node) {
    eventStatuses.delete(keyOf(node))
  }
})

api.settings.declare({
  id: 'HowTo.ApiExamples.greeting',
  name: 'How-To example greeting',
  type: 'text',
  defaultValue: 'Hello from settings',
  category: ['API Examples', 'How-To']
})

api.commands.register({
  id: 'HowTo.ApiExamples.showGreeting',
  label: 'How-To: Show saved greeting',
  keybinding: { key: 'h', ctrl: true, shift: true },
  scope: 'canvas',
  run() {
    api.commands.notify({
      severity: 'info',
      summary: 'Saved greeting',
      detail: String(api.settings.get('HowTo.ApiExamples.greeting'))
    })
  }
})

api.defs.define({
  type: 'HowTo/SettingsStorage',
  title: 'How-To: Settings and Storage',
  category: 'API Examples/Execution',
  description: 'Uses settings, commands, and named per-user storage.',
  widgets: [
    {
      type: 'text',
      name: 'greeting',
      value: 'Hello from storage',
      serialize: true
    },
    { type: 'button', name: 'save', value: null, serialize: false },
    { type: 'button', name: 'load', value: null, serialize: false },
    { type: 'button', name: 'run_command', value: null, serialize: false }
  ],
  execution: 'frontend',
  onCreated(node) {
    const greeting = node.widgets.get('greeting')
    node.widgets.get('save')?.on('activate', async () => {
      const value = String(greeting?.getValue() ?? '')
      await api.settings.set('HowTo.ApiExamples.greeting', value)
      await api.storage.set('HowTo.ApiExamples/greeting', value)
    })
    node.widgets.get('load')?.on('activate', async () => {
      const value = await api.storage.get('HowTo.ApiExamples/greeting')
      if (value !== undefined) greeting?.setValue(value)
    })
    node.widgets.get('run_command')?.on('activate', () => {
      void api.commands.run('HowTo.ApiExamples.showGreeting')
    })
  }
})
