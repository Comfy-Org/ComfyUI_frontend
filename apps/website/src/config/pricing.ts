import { t } from '../i18n/translations'
import { subscribeUrl } from '../data/pricingPlans'
import type { BillingCycle } from '../data/pricingPlans'
import type { Locale, TranslationKey } from '../i18n/translations'

interface PricingTier {
  slug: string
  labelKey: TranslationKey
  price: Record<BillingCycle, TranslationKey>
  eduPrice: Record<BillingCycle, TranslationKey>
}

const tiers: PricingTier[] = (['standard', 'creator', 'pro'] as const).map(
  (slug) => ({
    slug,
    labelKey: `pricing.plan.${slug}.label`,
    price: {
      monthly: `pricing.plan.${slug}.price`,
      yearly: `pricing.plan.${slug}.yearlyTotal`
    },
    eduPrice: {
      monthly: `pricing.plan.${slug}.eduPrice`,
      yearly: `pricing.plan.${slug}.eduYearlyTotal`
    }
  })
)

const cycles: BillingCycle[] = ['monthly', 'yearly']

export interface PricingOffer {
  name: string
  price: string
  cycle: BillingCycle
  url: string
}

function offersFrom(
  locale: Locale,
  priceKeysOf: (tier: PricingTier) => Record<BillingCycle, TranslationKey>
): PricingOffer[] {
  return tiers.flatMap((tier) =>
    cycles.flatMap((cycle) => {
      const display = t(priceKeysOf(tier)[cycle], locale).trim()
      const match = /^\$(\d+(?:\.\d+)?)$/.exec(display)
      if (!match) {
        console.warn(
          `pricingOffers: skipping tier "${tier.slug}" ${cycle} (${locale}) — price "${display}" is not a plain USD amount`
        )
        return []
      }
      return [
        {
          name: `${t(tier.labelKey, locale)} (${t(`pricing.cycle.${cycle}`, locale)})`,
          price: match[1],
          cycle,
          url: subscribeUrl(tier.slug, cycle)
        }
      ]
    })
  )
}

export function pricingOffers(locale: Locale): PricingOffer[] {
  return offersFrom(locale, (tier) => tier.price)
}

export function educationOffers(locale: Locale): PricingOffer[] {
  return offersFrom(locale, (tier) => tier.eduPrice)
}
