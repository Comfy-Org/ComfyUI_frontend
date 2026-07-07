import { describe, expect, it } from 'vitest'

import { resolveInputType } from './dynamicTypes'

describe('resolveInputType', () => {
  it('splits concrete comma-delimited input types', () => {
    expect(resolveInputType({ type: 'MODEL,CLIP' } as never)).toEqual([
      'MODEL',
      'CLIP'
    ])
  })

  it('resolves match-type templates from allowed types', () => {
    expect(
      resolveInputType({
        type: 'COMFY_MATCHTYPE_V3',
        template: {
          allowed_types: 'IMAGE,MASK',
          template_id: 'image'
        }
      } as never)
    ).toEqual(['IMAGE', 'MASK'])
  })

  it('returns an empty type list for invalid match-type templates', () => {
    expect(resolveInputType({ type: 'COMFY_MATCHTYPE_V3' } as never)).toEqual(
      []
    )
  })

  it('resolves autogrow templates from required and optional inputs', () => {
    expect(
      resolveInputType({
        type: 'COMFY_AUTOGROW_V3',
        template: {
          input: {
            required: {
              image: ['IMAGE', {}]
            },
            optional: {
              mask: ['MASK,IMAGE', {}]
            }
          }
        }
      } as never)
    ).toEqual(['IMAGE', 'MASK', 'IMAGE'])
  })

  it('returns an empty type list for invalid autogrow templates', () => {
    expect(resolveInputType({ type: 'COMFY_AUTOGROW_V3' } as never)).toEqual([])
  })
})
