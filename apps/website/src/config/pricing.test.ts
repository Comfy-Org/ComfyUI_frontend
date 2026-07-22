import { describe, expect, it } from 'vitest'

import { educationOffers, pricingOffers } from './pricing'

describe('educationOffers', () => {
  it('marks up the discounted education prices, not the list prices', () => {
    const edu = educationOffers('en')
    const list = pricingOffers('en')

    // Same plans in the same order, so a per-tier comparison is meaningful.
    expect(edu.map((offer) => offer.name)).toEqual(
      list.map((offer) => offer.name)
    )
    expect(edu.length).toBeGreaterThan(0)

    edu.forEach((offer, index) => {
      expect(offer.price).toMatch(/^\d+(\.\d+)?$/)
      expect(Number(offer.price)).toBeLessThan(Number(list[index].price))
    })
  })
})
