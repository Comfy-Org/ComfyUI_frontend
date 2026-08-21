import { beforeEach, describe, expect, it } from 'vitest'

import { setBackendNodeText } from '@/i18n'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const backendDef: ComfyNodeDefV1 = {
  name: 'SerializationProbe',
  display_name: 'Live Display Name',
  category: 'testing',
  python_module: 'nodes',
  description: 'Live description',
  input: { required: {} },
  output: [],
  output_name: [],
  output_node: false
}

/** Stands in for Playwright's `page.evaluate` return-value serialization. */
function crossEvaluateBoundary<T extends object>(
  value: T
): Record<string, unknown> {
  return structuredClone({ ...value }) as Record<string, unknown>
}

describe('ComfyNodeDefImpl.toSerializable', () => {
  beforeEach(() => {
    setBackendNodeText([backendDef])
  })

  it('carries resolved text across the evaluate boundary', () => {
    const crossed = crossEvaluateBoundary(
      new ComfyNodeDefImpl(backendDef).toSerializable()
    )

    expect(crossed.display_name).toBe('Live Display Name')
    expect(crossed.description).toBe('Live description')
  })

  it('is required: a bare instance loses both to the boundary', () => {
    const crossed = crossEvaluateBoundary(new ComfyNodeDefImpl(backendDef))

    expect(crossed.display_name).toBeUndefined()
    expect(crossed.description).toBeUndefined()
  })
})
