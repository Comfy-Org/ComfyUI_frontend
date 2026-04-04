import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { graphToPrompt } from './executionUtil'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})

describe('graphToPrompt', () => {
  it('skips inputs with broken links instead of crashing', async () => {
    LiteGraph.registerNodeType(
      'TestSampler',
      class extends LGraphNode {
        static override title = 'TestSampler'
        constructor() {
          super('TestSampler')
          this.comfyClass = 'TestSampler'
          this.addInput('model', 'MODEL')
          this.addInput('seed', 'INT')
          this.addOutput('output', 'LATENT')
        }
      }
    )

    const graph = new LGraph()
    const node = LiteGraph.createNode('TestSampler')!
    graph.add(node)

    // Inject a broken link: input references a link ID that doesn't exist
    node.inputs[0].link = 9999

    // BUG: graphToPrompt throws InvalidLinkError instead of skipping
    // the broken input. Workflows with stale link references should
    // still be convertible to API format.
    const result = await graphToPrompt(graph)
    expect(result.output).toBeDefined()
    expect(result.output[String(node.id)]).toBeDefined()
    // Broken 'model' input should be skipped, not crash the conversion
    expect(result.output[String(node.id)].inputs).not.toHaveProperty('model')
  })
})
