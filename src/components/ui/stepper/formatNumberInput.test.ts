import { describe, expect, it } from 'vitest'

import { formatNumberInput } from './formatNumberInput'

describe('formatNumberInput', () => {
  it.for([
    { raw: '1234', cursor: 2, value: 1234, formatted: '1,234', newCursor: 3 },
    {
      raw: '-1234',
      cursor: 3,
      value: -1234,
      formatted: '-1,234',
      newCursor: 4
    },
    { raw: '00012', cursor: 5, value: 12, formatted: '12', newCursor: 2 }
  ])(
    'preserves the digit position in $raw at cursor $cursor',
    ({ raw, cursor, value, formatted, newCursor }) => {
      expect(
        formatNumberInput({
          raw,
          cursor,
          value,
          formatOptions: { useGrouping: true },
          resetCursor: false
        })
      ).toEqual({ formatted, newCursor })
    }
  )

  it('moves the cursor after the clamped digits, before a display suffix', () => {
    expect(
      formatNumberInput({
        raw: '9999',
        cursor: 1,
        value: 0.25,
        formatOptions: { style: 'percent' },
        resetCursor: true
      })
    ).toEqual({ formatted: '25%', newCursor: 2 })
  })
})
