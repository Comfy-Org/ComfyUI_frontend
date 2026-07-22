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

describe('pricingOffers', () => {
  it('points every JSON-LD offer at the cloud pricing-table deep link', () => {
    for (const offer of pricingOffers('en')) {
      expect(offer.url).toMatch(
        /^https:\/\/cloud\.comfy\.org\/\?pricing=[a-z]+&cycle=monthly$/
      )
    }
  })
})
