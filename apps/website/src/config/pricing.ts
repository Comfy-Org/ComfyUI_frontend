import { t } from '../i18n/translations'
import { subscribeUrl } from '../data/pricingPlans'
import type { Locale, TranslationKey } from '../i18n/translations'

interface PricingTier {
  slug: string
  labelKey: TranslationKey
  priceKey: TranslationKey
  eduPriceKey: TranslationKey
}

const tiers: PricingTier[] = [
  {
    slug: 'standard',
    labelKey: 'pricing.plan.standard.label',
    priceKey: 'pricing.plan.standard.price',
    eduPriceKey: 'pricing.plan.standard.eduPrice'
  },
  {
    slug: 'creator',
    labelKey: 'pricing.plan.creator.label',
    priceKey: 'pricing.plan.creator.price',
    eduPriceKey: 'pricing.plan.creator.eduPrice'
  },
  {
    slug: 'pro',
    labelKey: 'pricing.plan.pro.label',
    priceKey: 'pricing.plan.pro.price',
    eduPriceKey: 'pricing.plan.pro.eduPrice'
  }
]

export interface PricingOffer {
  name: string
  price: string
  url: string
}

// Shared offer builder: the pricing page marks up list prices, the education
// page marks up the discounted student/educator prices. Only plain USD amounts
// become offers so the JSON-LD Offer always carries a concrete numeric price.
function offersFrom(locale: Locale, education: boolean): PricingOffer[] {
  return tiers.flatMap((tier) => {
    const priceKey = education ? tier.eduPriceKey : tier.priceKey
    const display = t(priceKey, locale).trim()
    const match = /^\$(\d+(?:\.\d+)?)$/.exec(display)
    if (!match) {
      console.warn(
        `${education ? 'educationOffers' : 'pricingOffers'}: skipping tier "${tier.slug}" (${locale}) — price "${display}" is not a plain USD amount`
      )
      return []
    }
    return [
      {
        name: t(tier.labelKey, locale),
        price: match[1],
        url: subscribeUrl(tier.slug, 'monthly')
      }
    ]
  })
}

export function pricingOffers(locale: Locale): PricingOffer[] {
  return offersFrom(locale, false)
}

export function educationOffers(locale: Locale): PricingOffer[] {
  return offersFrom(locale, true)
}
