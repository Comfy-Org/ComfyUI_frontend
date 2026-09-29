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
  it.for(['en', 'zh-CN'] as const)(
    'offers each %s plan monthly and yearly at the prices the page shows',
    (locale) => {
      const offers = pricingOffers(locale)
      expect(offers.map(({ cycle, price }) => [cycle, price])).toEqual([
        ['monthly', '20'],
        ['yearly', '192'],
        ['monthly', '35'],
        ['yearly', '336'],
        ['monthly', '100'],
        ['yearly', '960']
      ])
    }
  )

  it('points every offer at the cloud pricing-table deep link for its cycle', () => {
    for (const offer of pricingOffers('en')) {
      expect(offer.url).toMatch(
        new RegExp(
          `^https://cloud\\.comfy\\.org/\\?pricing=[a-z]+&cycle=${offer.cycle}$`
        )
      )
    }
  })
})
