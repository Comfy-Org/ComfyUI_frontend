import { describe, expect, it } from 'vitest'

import type { components } from '@/types/comfyRegistryTypes'
import { registryToFrontendV2NodeDef } from '@/utils/mapperUtil'

type RegistryNode = components['schemas']['ComfyNode']
type RegistryPack = components['schemas']['Node']

function nodeDef(over: Partial<RegistryNode> = {}): RegistryNode {
  return over as RegistryNode
}

function pack(over: Partial<RegistryPack> = {}): RegistryPack {
  return over as RegistryPack
}

describe('registryToFrontendV2NodeDef', () => {
  it('maps outputs, defaulting names to types and is_list to false', () => {
    const def = registryToFrontendV2NodeDef(
      nodeDef({
        return_types: '["INT","IMAGE"]',
        return_names: '["count",""]',
        output_is_list: [true]
      }),
      pack()
    )

    expect(def.outputs).toEqual([
      { type: 'INT', name: 'count', is_list: true, index: 0 },
      { type: 'IMAGE', name: 'IMAGE', is_list: false, index: 1 }
    ])
  })

  it('returns no outputs when return_types is empty or absent', () => {
    expect(
      registryToFrontendV2NodeDef(nodeDef({ return_types: '[]' }), pack())
        .outputs
    ).toEqual([])
    expect(registryToFrontendV2NodeDef(nodeDef(), pack()).outputs).toEqual([])
  })

  it('maps required and optional inputs into keyed specs', () => {
    const def = registryToFrontendV2NodeDef(
      nodeDef({
        input_types: JSON.stringify({
          required: { seed: ['INT', { default: 0 }] },
          optional: { label: ['STRING', {}] }
        })
      }),
      pack()
    )

    expect(def.inputs).toEqual({
      seed: { type: 'INT', name: 'seed', isOptional: false, default: 0 },
      label: { type: 'STRING', name: 'label', isOptional: true }
    })
  })

  it('returns no inputs when input_types is empty or absent', () => {
    expect(registryToFrontendV2NodeDef(nodeDef(), pack()).inputs).toEqual({})
    expect(
      registryToFrontendV2NodeDef(nodeDef({ input_types: '{}' }), pack()).inputs
    ).toEqual({})
  })

  it('applies field fallbacks for name, category, and python_module', () => {
    const def = registryToFrontendV2NodeDef(nodeDef(), pack({ id: 'pack-id' }))

    expect(def.name).toBe('Node Name')
    expect(def.display_name).toBe('Node Name')
    expect(def.category).toBe('unknown')
    expect(def.python_module).toBe('pack-id') // name absent -> falls back to id
  })

  it('prefers explicit values over fallbacks', () => {
    const def = registryToFrontendV2NodeDef(
      nodeDef({ comfy_node_name: 'KSampler', category: 'sampling' }),
      pack({ name: 'comfy-core' })
    )

    expect(def.name).toBe('KSampler')
    expect(def.category).toBe('sampling')
    expect(def.python_module).toBe('comfy-core')
  })
})
