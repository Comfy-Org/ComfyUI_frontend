import { describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import { inputSpecTree, ownSlotTypes } from '@/schemas/nodeDef/inputSpecTree'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec } from '@/schemas/nodeDefSchema'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

interface BadSpecScenario {
  name: string
  spec: InputSpec
  resolve: (spec: InputSpecV2) => unknown
  optionIndex?: number
}

const malformedControls: BadSpecScenario[] = [
  {
    name: 'DynamicCombo specification',
    spec: ['COMFY_DYNAMICCOMBO_V3', {}],
    resolve: inputSpecTree
  },
  {
    name: 'DynamicCombo option',
    spec: [
      'COMFY_DYNAMICCOMBO_V3',
      {
        options: [{ key: 'good', inputs: { required: {} } }, { key: 'bad' }]
      }
    ],
    resolve: inputSpecTree,
    optionIndex: 1
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
    const spec = transformInputSpecV1ToV2(testCase.spec, {
      name: testCase.name
    })

    testCase.resolve(spec)

    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      new Error('Unable to parse dynamic node input specification'),
      {
        errorType: 'error_parsing_node_input_spec',
        tags: {
          failure_kind: 'degraded',
          feature_area: 'node_definition',
          operation: 'parse_input_spec',
          outcome: 'recovered'
        },
        context: {
          controlType: spec.type,
          optionIndex: testCase.optionIndex,
          issueCount: 1
        },
        level: 'warning'
      }
    )
  })

  it('reports each malformed option once without merging indexes', () => {
    const spec = transformInputSpecV1ToV2(
      [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            { key: 'good', inputs: { required: {} } },
            { key: 'bad-1' },
            { key: 'bad-2' }
          ]
        }
      ],
      { name: 'multi-option-input' }
    )

    inputSpecTree(spec)
    inputSpecTree(spec)

    expect(reportError).toHaveBeenCalledTimes(2)
    expect(
      vi.mocked(reportError).mock.calls.map(([, options]) => options.context)
    ).toEqual([
      { controlType: spec.type, optionIndex: 1, issueCount: 1 },
      { controlType: spec.type, optionIndex: 2, issueCount: 1 }
    ])
  })

  it('deduplicates a nested specification rematerialized by traversal', () => {
    const spec = transformInputSpecV1ToV2(
      [
        'COMFY_AUTOGROW_V3',
        {
          template: {
            input: {
              required: {
                nested: ['COMFY_AUTOGROW_V3', { template: {} }]
              }
            }
          }
        }
      ],
      { name: 'nested-owner' }
    )

    inputSpecTree(spec)
    inputSpecTree(spec)

    expect(reportError).toHaveBeenCalledOnce()
  })

  it('deduplicates separately allocated equivalent specifications', () => {
    const makeSpec = () =>
      transformInputSpecV1ToV2(['COMFY_AUTOGROW_V3', { template: {} }], {
        name: 'equivalent-root'
      })

    inputSpecTree(makeSpec())
    inputSpecTree(makeSpec())

    expect(reportError).toHaveBeenCalledOnce()
  })
})
