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
const errorDetail = (error) =>
  error instanceof Error ? error.message : String(error)
const reportActionError = (summary, error, status) => {
  const detail = errorDetail(error)
  status?.setValue(`${summary} failed: ${detail}`)
  api.commands.notify({ severity: 'error', summary, detail })
}
const runAction = (action, onError) => {
  void action().catch(onError)
}

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
      runAction(
        () => api.queue.run({ nodes: [node] }),
        (error) => reportActionError('Run node', error)
      )
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
      runAction(
        () => openMaskEditor(node),
        (error) => reportActionError('Open mask editor', error)
      )
    }
  })
})

const pingBackend = async (node) => {
  const response = await api.backend.fetch('/how-to-api/ping')
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const body = await response.json()
  if (
    body === null ||
    typeof body !== 'object' ||
    body.ok !== true ||
    typeof body.message !== 'string'
  ) {
    throw new Error('Invalid backend response')
  }
  node.widgets.get('status')?.setValue(body.message)
  api.commands.notify({
    severity: 'success',
    summary: 'Backend ping',
    detail: body.message
  })
}

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
    const status = node.widgets.get('status')
    node.widgets.get('ping')?.on('activate', () => {
      runAction(
        () => pingBackend(node),
        (error) => reportActionError('Backend ping', error, status)
      )
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

const emitBackendEvent = async (node) => {
  const response = await api.backend.fetch('/how-to-api/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `Event for node ${node.id}` })
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
}

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
    node.widgets.get('emit_event')?.on('activate', () => {
      runAction(
        () => emitBackendEvent(node),
        (error) => reportActionError('Backend event', error, status)
      )
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

const saveGreeting = async (greeting, status) => {
  const value = String(greeting?.getValue() ?? '')
  await api.settings.set('HowTo.ApiExamples.greeting', value)
  await api.storage.set('HowTo.ApiExamples/greeting', value)
  status?.setValue('Saved')
}

const loadGreeting = async (greeting, status) => {
  const value = await api.storage.get('HowTo.ApiExamples/greeting')
  if (value !== undefined) greeting?.setValue(value)
  status?.setValue(value === undefined ? 'Nothing saved' : 'Loaded')
}

const runGreetingCommand = async (status) => {
  await api.commands.run('HowTo.ApiExamples.showGreeting')
  status?.setValue('Command completed')
}

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
    { type: 'button', name: 'run_command', value: null, serialize: false },
    {
      type: 'text',
      name: 'status',
      value: 'ready',
      disabled: true,
      serialize: false
    }
  ],
  execution: 'frontend',
  onCreated(node) {
    const greeting = node.widgets.get('greeting')
    const status = node.widgets.get('status')
    node.widgets.get('save')?.on('activate', () => {
      runAction(
        () => saveGreeting(greeting, status),
        (error) => reportActionError('Save greeting', error, status)
      )
    })
    node.widgets.get('load')?.on('activate', () => {
      runAction(
        () => loadGreeting(greeting, status),
        (error) => reportActionError('Load greeting', error, status)
      )
    })
    node.widgets.get('run_command')?.on('activate', () => {
      runAction(
        () => runGreetingCommand(status),
        (error) => reportActionError('Run greeting command', error, status)
      )
    })
  }
})
