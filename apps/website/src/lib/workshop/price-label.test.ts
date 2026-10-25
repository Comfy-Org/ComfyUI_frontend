import { describe, expect, it } from 'vitest'

import { splitPriceLabel } from './price-label'

describe('splitPriceLabel', () => {
  it.for([
    ['~9.5 credits/Image', '~9.5 credits', '/Image'],
    ['8.44 credits/Run', '8.44 credits', '/Run'],
    ['2 credits x images/Run', '2 credits x images', '/Run']
  ] as const)('splits %s', ([price, amount, per]) => {
    expect(splitPriceLabel(price)).toEqual({ amount, per })
  })

  it('leaves a price that names no unit whole', () => {
    expect(splitPriceLabel('12 credits')).toEqual({ amount: '12 credits' })
  })
})
