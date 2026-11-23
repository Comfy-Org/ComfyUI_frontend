import { describe, expect, it } from 'vitest'

import type { NodeExecutionOutput } from '@comfyorg/graph-model/nodeOutput'

import { isInputPreviewOutput } from './nodeOutputUtil'

describe(isInputPreviewOutput, () => {
  const cases: {
    case: string
    expected: boolean
    output: Pick<NodeExecutionOutput, 'images'> | undefined
  }[] = [
    {
      case: 'only input images',
      expected: true,
      output: { images: [{ type: 'input' }, { type: 'input' }] }
    },
    {
      case: 'only output images',
      expected: false,
      output: { images: [{ type: 'output' }] }
    },
    {
      case: 'mixed input and output images',
      expected: false,
      output: { images: [{ type: 'input' }, { type: 'output' }] }
    },
    { case: 'no images', expected: false, output: { images: [] } },
    { case: 'no output', expected: false, output: undefined }
  ]

  it.for(cases)(
    'classifies input preview provenance of $case as $expected',
    (testCase) => {
      expect(isInputPreviewOutput(testCase.output)).toBe(testCase.expected)
    }
  )

  it('rejects a non-array images payload', () => {
    const malformedOutput = { images: { length: 1 } } as unknown as Pick<
      NodeExecutionOutput,
      'images'
    >

    expect(isInputPreviewOutput(malformedOutput)).toBe(false)
  })
})
