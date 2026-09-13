import { describe, expect, it } from 'vitest'

import { validateComfyNodeDef } from './nodeDefSchema'
import type { ComfyNodeDef } from './nodeDefSchema'

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

describe('remote_combo route validation', () => {
  function buildNodeDef(route: string): unknown {
    return {
      ...EXAMPLE_NODE_DEF,
      input: {
        required: {
          voice: [
            'COMBO',
            {
              remote_combo: {
                route,
                item_schema: { value_field: 'id', label_field: 'name' }
              }
            }
          ]
        }
      }
    }
  }

  it('accepts a relative route', () => {
    expect(validateComfyNodeDef(buildNodeDef('/voices'))).not.toBeNull()
  })

  it.each([
    'http://api.example.com/voices',
    'https://api.example.com/voices',
    'voices'
  ])('rejects a non-relative route: %s', (route) => {
    expect(validateComfyNodeDef(buildNodeDef(route), () => {})).toBeNull()
  })
})
