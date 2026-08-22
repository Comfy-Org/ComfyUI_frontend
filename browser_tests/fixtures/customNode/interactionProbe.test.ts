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
        first: {
          inputName: 'image',
          producer: 'EmptyImage',
          producerOutput: 0
        },
        last: {
          inputName: 'text',
          producer: 'PrimitiveString',
          producerOutput: 0
        }
      }
    ])
  })

  it('leaves inputs without model-free producers unplanned', () => {
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
    ).toEqual([{ type: 'ModelNode' }])
  })
})
