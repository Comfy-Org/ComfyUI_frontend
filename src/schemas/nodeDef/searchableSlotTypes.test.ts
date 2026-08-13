import { describe, expect, it } from 'vitest'

import { collectSearchableInputTypes } from '@/schemas/nodeDef/searchableSlotTypes'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type {
  ComfyInputsSpec,
  ComfyNodeDef,
  InputSpec
} from '@/schemas/nodeDefSchema'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

function dynamicCombo(
  options: { key: string; inputs: ComfyInputsSpec }[]
): InputSpec {
  return ['COMFY_DYNAMICCOMBO_V3', { options }]
}

function toV2(spec: InputSpec) {
  return transformInputSpecV1ToV2(spec, { name: 'input' })
}

describe('collectSearchableInputTypes', () => {
  describe('COMFY_DYNAMICCOMBO_V3', () => {
    it('resolves concrete types from option inputs', () => {
      const spec = dynamicCombo([
        { key: 'image', inputs: { required: { image: ['IMAGE', {}] } } },
        { key: 'text', inputs: { required: { prompt: ['STRING', {}] } } }
      ])

      expect(collectSearchableInputTypes(toV2(spec))).toEqual([
        'IMAGE',
        'STRING'
      ])
    })

    it('preserves types when options reuse the same input name', () => {
      const spec = dynamicCombo([
        { key: 'a', inputs: { required: { value: ['IMAGE', {}] } } },
        { key: 'b', inputs: { required: { value: ['STRING', {}] } } }
      ])

      expect(collectSearchableInputTypes(toV2(spec))).toEqual([
        'IMAGE',
        'STRING'
      ])
    })

    it('includes both required and optional inputs', () => {
      const spec = dynamicCombo([
        {
          key: 'edit',
          inputs: {
            required: { image: ['IMAGE', {}] },
            optional: { mask: ['MASK', {}] }
          }
        }
      ])

      expect(collectSearchableInputTypes(toV2(spec))).toEqual(['IMAGE', 'MASK'])
    })

    it('resolves types through a nested Autogrow input', () => {
      const spec = dynamicCombo([
        {
          key: 'images',
          inputs: {
            required: {
              images: [
                'COMFY_AUTOGROW_V3',
                { template: { input: { required: { image: ['IMAGE', {}] } } } }
              ]
            }
          }
        }
      ])

      expect(collectSearchableInputTypes(toV2(spec))).toEqual(['IMAGE'])
    })

    it('resolves types through a nested DynamicCombo', () => {
      const inner = dynamicCombo([
        { key: 'inner', inputs: { required: { latent: ['LATENT', {}] } } }
      ])
      const spec = dynamicCombo([
        { key: 'outer', inputs: { required: { mode: inner } } }
      ])

      expect(collectSearchableInputTypes(toV2(spec))).toEqual(['LATENT'])
    })

    it('resolves allowed types through a nested MatchType', () => {
      const spec = dynamicCombo([
        {
          key: 'match',
          inputs: {
            required: {
              value: [
                'COMFY_MATCHTYPE_V3',
                { template: { allowed_types: 'LATENT,MASK', template_id: 't' } }
              ]
            }
          }
        }
      ])

      expect(collectSearchableInputTypes(toV2(spec))).toEqual([
        'LATENT',
        'MASK'
      ])
    })

    it('returns no types for a malformed spec', () => {
      const spec: InputSpec = [
        'COMFY_DYNAMICCOMBO_V3',
        { options: [{ key: 'missing-inputs' }] }
      ]

      expect(collectSearchableInputTypes(toV2(spec))).toEqual([])
    })
  })
})

describe('ComfyNodeDefImpl.inputTypes', () => {
  it('exposes IMAGE for an API node whose image input is nested in DynamicCombo → Autogrow', () => {
    const def: ComfyNodeDef = {
      name: 'NanoBananaLikeNode',
      display_name: 'Nano Banana Like Node',
      category: 'api node/image',
      python_module: 'nodes',
      description: '',
      input: {
        required: {
          model: dynamicCombo([
            {
              key: 'text_to_image',
              inputs: { required: { prompt: ['STRING', {}] } }
            },
            {
              key: 'image_edit',
              inputs: {
                required: {
                  prompt: ['STRING', {}],
                  images: [
                    'COMFY_AUTOGROW_V3',
                    {
                      template: {
                        input: { required: { image: ['IMAGE', {}] } }
                      }
                    }
                  ]
                }
              }
            }
          ])
        }
      },
      output: ['IMAGE'],
      output_is_list: [false],
      output_name: ['IMAGE'],
      output_node: false
    }

    const impl = new ComfyNodeDefImpl(def)

    expect(impl.inputTypes).toContain('IMAGE')
    expect(impl.inputTypes).not.toContain('COMFY_DYNAMICCOMBO_V3')
    expect(impl.inputTypes).not.toContain('COMFY_AUTOGROW_V3')
  })
})
