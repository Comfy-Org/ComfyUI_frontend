import { describe, expect, it, vi } from 'vitest'

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

  it('records a planned node type that cannot instantiate', () => {
    vi.stubGlobal('window', {
      __cnIdBase: 0,
      app: { graph: { last_node_id: 0 } },
      LiteGraph: { createNode: () => null }
    })

    expect(
      runInteractionProbeChunk({
        probePlans: [{ type: 'MissingNode' }],
        producers: {}
      })
    ).toEqual({
      created: [],
      results: {},
      threw: { MissingNode: 'MissingNode did not instantiate' }
    })
  })
})
