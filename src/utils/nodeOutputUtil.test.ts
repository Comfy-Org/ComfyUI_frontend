import { describe, expect, it } from 'vitest'

import type { NodeExecutionOutput } from '@/schemas/apiSchema'

import { isInputPreviewOutput } from './nodeOutputUtil'

describe(isInputPreviewOutput, () => {
  const cases: {
    expected: boolean
    output: Pick<NodeExecutionOutput, 'images'> | undefined
  }[] = [
    {
      expected: true,
      output: { images: [{ type: 'input' }, { type: 'input' }] }
    },
    { expected: false, output: { images: [{ type: 'output' }] } },
    {
      expected: false,
      output: { images: [{ type: 'input' }, { type: 'output' }] }
    },
    { expected: false, output: { images: [] } },
    { expected: false, output: undefined }
  ]

  it.for(cases)('classifies input preview provenance $expected', (testCase) => {
    expect(isInputPreviewOutput(testCase.output)).toBe(testCase.expected)
  })

  it('rejects a non-array images payload', () => {
    const malformedOutput = { images: { length: 1 } } as unknown as Pick<
      NodeExecutionOutput,
      'images'
    >

    expect(isInputPreviewOutput(malformedOutput)).toBe(false)
  })
})
