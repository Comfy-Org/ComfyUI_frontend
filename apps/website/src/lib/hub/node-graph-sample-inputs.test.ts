import { describe, expect, it } from 'vitest'

import { nodeGraphSampleWithInputs } from './node-graph-sample-inputs'

describe('nodeGraphSampleWithInputs', () => {
  it('reads the sample graph and labels its loader from the node title', async () => {
    const workflow = await nodeGraphSampleWithInputs()

    expect(workflow.inputs).toEqual([
      { media: 'image', title: 'Character image' }
    ])
  })
})
