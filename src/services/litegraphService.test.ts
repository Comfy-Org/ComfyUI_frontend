import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'

setActivePinia(createTestingPinia())

const { registerNodeDef } = useLitegraphService()

function createNodeDefV1(
  overrides: Partial<ComfyNodeDefV1> = {}
): ComfyNodeDefV1 {
  return {
    name: 'TestNode',
    display_name: 'Test Node',
    category: 'test',
    python_module: 'test',
    description: 'Test node',
    output: ['IMAGE'],
    output_is_list: [false],
    output_name: ['IMAGE'],
    output_node: false,
    input: {
      required: {}
    },
    ...overrides
  }
}

describe('addInputs ordering with forceInput', () => {
  it('should preserve declaration order when forceInput is in the middle', async () => {
    const nodeDef = createNodeDefV1({
      name: 'ForceInputMiddle',
      input: {
        required: {
          seed: ['INT', { default: 0 }],
          image: ['IMAGE', {}],
          steps: ['INT', { default: 20 }]
        }
      },
      input_order: {
        required: ['seed', 'image', 'steps']
      }
    })

    await registerNodeDef('ForceInputMiddle', nodeDef)
    const node = LiteGraph.createNode('ForceInputMiddle')!

    const inputNames = node.inputs.map((input) => input.name)
    // seed (INT widget+socket), image (pure socket), steps (INT widget+socket)
    // Before fix: image would be first because sockets were added before widgets
    // After fix: order matches declaration
    expect(inputNames).toEqual(['seed', 'image', 'steps'])
  })

  it('should preserve order with forceInput INT between widget inputs', async () => {
    const nodeDef = createNodeDefV1({
      name: 'ForceInputBetween',
      input: {
        required: {
          cfg: ['FLOAT', { default: 7.0 }],
          forced_seed: ['INT', { default: 0, forceInput: true }],
          steps: ['INT', { default: 20 }]
        }
      },
      input_order: {
        required: ['cfg', 'forced_seed', 'steps']
      }
    })

    await registerNodeDef('ForceInputBetween', nodeDef)
    const node = LiteGraph.createNode('ForceInputBetween')!

    const inputNames = node.inputs.map((input) => input.name)
    // cfg (FLOAT widget+socket), forced_seed (INT forceInput=socket only), steps (INT widget+socket)
    // Before fix: forced_seed would appear first (all sockets before all widgets)
    // After fix: declaration order preserved
    expect(inputNames).toEqual(['cfg', 'forced_seed', 'steps'])
  })

  it('should preserve order with multiple forceInput inputs interspersed', async () => {
    const nodeDef = createNodeDefV1({
      name: 'MultiForceInput',
      input: {
        required: {
          width: ['INT', { default: 512 }],
          model: ['MODEL', {}],
          height: ['INT', { default: 512 }],
          clip: ['CLIP', {}],
          steps: ['INT', { default: 20 }]
        }
      },
      input_order: {
        required: ['width', 'model', 'height', 'clip', 'steps']
      }
    })

    await registerNodeDef('MultiForceInput', nodeDef)
    const node = LiteGraph.createNode('MultiForceInput')!

    const inputNames = node.inputs.map((input) => input.name)
    // width (widget+socket), model (pure socket), height (widget+socket),
    // clip (pure socket), steps (widget+socket)
    // Before fix: [model, clip, width, height, steps]
    // After fix: [width, model, height, clip, steps]
    expect(inputNames).toEqual(['width', 'model', 'height', 'clip', 'steps'])
  })

  it('should handle all-widget inputs without changing order', async () => {
    const nodeDef = createNodeDefV1({
      name: 'AllWidgets',
      input: {
        required: {
          seed: ['INT', { default: 0 }],
          cfg: ['FLOAT', { default: 7.0 }],
          steps: ['INT', { default: 20 }]
        }
      },
      input_order: {
        required: ['seed', 'cfg', 'steps']
      }
    })

    await registerNodeDef('AllWidgets', nodeDef)
    const node = LiteGraph.createNode('AllWidgets')!

    const inputNames = node.inputs.map((input) => input.name)
    expect(inputNames).toEqual(['seed', 'cfg', 'steps'])
  })

  it('should handle all-socket inputs without changing order', async () => {
    const nodeDef = createNodeDefV1({
      name: 'AllSockets',
      input: {
        required: {
          model: ['MODEL', {}],
          clip: ['CLIP', {}],
          vae: ['VAE', {}]
        }
      },
      input_order: {
        required: ['model', 'clip', 'vae']
      }
    })

    await registerNodeDef('AllSockets', nodeDef)
    const node = LiteGraph.createNode('AllSockets')!

    const inputNames = node.inputs.map((input) => input.name)
    expect(inputNames).toEqual(['model', 'clip', 'vae'])
  })
})
