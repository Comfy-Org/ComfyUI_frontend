import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import {
  planInteractionProbes,
  runInteractionProbeChunk
} from '@e2e/fixtures/customNode/interactionProbe'

describe('planInteractionProbes', () => {
  it('plans the first and last model-free inputs for one pack', () => {
    expect(
      planInteractionProbes(
        {
          ProbeNode: {
            input: {
              required: {
                image: ['IMAGE', {}],
                text: ['STRING', {}]
              }
            },
            output: [],
            python_module: 'custom_nodes.ExamplePack'
          },
          OtherNode: {
            input: { required: { value: ['INT', {}] } },
            output: [],
            python_module: 'custom_nodes.OtherPack'
          }
        },
        'ExamplePack'
      )
    ).toEqual([
      {
        type: 'ProbeNode',
        first: { inputName: 'image' },
        last: { inputName: 'text' }
      }
    ])
  })

  it('plans inputs whose live type may gain a model-free producer', () => {
    expect(
      planInteractionProbes(
        {
          ModelNode: {
            input: { required: { model: ['MODEL', {}] } },
            output: [],
            python_module: 'custom_nodes.ExamplePack'
          }
        },
        'ExamplePack'
      )
    ).toEqual([{ type: 'ModelNode', first: { inputName: 'model' } }])
  })

  it('records a planned node type that cannot instantiate', async () => {
    vi.stubGlobal('window', {
      __cnIdBase: 0,
      app: { graph: { last_node_id: 0 } },
      LiteGraph: { createNode: () => null }
    })

    await expect(
      runInteractionProbeChunk({
        probePlans: [{ type: 'MissingNode' }],
        producers: {}
      })
    ).resolves.toEqual({
      created: [],
      results: {},
      threw: { MissingNode: 'MissingNode did not instantiate' }
    })
  })

  it('waits for deferred node topology before probing', async () => {
    class DeferredTarget extends LGraphNode {
      override onAdded() {
        setTimeout(() => this.addInput('value', 'INT'), 0)
      }
    }
    class IntProducer extends LGraphNode {
      constructor() {
        super('IntProducer')
        this.addOutput('value', 'INT')
      }
    }
    LiteGraph.registerNodeType('test/DeferredTarget', DeferredTarget)
    LiteGraph.registerNodeType('test/IntProducer', IntProducer)
    onTestFinished(() => {
      LiteGraph.unregisterNodeType('test/DeferredTarget')
      LiteGraph.unregisterNodeType('test/IntProducer')
    })
    vi.stubGlobal('window', {
      __cnIdBase: 0,
      app: { graph: new LGraph() },
      LiteGraph
    })

    await expect(
      runInteractionProbeChunk({
        probePlans: [
          {
            type: 'test/DeferredTarget',
            first: { inputName: 'value' }
          }
        ],
        producers: {
          INT: { nodeType: 'test/IntProducer', outputIndex: 0 }
        }
      })
    ).resolves.toMatchObject({
      created: ['test/DeferredTarget'],
      results: {
        'test/DeferredTarget': {
          connectFirst: [],
          connectLast: 'SAME_AS_FIRST',
          disconnect: []
        }
      },
      threw: {}
    })
  })
})
