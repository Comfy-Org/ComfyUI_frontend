import { beforeEach, describe, expect, it, vi } from 'vitest'

import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { ComfyInputsSpec, InputSpec } from '@/schemas/nodeDefSchema'

vi.mock(import('@/platform/telemetry/reportError'))

function combo(inputs: ComfyInputsSpec): InputSpec {
  return ['COMFY_DYNAMICCOMBO_V3', { options: [{ key: 'choice', inputs }] }]
}

function nestedSpec(
  depth: number,
  kind: 'combo' | 'autogrow' = 'combo',
  leaf: InputSpec = ['IMAGE', {}]
): InputSpec {
  let nested = leaf
  for (let level = depth; level > 0; level--) {
    const inputs = { required: { [`level-${level}`]: nested } }
    nested =
      kind === 'combo'
        ? combo(inputs)
        : ['COMFY_AUTOGROW_V3', { template: { input: inputs } }]
  }
  return nested
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('input specification nesting limit', () => {
  it.for([
    { depth: 0, expectedLength: 1, lastName: 'root' },
    { depth: 64, expectedLength: 65, lastName: 'level-64' }
  ])('preserves a leaf at depth $depth', async ({
    depth,
    expectedLength,
    lastName
  }) => {
    const { inputSpecTree } = await import('@/schemas/nodeDef/inputSpecTree')
    const { reportError } = await import('@/platform/telemetry/reportError')
    const spec = transformInputSpecV1ToV2(nestedSpec(depth), { name: 'root' })

    const result = inputSpecTree(spec)

    expect(result).toHaveLength(expectedLength)
    expect(result.at(-1)).toMatchObject({ name: lastName, type: 'IMAGE' })
    expect(reportError).not.toHaveBeenCalled()
  })

  it('does not report an empty container exactly at the limit', async () => {
    const { inputSpecTree } = await import('@/schemas/nodeDef/inputSpecTree')
    const { reportError } = await import('@/platform/telemetry/reportError')
    const spec = transformInputSpecV1ToV2(
      nestedSpec(64, 'combo', combo({ required: {} })),
      { name: 'root' }
    )

    const result = inputSpecTree(spec)

    expect(result).toHaveLength(65)
    expect(reportError).not.toHaveBeenCalled()
  })

  it.for([
    { kind: 'combo' as const, controlType: 'COMFY_DYNAMICCOMBO_V3' },
    { kind: 'autogrow' as const, controlType: 'COMFY_AUTOGROW_V3' }
  ])('bounds a deeply nested $kind without throwing', async ({
    kind,
    controlType
  }) => {
    const { inputSpecTree } = await import('@/schemas/nodeDef/inputSpecTree')
    const { reportError } = await import('@/platform/telemetry/reportError')
    const spec = transformInputSpecV1ToV2(nestedSpec(5_000, kind), {
      name: 'root'
    })

    const result = inputSpecTree(spec)

    expect(result).toHaveLength(65)
    expect(result.at(-1)).toMatchObject({ name: 'level-64', type: controlType })
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      new Error('Node input specification exceeds the nesting limit'),
      {
        surface: 'graph',
        errorType: 'error_node_input_spec_depth_exceeded',
        tags: {
          failure_kind: 'degraded',
          feature_area: 'node_definition',
          operation: 'walk_input_spec',
          outcome: 'recovered'
        },
        context: { controlType, maxDepth: 64 },
        level: 'warning'
      }
    )
  })

  it('retains siblings after truncating a deep branch', async () => {
    const { inputSpecTree } = await import('@/schemas/nodeDef/inputSpecTree')
    const { reportError } = await import('@/platform/telemetry/reportError')
    const spec = transformInputSpecV1ToV2(
      combo({
        required: {
          deep: nestedSpec(100),
          sibling: ['IMAGE', {}]
        },
        optional: { optionalSibling: ['BOOLEAN', {}] }
      }),
      { name: 'root' }
    )

    const result = inputSpecTree(spec)

    expect(result).toHaveLength(67)
    expect(
      result.slice(-2).map(({ name, type, isOptional }) => ({
        name,
        type,
        isOptional
      }))
    ).toEqual([
      { name: 'sibling', type: 'IMAGE', isOptional: false },
      { name: 'optionalSibling', type: 'BOOLEAN', isOptional: true }
    ])
    expect(reportError).toHaveBeenCalledOnce()
  })

  it('deduplicates repeated depth warnings', async () => {
    const { inputSpecTree } = await import('@/schemas/nodeDef/inputSpecTree')
    const { reportError } = await import('@/platform/telemetry/reportError')
    const spec = transformInputSpecV1ToV2(nestedSpec(100), { name: 'root' })

    inputSpecTree(spec)
    inputSpecTree(spec)

    expect(reportError).toHaveBeenCalledOnce()
  })

  it('preserves sibling types during option discovery', async () => {
    const { dynamicComboOptionTypes } = await import(
      '@/schemas/nodeDef/inputSpecTree'
    )
    const spec = transformInputSpecV1ToV2(
      combo({
        required: {
          deep: nestedSpec(100),
          sibling: ['IMAGE', {}]
        }
      }),
      { name: 'root' }
    )

    expect(dynamicComboOptionTypes(spec)).toEqual([
      { key: 'choice', types: ['IMAGE'] }
    ])
  })
})
