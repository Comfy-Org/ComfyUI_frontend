import { describe, expect, it } from 'vitest'

import { planInteractionProbes } from '@e2e/fixtures/customNode/interactionProbe'

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
})
