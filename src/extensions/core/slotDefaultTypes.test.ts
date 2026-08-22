import { describe, expect, it } from 'vitest'

import { collectRegistrableSlotTypes } from '@/extensions/core/slotDefaultTypes'
import type { ComfyNodeDef, ComfyInputsSpec } from '@/schemas/nodeDefSchema'

function nodeDef(
  input: ComfyInputsSpec,
  extra: Partial<ComfyNodeDef> = {}
): ComfyNodeDef {
  return {
    name: 'TestNode',
    display_name: 'Test Node',
    category: 'test',
    python_module: 'nodes',
    description: '',
    output: [],
    output_is_list: [],
    output_name: [],
    output_node: false,
    input,
    ...extra
  } as ComfyNodeDef
}

describe('collectRegistrableSlotTypes', () => {
  it('registers a type nested inside a DynamicCombo option', () => {
    const { inputTypes } = collectRegistrableSlotTypes(
      nodeDef({
        required: {
          model: [
            'COMFY_DYNAMICCOMBO_V3',
            {
              options: [
                {
                  key: 'text',
                  inputs: { required: { prompt: ['STRING', {}] } }
                },
                { key: 'edit', inputs: { required: { image: ['IMAGE', {}] } } }
              ]
            }
          ]
        }
      })
    )

    expect(inputTypes.has('IMAGE')).toBe(true)
    expect(inputTypes.has('COMFY_DYNAMICCOMBO_V3')).toBe(false)
  })

  it('registers a type nested inside an Autogrow template', () => {
    const { inputTypes } = collectRegistrableSlotTypes(
      nodeDef({
        required: {
          images: [
            'COMFY_AUTOGROW_V3',
            { template: { input: { required: { image: ['IMAGE', {}] } } } }
          ]
        }
      })
    )

    expect(inputTypes.has('IMAGE')).toBe(true)
    expect(inputTypes.has('COMFY_AUTOGROW_V3')).toBe(false)
  })

  it('resolves a MatchType output through its template group', () => {
    const { inputTypes, outputTypes } = collectRegistrableSlotTypes(
      nodeDef(
        {
          required: {
            value: [
              'COMFY_MATCHTYPE_V3',
              {
                template: { allowed_types: 'IMAGE,LATENT', template_id: 't1' }
              }
            ]
          }
        },
        {
          output: ['COMFY_MATCHTYPE_V3'],
          output_name: ['out'],
          output_is_list: [false],
          output_matchtypes: ['t1']
        }
      )
    )

    expect(outputTypes).toEqual(['IMAGE', 'LATENT'])
    expect(outputTypes).not.toContain('COMFY_MATCHTYPE_V3')
    expect([...inputTypes]).toEqual(['IMAGE', 'LATENT'])
  })

  it('unions allowed types across every input sharing a template', () => {
    const { outputTypes } = collectRegistrableSlotTypes(
      nodeDef(
        {
          required: {
            on_true: [
              'COMFY_MATCHTYPE_V3',
              { template: { allowed_types: 'IMAGE,LATENT', template_id: 'a' } }
            ],
            on_false: [
              'COMFY_MATCHTYPE_V3',
              { template: { allowed_types: 'MASK', template_id: 'a' } }
            ]
          }
        },
        {
          output: ['COMFY_MATCHTYPE_V3'],
          output_name: ['out'],
          output_is_list: [false],
          output_matchtypes: ['a']
        }
      )
    )

    expect(outputTypes).toEqual(['IMAGE', 'LATENT', 'MASK'])
  })

  it('skips widget-backed types unless they force a socket', () => {
    const widgetOnly = collectRegistrableSlotTypes(
      nodeDef({ required: { seed: ['INT', {}] } })
    )
    expect(widgetOnly.inputTypes.has('INT')).toBe(false)

    const forced = collectRegistrableSlotTypes(
      nodeDef({ required: { seed: ['INT', { forceInput: true }] } })
    )
    expect(forced.inputTypes.has('INT')).toBe(true)
  })

  it('does not register a legacy combo option as a socket type', () => {
    const { inputTypes } = collectRegistrableSlotTypes(
      nodeDef({ required: { ckpt: [['a.safetensors', 'b.ckpt'], {}] } })
    )

    expect(inputTypes.has('COMBO')).toBe(false)
    expect(inputTypes.size).toBe(0)
  })

  it('skips optional inputs at every depth', () => {
    const { inputTypes } = collectRegistrableSlotTypes(
      nodeDef({
        required: {
          model: [
            'COMFY_DYNAMICCOMBO_V3',
            {
              options: [
                {
                  key: 'edit',
                  inputs: {
                    required: { image: ['IMAGE', {}] },
                    optional: { mask: ['MASK', {}] }
                  }
                }
              ]
            }
          ]
        },
        optional: { extra: ['LATENT', {}] }
      })
    )

    expect(inputTypes.has('IMAGE')).toBe(true)
    expect(inputTypes.has('MASK')).toBe(false)
    expect(inputTypes.has('LATENT')).toBe(false)
  })

  it('does not throw on a malformed output type', () => {
    expect(() =>
      collectRegistrableSlotTypes(
        nodeDef({ required: {} }, {
          output: [null],
          output_name: ['out'],
          output_is_list: [false]
        } as unknown as Partial<ComfyNodeDef>)
      )
    ).not.toThrow()
  })
})
