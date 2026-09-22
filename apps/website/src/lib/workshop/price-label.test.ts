import { describe, expect, it } from 'vitest'

import { offerForEstimate, splitPriceLabel } from './price-label'

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

describe('offerForEstimate', () => {
  it.for([
    ['14.8 credits/Run', 0.07],
    ['~9.5 credits/Image', 0.05],
    ['211 credits', 1]
  ] as const)('prices %s at the published credit rate', ([estimate, price]) => {
    expect(offerForEstimate(estimate)).toEqual({
      price,
      description: estimate
    })
  })

  it.for([undefined, '', '2 credits x images/Run', 'Variable'])(
    'makes no offer from %s',
    (estimate) => {
      expect(offerForEstimate(estimate)).toBeUndefined()
    }
  )
})
