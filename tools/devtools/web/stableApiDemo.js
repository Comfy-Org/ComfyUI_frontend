// eslint-disable-next-line import-x/no-unresolved -- provided by the ComfyUI host
import { comfy } from '/comfy/api/v2.js'

const api = comfy.forMajor(2)

api.require('defs.define')
api.require('node.resolve')

api.defs.define({
  type: 'DEMO/ConstantText',
  title: 'DEMO Constant Text',
  category: 'DEMO',
  description: 'Supplies text to a backend node without executing itself.',
  outputs: [{ name: 'text', type: 'STRING' }],
  widgets: [
    {
      type: 'text',
      name: 'value',
      value: 'Hello from the published node API',
      serialize: true
    }
  ],
  execution: 'frontend',
  resolve: ({ self }) => ({
    text: { literal: String(self.widgetValue('value') ?? '') }
  })
})

api.defs.define({
  type: 'DEMO/Reroute',
  title: 'DEMO Reroute',
  category: 'DEMO',
  description: 'Forwards its input without becoming a backend prompt node.',
  inputs: [{ name: 'in', type: '*' }],
  outputs: [{ name: 'out', type: '*' }],
  execution: 'frontend',
  resolve: ({ self }) => {
    const input = self.input('in')
    return { out: input ? { forwardTo: input } : { omit: true } }
  }
})
