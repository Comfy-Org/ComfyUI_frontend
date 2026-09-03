// eslint-disable-next-line import-x/no-unresolved -- provided by the ComfyUI host
import { comfy } from '/comfy/api/v2.js'

const api = comfy.forMajor(2)

api.require('defs.define')
api.require('defs.typeCompatibility')
api.require('graph.nodes')
api.require('node.connectVeto')
api.require('node.fileDrop')
api.require('node.menu')
api.require('node.resolve')
api.require('node.sizeConstraints')
api.require('slots.connect')

const lifecycleState = new Map()
const lifecycleCleanup = new Map()
const stateKey = (node) => `${node.graphId}:${node.id}`

api.defs.extend('HowTo/LifecycleBadge', (definition) => {
  definition.addMenuItem({
    label: (node) =>
      lifecycleState.get(stateKey(node)) === 'paused' ? 'Resume' : 'Pause',
    run(node) {
      const key = stateKey(node)
      const next = lifecycleState.get(key) === 'paused' ? 'ready' : 'paused'
      lifecycleState.set(key, next)
    }
  })
  definition.addMenuItem({
    label: 'Set state',
    items: [
      {
        label: 'Ready',
        run: (node) => lifecycleState.set(stateKey(node), 'ready')
      },
      {
        label: 'Paused',
        run: (node) => lifecycleState.set(stateKey(node), 'paused')
      }
    ]
  })
})

api.defs.define({
  type: 'HowTo/LifecycleBadge',
  title: 'How-To: Lifecycle Badge',
  category: 'API Examples/Graph Interaction',
  description: 'Persists pack-owned state and renders a dynamic badge.',
  execution: 'frontend',
  onConfigured(node, data) {
    const saved = data.howToState
    if (saved === 'ready' || saved === 'paused') {
      lifecycleState.set(stateKey(node), saved)
    }
  },
  onCreated(node) {
    const key = stateKey(node)
    if (!lifecycleState.has(key)) lifecycleState.set(key, 'ready')
    node.setSizeConstraints({ minWidth: 220, minHeight: 80 })
    lifecycleCleanup.set(
      key,
      node.addBadge(() => ({
        text: lifecycleState.get(key) ?? 'ready',
        onClick: () => {
          const next = lifecycleState.get(key) === 'paused' ? 'ready' : 'paused'
          lifecycleState.set(key, next)
        }
      }))
    )
  },
  onSerialize(node) {
    return { howToState: lifecycleState.get(stateKey(node)) ?? 'ready' }
  },
  onRemoved(node) {
    const key = stateKey(node)
    lifecycleCleanup.get(key)?.()
    lifecycleCleanup.delete(key)
    lifecycleState.delete(key)
  }
})

api.defs.extend('HowTo/ImageGate', (definition) => {
  definition.onBeforeConnect((_node, event) => {
    if (event.side !== 'input' || event.peerType === undefined) return
    return api.defs.isTypeCompatible(event.peerType, 'IMAGE')
  })
})

api.defs.define({
  type: 'HowTo/ImageGate',
  title: 'How-To: Image Gate',
  category: 'API Examples/Graph Interaction',
  description: 'Vetoes non-image links before forwarding its input.',
  inputs: [{ name: 'image', type: '*' }],
  outputs: [{ name: 'image', type: 'IMAGE' }],
  execution: 'frontend',
  resolve: ({ self }) => {
    const input = self.input('image')
    return { image: input ? { forwardTo: input } : { omit: true } }
  }
})

api.defs.define({
  type: 'HowTo/DropTextFile',
  title: 'How-To: Drop Text File',
  category: 'API Examples/Graph Interaction',
  description: 'Accepts a text file dropped from the browser.',
  outputs: [{ name: 'text', type: 'STRING' }],
  widgets: [
    {
      type: 'text',
      name: 'text',
      value: 'Drop a .txt file on this node',
      options: { multiline: true },
      serialize: true
    }
  ],
  execution: 'frontend',
  resolve: ({ self }) => ({
    text: { literal: String(self.widgetValue('text') ?? '') }
  }),
  onDragOver(_node, event) {
    return [...(event.dataTransfer?.files ?? [])].some((file) =>
      file.name.toLowerCase().endsWith('.txt')
    )
  },
  async onDrop(node, event) {
    const file = [...(event.dataTransfer?.files ?? [])].find((candidate) =>
      candidate.name.toLowerCase().endsWith('.txt')
    )
    if (!file) return false
    node.widgets.get('text')?.setValue(await file.text())
    node.setTitle(`How-To: ${file.name}`)
    return true
  }
})

api.defs.define({
  type: 'HowTo/GraphSource',
  title: 'How-To: Generated Source',
  category: 'API Examples/Graph Interaction/Generated',
  outputs: [{ name: 'text', type: 'STRING' }],
  widgets: [
    { type: 'text', name: 'value', value: 'Generated in one undo step' }
  ],
  execution: 'frontend',
  resolve: ({ self }) => ({
    text: { literal: String(self.widgetValue('value') ?? '') }
  })
})

api.defs.define({
  type: 'HowTo/GraphTarget',
  title: 'How-To: Generated Target',
  category: 'API Examples/Graph Interaction/Generated',
  inputs: [{ name: 'text', type: 'STRING' }],
  execution: 'frontend'
})

api.defs.define({
  type: 'HowTo/GraphBuilder',
  title: 'How-To: Graph Builder',
  category: 'API Examples/Graph Interaction',
  description: 'Creates a connected pair as one undoable graph edit.',
  widgets: [
    { type: 'button', name: 'build_pair', value: null, serialize: false },
    { type: 'button', name: 'duplicate_self', value: null, serialize: false },
    { type: 'button', name: 'repair_self', value: null, serialize: false }
  ],
  execution: 'frontend',
  onCreated(node) {
    node.widgets.get('build_pair')?.on('activate', () => {
      const { x, y } = node.getPosition()
      api.graph.batch(() => {
        const source = api.graph.add('HowTo/GraphSource', {
          position: { x: x + 320, y }
        })
        const target = api.graph.add('HowTo/GraphTarget', {
          position: { x: x + 640, y }
        })
        source.outputs.get('text')?.connectTo(target.id, 'text')
        api.graph.select([source, target])
        api.graph.centerOn(target)
      })
    })
    node.widgets.get('duplicate_self')?.on('activate', () => {
      const { x, y } = node.getPosition()
      const duplicate = api.graph.duplicate(node.id, { x: x + 40, y: y + 40 })
      if (duplicate) api.graph.select([duplicate])
    })
    node.widgets.get('repair_self')?.on('activate', () => {
      const replacement = api.graph.replace(node.id, node.type)
      if (replacement) api.graph.select([replacement])
    })
  }
})
