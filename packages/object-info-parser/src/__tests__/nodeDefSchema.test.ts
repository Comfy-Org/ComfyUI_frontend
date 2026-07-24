import { describe, expect, it } from 'vitest'

import {
  validateComfyNodeDef,
  zDynamicGroupInputSpec
} from '../schemas/nodeDefSchema'
import type { ComfyNodeDef } from '../schemas/nodeDefSchema'

const EXAMPLE_NODE_DEF: ComfyNodeDef = {
  input: {
    required: {
      ckpt_name: [['model1.safetensors', 'model2.ckpt'], {}]
    }
  },
  output: ['MODEL', 'CLIP', 'VAE'],
  output_is_list: [false, false, false],
  output_name: ['MODEL', 'CLIP', 'VAE'],
  name: 'CheckpointLoaderSimple',
  display_name: 'Load Checkpoint',
  description: '',
  python_module: 'nodes',
  category: 'loaders',
  output_node: false,
  experimental: false,
  deprecated: false
}

describe('validateNodeDef', () => {
  it('accepts a valid node definition', () => {
    expect(validateComfyNodeDef(EXAMPLE_NODE_DEF)).not.toBeNull()
  })

  describe.for([
    [{ ckpt_name: ['foo', { default: 1 }] }, ['foo', { default: 1 }]],
    [{ ckpt_name: ['foo', { bar: 1 }] }, ['foo', { bar: 1 }]],
    [{ ckpt_name: ['INT', { bar: 1 }] }, ['INT', { bar: 1 }]],
    [{ ckpt_name: [[1, 2, 3], { bar: 1 }] }, [[1, 2, 3], { bar: 1 }]]
  ])(
    'validateComfyNodeDef with various input spec formats',
    ([inputSpec, expected]) => {
      it(`accepts input spec format: ${JSON.stringify(inputSpec)}`, () => {
        const parsed = validateComfyNodeDef({
          ...EXAMPLE_NODE_DEF,
          input: {
            required: inputSpec
          }
        })
        expect(parsed?.input?.required?.ckpt_name).toEqual(expected)
      })
    }
  )

  describe.for([
    [{ ckpt_name: { 'model1.safetensors': 'foo' } }],
    [{ ckpt_name: ['*', ''] }],
    [{ ckpt_name: ['foo', { default: 1 }, { default: 2 }] }],
    [{ ckpt_name: ['INT', { default: '124' }] }]
  ])('validateComfyNodeDef rejects invalid input specs', (inputSpec) => {
    it(`rejects input spec format: ${JSON.stringify(inputSpec)}`, () => {
      expect(
        validateComfyNodeDef({
          ...EXAMPLE_NODE_DEF,
          input: {
            required: inputSpec
          }
        })
      ).toBeNull()
    })
  })
})

describe('zDynamicGroupInputSpec', () => {
  const template = { required: { a: ['STRING', {}] } }

  it('rejects min greater than max', () => {
    expect(
      zDynamicGroupInputSpec.safeParse([
        'COMFY_DYNAMICGROUP_V3',
        { template, min: 60, max: 50 }
      ]).success
    ).toBe(false)
  })

  it('accepts min equal to max', () => {
    expect(
      zDynamicGroupInputSpec.safeParse([
        'COMFY_DYNAMICGROUP_V3',
        { template, min: 3, max: 3 }
      ]).success
    ).toBe(true)
  })

  it('applies default min and max', () => {
    const parsed = zDynamicGroupInputSpec.parse([
      'COMFY_DYNAMICGROUP_V3',
      { template }
    ])
    expect(parsed[1].min).toBe(0)
    expect(parsed[1].max).toBe(50)
  })

  it('accepts an optional group_name', () => {
    const parsed = zDynamicGroupInputSpec.parse([
      'COMFY_DYNAMICGROUP_V3',
      { template, group_name: 'Lora' }
    ])
    expect(parsed[1].group_name).toBe('Lora')
  })
})
