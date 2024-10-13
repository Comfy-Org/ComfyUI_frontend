// @ts-strict-ignore
import { ComfyNodeDef, validateComfyNodeDef } from '@/types/apiTypes'
const fs = require('fs')
const path = require('path')

const EXAMPLE_NODE_DEF: ComfyNodeDef = {
  input: {
    required: {
      ckpt_name: [['model1.safetensors', 'model2.ckpt']]
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
  it('Should accept a valid node definition', async () => {
    expect(validateComfyNodeDef(EXAMPLE_NODE_DEF)).not.toBeNull()
  })

  describe.each([
    [{ ckpt_name: 'foo' }, ['foo', {}]],
    [{ ckpt_name: ['foo'] }, ['foo', {}]],
    [{ ckpt_name: ['foo', { default: 1 }] }, ['foo', { default: 1 }]],
    // Extra input spec should be preserved
    [{ ckpt_name: ['foo', { bar: 1 }] }, ['foo', { bar: 1 }]],
    [{ ckpt_name: ['INT', { bar: 1 }] }, ['INT', { bar: 1 }]],
    [{ ckpt_name: [[1, 2, 3], { bar: 1 }] }, [[1, 2, 3], { bar: 1 }]]
  ])(
    'validateComfyNodeDef with various input spec formats',
    (inputSpec, expected) => {
      it(`should accept input spec format: ${JSON.stringify(inputSpec)}`, async () => {
        expect(
          validateComfyNodeDef({
            ...EXAMPLE_NODE_DEF,
            input: {
              required: inputSpec
            }
          }).input.required.ckpt_name
        ).toEqual(expected)
      })
    }
  )

  describe.each([
    [{ ckpt_name: { 'model1.safetensors': 'foo' } }],
    [{ ckpt_name: ['*', ''] }],
    [{ ckpt_name: ['foo', { default: 1 }, { default: 2 }] }],
    // Should reject incorrect default value type.
    [{ ckpt_name: ['INT', { default: '124' }] }]
  ])(
    'validateComfyNodeDef rejects with various input spec formats',
    (inputSpec) => {
      it(`should accept input spec format: ${JSON.stringify(inputSpec)}`, async () => {
        expect(
          validateComfyNodeDef({
            ...EXAMPLE_NODE_DEF,
            input: {
              required: inputSpec
            }
          })
        ).toBeNull()
      })
    }
  )

  it('Should accept all built-in node definitions', async () => {
    const nodeDefs = Object.values(
      JSON.parse(
        fs.readFileSync(path.resolve('./tests-ui/data/object_info.json'))
      )
    )

    for (const nodeDef of nodeDefs) {
      expect(validateComfyNodeDef(nodeDef)).not.toBeNull()
    }
  })
})
