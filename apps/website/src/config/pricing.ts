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
    const display = t(tier.priceKey, locale).trim()
    const match = /^\$(\d+(?:\.\d+)?)$/.exec(display)
    if (!match) {
      console.warn(
        `pricingOffers: skipping tier "${tier.slug}" (${locale}) — price "${display}" is not a plain USD amount`
      )
      return []
    }
    return [
      {
        name: t(tier.labelKey, locale),
        price: match[1],
        url: `${externalLinks.cloud}/cloud/subscribe?tier=${tier.slug}&cycle=monthly`
      }
    ]
  })
}
