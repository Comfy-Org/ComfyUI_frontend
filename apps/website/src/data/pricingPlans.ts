import type { TranslationKey } from '../i18n/translations'

import { SHOW_FREE_TIER } from '../config/features'
import { externalLinks } from '../config/routes'

export type BillingCycle = 'monthly' | 'yearly'

export type PlanFeatureStatus = 'included' | 'excluded' | 'coming'

interface PlanFeature {
  text: TranslationKey
  status?: PlanFeatureStatus
}

export interface PlanFeatureGroup {
  titleKey?: TranslationKey
  features: PlanFeature[]
}

export interface PricingPlan {
  id: string
  labelKey: TranslationKey
  priceKey?: TranslationKey
  yearlyPriceKey?: TranslationKey
  yearlyTotalKey?: TranslationKey
  creditsKey?: TranslationKey
  estimateKey?: TranslationKey
  ctaKey: TranslationKey
  ctaHref: (cycle: BillingCycle) => string
  features: PlanFeature[]
  isPopular?: boolean
}

export const subscribeUrl = (
  tier: string,
  cycle: BillingCycle,
  stop?: string
): string => {
  const params = new URLSearchParams({ tier, cycle })
  if (stop) params.set('stop', stop)
  return `${externalLinks.cloud}/cloud/subscribe?${params.toString()}`
}

const freePlan: PricingPlan = {
  id: 'free',
  labelKey: 'pricing.plan.free.label',
  priceKey: 'pricing.plan.free.price',
  creditsKey: 'pricing.plan.free.credits',
  estimateKey: 'pricing.plan.free.estimate',
  ctaKey: 'pricing.plan.free.cta',
  ctaHref: () => externalLinks.cloud,
  features: [
    { text: 'pricing.plan.free.feature1' },
    { text: 'pricing.plan.free.feature2' }
  ]
}

const standardPricingPlans: PricingPlan[] = [
  {
    id: 'standard',
    labelKey: 'pricing.plan.standard.label',
    priceKey: 'pricing.plan.standard.price',
    yearlyPriceKey: 'pricing.plan.standard.yearlyPrice',
    yearlyTotalKey: 'pricing.plan.standard.yearlyTotal',
    creditsKey: 'pricing.plan.standard.credits',
    estimateKey: 'pricing.plan.standard.estimate',
    ctaKey: 'pricing.plan.standard.cta',
    ctaHref: (cycle) => subscribeUrl('standard', cycle),
    features: [
      { text: 'pricing.feature.shortRuntime' },
      { text: 'pricing.feature.addCredits' },
      { text: 'pricing.feature.importModels', status: 'excluded' },
      { text: 'pricing.feature.longRuntime', status: 'excluded' }
    ]
  },
  {
    id: 'creator',
    labelKey: 'pricing.plan.creator.label',
    priceKey: 'pricing.plan.creator.price',
    yearlyPriceKey: 'pricing.plan.creator.yearlyPrice',
    yearlyTotalKey: 'pricing.plan.creator.yearlyTotal',
    creditsKey: 'pricing.plan.creator.credits',
    estimateKey: 'pricing.plan.creator.estimate',
    ctaKey: 'pricing.plan.creator.cta',
    ctaHref: (cycle) => subscribeUrl('creator', cycle),
    features: [
      { text: 'pricing.feature.shortRuntime' },
      { text: 'pricing.feature.addCredits' },
      { text: 'pricing.feature.importModels' },
      { text: 'pricing.feature.longRuntime', status: 'excluded' }
    ],
    isPopular: true
  },
  {
    id: 'pro',
    labelKey: 'pricing.plan.pro.label',
    priceKey: 'pricing.plan.pro.price',
    yearlyPriceKey: 'pricing.plan.pro.yearlyPrice',
    yearlyTotalKey: 'pricing.plan.pro.yearlyTotal',
    creditsKey: 'pricing.plan.pro.credits',
    estimateKey: 'pricing.plan.pro.estimate',
    ctaKey: 'pricing.plan.pro.cta',
    ctaHref: (cycle) => subscribeUrl('pro', cycle),
    features: [
      { text: 'pricing.feature.shortRuntime' },
      { text: 'pricing.feature.addCredits' },
      { text: 'pricing.feature.importModels' },
      { text: 'pricing.feature.longRuntime' }
    ]
  }
]

export const pricingPlans: PricingPlan[] = SHOW_FREE_TIER
  ? [freePlan, ...standardPricingPlans]
  : standardPricingPlans
