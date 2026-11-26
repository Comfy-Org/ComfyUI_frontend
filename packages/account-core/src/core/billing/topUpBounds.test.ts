import { describe, expect, it } from 'vitest'

import { servedTopUpBound } from './topUpBounds'

const fallback = { usd: 5, credits: 1055 }

describe('servedTopUpBound', () => {
  it.for([
    { cents: 1000, credits: 2110, expected: { usd: 10, credits: 2110 } },
    { cents: undefined, credits: 2110, expected: fallback },
    { cents: 1000, credits: undefined, expected: fallback },
    { cents: undefined, credits: undefined, expected: fallback }
  ])(
    'reads cents $cents and credits $credits as $expected',
    ({ cents, credits, expected }) => {
      expect(servedTopUpBound(fallback, { cents, credits })).toEqual(expected)
    }
  )
})
