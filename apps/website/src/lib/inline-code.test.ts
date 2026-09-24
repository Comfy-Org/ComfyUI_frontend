import { describe, expect, it } from 'vitest'

import { splitInlineCode } from './inline-code'

describe('splitInlineCode', () => {
  it.for([
    {
      text: 'Use `submit` to queue, or `subscribe` to wait.',
      parts: [
        { text: 'Use ', code: false },
        { text: 'submit', code: true },
        { text: ' to queue, or ', code: false },
        { text: 'subscribe', code: true },
        { text: ' to wait.', code: false }
      ]
    },
    { text: 'plain copy', parts: [{ text: 'plain copy', code: false }] },
    {
      text: 'an unpaired ` backtick',
      parts: [{ text: 'an unpaired ` backtick', code: false }]
    },
    { text: '`code`', parts: [{ text: 'code', code: true }] }
  ])('splits $text', ({ text, parts }) => {
    expect(splitInlineCode(text)).toEqual(parts)
  })
})
