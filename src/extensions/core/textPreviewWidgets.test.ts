import { describe, expect, it, vi } from 'vitest'

import { toPreviewText } from './textPreviewWidgets'

vi.mock(import('@/scripts/app'))

describe('text preview formatting', () => {
  it.for([
    { text: ['a', 'b'], expected: 'a\n\nb' },
    { text: 'hello', expected: 'hello' },
    { text: null, expected: '' },
    { text: undefined, expected: '' },
    { text: [], expected: '' },
    { text: [null, null], expected: '' },
    { text: ['first', null, 'second'], expected: 'first\n\nsecond' },
    {
      text: ['first', 23.976, null, 'second'],
      expected: 'first\n\n23.976\n\nsecond'
    },
    { text: 23.976, expected: '23.976' }
  ])('renders $text as $expected', ({ text, expected }) => {
    expect(toPreviewText(text)).toBe(expected)
  })
})
