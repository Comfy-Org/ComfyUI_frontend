import { t } from '../i18n/translations'
import type { Locale, TranslationKey } from '../i18n/translations'
import { externalLinks } from './routes'

interface PricingTier {
  slug: string
  labelKey: TranslationKey
  priceKey: TranslationKey
}

const tiers: PricingTier[] = [
  {
    slug: 'standard',
    labelKey: 'pricing.plan.standard.label',
    priceKey: 'pricing.plan.standard.price'
  },
  {
    slug: 'creator',
    labelKey: 'pricing.plan.creator.label',
    priceKey: 'pricing.plan.creator.price'
  },
  {
    slug: 'pro',
    labelKey: 'pricing.plan.pro.label',
    priceKey: 'pricing.plan.pro.price'
  }
]

export interface PricingOffer {
  name: string
  price: string
  url: string
}

export function pricingOffers(locale: Locale): PricingOffer[] {
  return tiers.flatMap((tier) => {
    const match = /^\$(\d+(?:\.\d+)?)$/.exec(t(tier.priceKey, locale).trim())
    if (!match) return []
    return [
      {
        name: t(tier.labelKey, locale),
        price: match[1],
        url: `${externalLinks.cloud}/cloud/subscribe?tier=${tier.slug}&cycle=monthly`
      }
    ]
  })
}
