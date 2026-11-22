import { describe, expect, it } from 'vitest'

import type { NodeExecutionOutput } from '@comfyorg/api-client/executionTypes'

import { isInputPreviewOutput } from './nodeOutputUtil'

describe(isInputPreviewOutput, () => {
  const cases: {
    case: string
    expected: boolean
    output: NodeExecutionOutput | undefined
  }[] = [
    {
      case: 'only input images',
      expected: true,
      output: { images: [{ type: 'input' }, { type: 'input' }] }
    },
    {
      case: 'explicit input preview using output images',
      expected: true,
      output: { isInputPreview: true, images: [{ type: 'output' }] }
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
