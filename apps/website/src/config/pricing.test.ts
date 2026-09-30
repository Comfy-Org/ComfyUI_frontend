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
  it.for([
    {
      locale: 'en',
      names: ['STANDARD', 'CREATOR', 'PRO'],
      monthly: 'monthly',
      yearly: 'yearly'
    },
    {
      locale: 'zh-CN',
      names: ['标准版', '创作者版', '专业版'],
      monthly: '按月',
      yearly: '按年'
    }
  ] as const)(
    'offers each $locale plan monthly and yearly at the prices the page shows',
    ({ locale, names, monthly, yearly }) => {
      const offers = pricingOffers(locale)
      expect(
        offers.map(({ name, cycle, price }) => [name, cycle, price])
      ).toEqual([
        [`${names[0]} (${monthly})`, 'monthly', '20'],
        [`${names[0]} (${yearly})`, 'yearly', '192'],
        [`${names[1]} (${monthly})`, 'monthly', '35'],
        [`${names[1]} (${yearly})`, 'yearly', '336'],
        [`${names[2]} (${monthly})`, 'monthly', '100'],
        [`${names[2]} (${yearly})`, 'yearly', '960']
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
