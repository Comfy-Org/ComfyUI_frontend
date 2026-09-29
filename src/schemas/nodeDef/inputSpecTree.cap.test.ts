import { expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { inputSpecTree, ownSlotTypes } from '@/schemas/nodeDef/inputSpecTree'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

it('reports the first 10 unique locations and suppresses the 11th', () => {
  const locations: Array<{
    spec: InputSpecV2
    resolve: (spec: InputSpecV2) => unknown
  }> = Array.from({ length: 11 }, (_, index) => {
    if (index % 3 === 0) {
      return {
        spec: transformInputSpecV1ToV2(
          ['COMFY_AUTOGROW_V3', { template: {} }],
          { name: `autogrow-${index}` }
        ),
        resolve: inputSpecTree
      }
    }

    if (index % 3 === 1) {
      return {
        spec: transformInputSpecV1ToV2(
          ['COMFY_MATCHTYPE_V3', { template: { allowed_types: 'IMAGE' } }],
          { name: `match-type-${index}` }
        ),
        resolve: ownSlotTypes
      }
    }

    return {
      spec: transformInputSpecV1ToV2(
        [
          'COMFY_DYNAMICCOMBO_V3',
          {
            options: [
              ...Array.from({ length: index }, (_, optionIndex) => ({
                key: `valid-${optionIndex}`,
                inputs: { required: {} }
              })),
              { key: `bad-${index}` }
            ]
          }
        ],
        { name: `dynamic-combo-${index}` }
      ),
      resolve: inputSpecTree
    }
  })

  for (const location of locations.slice(0, 10)) {
    location.resolve(location.spec)
  }
  expect(reportError).toHaveBeenCalledTimes(10)

  locations[10].resolve(locations[10].spec)

  expect(reportError).toHaveBeenCalledTimes(10)
})
