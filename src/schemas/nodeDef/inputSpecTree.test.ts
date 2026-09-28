import { describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { inputSpecTree, ownSlotTypes } from '@/schemas/nodeDef/inputSpecTree'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec } from '@/schemas/nodeDefSchema'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const malformedControls: {
  name: string
  spec: InputSpec
  resolve: (spec: InputSpecV2) => unknown
  optionIndex?: number
}[] = [
  {
    name: 'DynamicCombo specification',
    spec: ['COMFY_DYNAMICCOMBO_V3', {}],
    resolve: inputSpecTree
  },
  {
    name: 'DynamicCombo option',
    spec: ['COMFY_DYNAMICCOMBO_V3', { options: [{ key: 'bad' }] }],
    resolve: inputSpecTree,
    optionIndex: 0
  },
  {
    name: 'Autogrow specification',
    spec: ['COMFY_AUTOGROW_V3', { template: {} }],
    resolve: inputSpecTree
  },
  {
    name: 'MatchType specification',
    spec: ['COMFY_MATCHTYPE_V3', { template: { allowed_types: 'IMAGE' } }],
    resolve: ownSlotTypes
  }
]

describe('input specification diagnostics', () => {
  it.for(malformedControls)('reports a malformed $name', (testCase) => {
    const spec = transformInputSpecV1ToV2(testCase.spec, { name: 'input' })

    testCase.resolve(spec)

    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'error_parsing_node_input_spec',
        context: expect.objectContaining({
          controlType: spec.type,
          optionIndex: testCase.optionIndex
        })
      })
    )
  })
})
