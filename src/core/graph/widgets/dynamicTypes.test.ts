import { describe, expect, it } from 'vitest'

import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec } from '@/schemas/nodeDefSchema'

import { resolveInputType } from './dynamicTypes'

describe('resolveInputType', () => {
  it('resolves field types from a dynamic group template', () => {
    const spec = transformInputSpecV1ToV2(
      [
        'COMFY_DYNAMICGROUP_V3',
        {
          template: {
            required: { image: ['IMAGE', {}] },
            optional: { text: ['STRING', {}] }
          }
        }
      ] as InputSpec,
      { name: 'loras', isOptional: false }
    )

    expect(resolveInputType(spec)).toEqual(['IMAGE', 'STRING'])
  })

  it('resolves nested combo types inside a dynamic group template', () => {
    const spec = transformInputSpecV1ToV2(
      [
        'COMFY_DYNAMICGROUP_V3',
        {
          template: {
            required: {
              mode: [['a', 'b'], {}]
            }
          }
        }
      ] as InputSpec,
      { name: 'loras', isOptional: false }
    )

    expect(resolveInputType(spec)).toEqual(['COMBO'])
  })

  it('returns an empty list for an invalid dynamic group spec', () => {
    const spec = transformInputSpecV1ToV2(
      ['COMFY_DYNAMICGROUP_V3', { template: { required: {} } }] as InputSpec,
      { name: 'loras', isOptional: false }
    )
    spec.type = 'COMFY_DYNAMICGROUP_V3'
    spec.template = undefined as never

    expect(resolveInputType(spec)).toEqual([])
  })
})
