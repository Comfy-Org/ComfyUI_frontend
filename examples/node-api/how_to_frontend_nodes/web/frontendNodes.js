// eslint-disable-next-line import-x/no-unresolved -- provided by the ComfyUI host
import { comfy } from '/comfy/api/v2.js'

const api = comfy.forMajor(2)

api.require('defs.define')
api.require('node.resolve')
api.require('supply.outputs')
api.require('slots.dynamic')

api.defs.define({
  type: 'HowTo/ConstantText',
  title: 'How-To: Constant Text',
  category: 'API Examples/Frontend Nodes',
  description: 'Resolves a widget value to a prompt literal.',
  outputs: [{ name: 'text', type: 'STRING' }],
  widgets: [
    {
      type: 'text',
      name: 'value',
      value: 'Hello from a frontend node',
      serialize: true
    }
  ],
  execution: 'frontend',
  resolve: ({ self }) => ({
    text: { literal: String(self.widgetValue('value') ?? '') }
  })
})

api.defs.define({
  type: 'HowTo/Reroute',
  title: 'How-To: Reroute',
  category: 'API Examples/Frontend Nodes',
  description: 'Forwards an input without appearing in the backend prompt.',
  inputs: [{ name: 'in', type: '*' }],
  outputs: [{ name: 'out', type: '*' }],
  execution: 'frontend',
  resolve: ({ self }) => {
    const input = self.input('in')
    return { out: input ? { forwardTo: input } : { omit: true } }
  }
})

api.defs.define({
  type: 'HowTo/BroadcastText',
  title: 'How-To: Broadcast Text',
  category: 'API Examples/Frontend Nodes',
  description: 'Supplies text to unconnected string inputs in the same group.',
  widgets: [
    {
      type: 'text',
      name: 'value',
      value: 'Shared prompt text',
      serialize: true
    }
  ],
  execution: 'frontend',
  supply: ({ self, unconnectedInputs }) => {
    const groupIds = new Set(self.groups.map(({ id }) => id))
    if (groupIds.size === 0) return []

    const value = String(self.widgetValue('value') ?? '')
    return unconnectedInputs()
      .filter(
        (input) =>
          input.type === 'STRING' &&
          input.nodeGroups.some(({ id }) => groupIds.has(id))
      )
      .map((input) => ({
        to: { nodeId: input.nodeId, input: input.input },
        from: { literal: value }
      }))
  }
})

api.defs.define({
  type: 'HowTo/FirstConnected',
  title: 'How-To: First Connected',
  category: 'API Examples/Frontend Nodes',
  description: 'Grows inputs and forwards the first connected one.',
  inputs: [{ name: 'input_1', type: '*' }],
  outputs: [{ name: 'out', type: '*' }],
  execution: 'frontend',
  resolve: ({ self }) => {
    const first = self.inputs.find(({ connected }) => connected)
    const input = first ? self.input(first.index) : undefined
    return { out: input ? { forwardTo: input } : { omit: true } }
  },
  onConnectionsChanged(node) {
    const last = node.inputs.at(node.inputs.length - 1)
    if (last?.isConnected) {
      node.inputs.add(`input_${node.inputs.length + 1}`, '*', {
        shape: 'optional'
      })
    }
  }
})
