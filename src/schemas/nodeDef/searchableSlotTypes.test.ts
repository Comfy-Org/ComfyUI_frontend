import { describe, expect, it, vi } from 'vitest'

import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { OutputSpec as OutputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import {
  collectSearchableInputTypes,
  collectSearchableOutputTypes
} from '@/schemas/nodeDef/searchableSlotTypes'
import type { ComfyInputsSpec, InputSpec } from '@/schemas/nodeDefSchema'

function dynamicCombo(
  options: { key: string; inputs: ComfyInputsSpec }[]
): InputSpec {
  return ['COMFY_DYNAMICCOMBO_V3', { options }]
}

function autogrow(input: ComfyInputsSpec): InputSpec {
  return ['COMFY_AUTOGROW_V3', { template: { input } }]
}

function matchType(allowedTypes: string, templateId = 't'): InputSpec {
  return [
    'COMFY_MATCHTYPE_V3',
    { template: { allowed_types: allowedTypes, template_id: templateId } }
  ]
}

function toV2(spec: InputSpec, name = 'input') {
  return transformInputSpecV1ToV2(spec, { name })
}

function resolve(spec: InputSpec): string[] {
  return collectSearchableInputTypes(toV2(spec))
}

describe('collectSearchableInputTypes', () => {
  it('returns the declared type for a plain input', () => {
    expect(resolve(['IMAGE', {}])).toEqual(['IMAGE'])
  })

  describe('COMFY_DYNAMICCOMBO_V3', () => {
    it('resolves concrete types from option inputs', () => {
      expect(
        resolve(
          dynamicCombo([
            { key: 'image', inputs: { required: { image: ['IMAGE', {}] } } },
            { key: 'text', inputs: { required: { prompt: ['STRING', {}] } } }
          ])
        )
      ).toEqual(['IMAGE', 'STRING'])
    })

    it('preserves types when options reuse the same input name', () => {
      expect(
        resolve(
          dynamicCombo([
            { key: 'a', inputs: { required: { value: ['IMAGE', {}] } } },
            { key: 'b', inputs: { required: { value: ['STRING', {}] } } }
          ])
        )
      ).toEqual(['IMAGE', 'STRING'])
    })

    it('includes both required and optional inputs', () => {
      expect(
        resolve(
          dynamicCombo([
            {
              key: 'edit',
              inputs: {
                required: { image: ['IMAGE', {}] },
                optional: { mask: ['MASK', {}] }
              }
            }
          ])
        )
      ).toEqual(['IMAGE', 'MASK'])
    })

    it('resolves a legacy combo option input as COMBO', () => {
      expect(
        resolve(
          dynamicCombo([
            {
              key: 'preset',
              inputs: { required: { suboption: [['1x', '2x'], {}] } }
            }
          ])
        )
      ).toEqual(['COMBO'])
    })

    it('keeps sibling option types when one option is unparseable', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const spec: InputSpec = [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            { key: 'good', inputs: { required: { image: ['IMAGE', {}] } } },
            { key: 'bad' }
          ]
        }
      ]

      expect(collectSearchableInputTypes(toV2(spec))).toEqual(['IMAGE'])
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })

    it('warns and yields nothing for a spec with no options array', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      expect(
        collectSearchableInputTypes(toV2(['COMFY_DYNAMICCOMBO_V3', {}]))
      ).toEqual([])
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Unparseable COMFY_DYNAMICCOMBO_V3 spec'),
        expect.anything()
      )
      warn.mockRestore()
    })
  })

  describe('nesting', () => {
    it('resolves through a nested Autogrow', () => {
      expect(
        resolve(
          dynamicCombo([
            {
              key: 'images',
              inputs: {
                required: {
                  images: autogrow({ required: { image: ['IMAGE', {}] } })
                }
              }
            }
          ])
        )
      ).toEqual(['IMAGE'])
    })

    it('resolves through an Autogrow wrapping a DynamicCombo', () => {
      expect(
        resolve(
          autogrow({
            required: {
              entry: dynamicCombo([
                {
                  key: 'latent',
                  inputs: { required: { latent: ['LATENT', {}] } }
                }
              ])
            }
          })
        )
      ).toEqual(['LATENT'])
    })

    it('resolves a DynamicCombo nested three levels deep', () => {
      const innermost = dynamicCombo([
        { key: 'opt2', inputs: { optional: { mask1: ['MASK', {}] } } }
      ])
      const middle = autogrow({ required: { subcombo: innermost } })
      const outer = dynamicCombo([
        { key: 'option4', inputs: { required: { grow: middle } } }
      ])

      expect(resolve(outer)).toEqual(['MASK'])
    })

    it('resolves allowed types through a nested MatchType', () => {
      expect(
        resolve(
          dynamicCombo([
            {
              key: 'match',
              inputs: { required: { value: matchType('LATENT,MASK') } }
            }
          ])
        )
      ).toEqual(['LATENT', 'MASK'])
    })
  })

  describe('COMFY_AUTOGROW_V3', () => {
    it('warns and yields nothing when the template is malformed', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      expect(
        collectSearchableInputTypes(
          toV2(['COMFY_AUTOGROW_V3', { template: {} }])
        )
      ).toEqual([])
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Unparseable COMFY_AUTOGROW_V3 spec'),
        expect.anything()
      )
      warn.mockRestore()
    })
  })

  describe('COMFY_MATCHTYPE_V3', () => {
    it('trims whitespace so each type can match a filter value', () => {
      expect(resolve(matchType('IMAGE, MASK'))).toEqual(['IMAGE', 'MASK'])
    })

    it('warns and yields nothing when template_id is missing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const spec: InputSpec = [
        'COMFY_MATCHTYPE_V3',
        { template: { allowed_types: 'IMAGE' } }
      ]

      expect(collectSearchableInputTypes(toV2(spec))).toEqual([])
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })
})

describe('collectSearchableOutputTypes', () => {
  const outputs = (type: string): OutputSpecV2[] => [
    { index: 0, name: 'out', type, is_list: false }
  ]

  it('splits a comma separated output type', () => {
    expect(
      collectSearchableOutputTypes(outputs('IMAGE,MASK'), {}, undefined)
    ).toEqual(['IMAGE', 'MASK'])
  })

  it('resolves a MatchType output through its template group', () => {
    const inputs = { value: toV2(matchType('LATENT,MASK', 'group-a'), 'value') }

    expect(
      collectSearchableOutputTypes(outputs('COMFY_MATCHTYPE_V3'), inputs, [
        'group-a'
      ])
    ).toEqual(['LATENT', 'MASK'])
  })

  it('does not leak the placeholder when the template is unknown', () => {
    expect(
      collectSearchableOutputTypes(outputs('COMFY_MATCHTYPE_V3'), {}, [
        'missing-group'
      ])
    ).toEqual([])
  })
})
