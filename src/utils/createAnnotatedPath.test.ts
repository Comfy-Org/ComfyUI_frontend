import { describe, expect, it } from 'vitest'

import type { ResultItem } from '@/schemas/apiSchema'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'

const resultItemCases = [
  {
    item: {
      filename: 'input.png',
      subfolder: 'nested',
      type: 'input'
    },
    expected: 'nested/input.png'
  },
  {
    item: {
      filename: 'preview.png',
      subfolder: 'nested',
      type: 'temp'
    },
    expected: 'nested/preview.png [temp]'
  },
  {
    item: {
      filename: 'result.png',
      subfolder: 'nested',
      type: 'output'
    },
    expected: 'nested/result.png [output]'
  }
] satisfies { item: ResultItem; expected: string }[]

describe('createAnnotatedPath', () => {
  it.for(resultItemCases)(
    'formats $item.type ResultItem paths from their own type',
    ({ item, expected }) => {
      expect(createAnnotatedPath(item)).toBe(expected)
    }
  )
})
