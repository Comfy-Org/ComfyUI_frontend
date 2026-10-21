import { describe, expect, it } from 'vitest'

import { nodeGraphSampleFromGraph } from './node-graph-sample-inputs'

describe('nodeGraphSampleFromGraph', () => {
  it('reads its inputs and custom node packs from the sample graph', async () => {
    const workflow = await nodeGraphSampleFromGraph()

    expect({
      inputs: workflow.inputs,
      customNodes: workflow.customNodes
    }).toEqual({
      inputs: [{ media: 'image', title: 'Character image' }],
      customNodes: []
    })
  })
})
