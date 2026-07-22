import type { TranslationKey } from '../i18n/translations'

import { SHOW_FREE_TIER } from '../config/features'
import { externalLinks } from '../config/routes'

export type BillingCycle = 'monthly' | 'yearly'

export type PlanFeatureStatus = 'included' | 'excluded' | 'coming'

export interface PlanFeature {
  text: TranslationKey
  status?: PlanFeatureStatus
  highlight?: boolean
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
  eduPriceKey?: TranslationKey
  eduYearlyPriceKey?: TranslationKey
  eduYearlyTotalKey?: TranslationKey
  creditsKey?: TranslationKey
  estimateKey?: TranslationKey
  ctaKey: TranslationKey
  ctaHref: (cycle: BillingCycle) => string
  features: PlanFeature[]
  isPopular?: boolean
}

export function subscribeUrl(
  tier: string,
  cycle: BillingCycle,
  stop?: string
): string {
  const params = new URLSearchParams()
  params.set('pricing', tier)
  if (stop) params.set('stop', stop)
  params.set('cycle', cycle)
  return `${externalLinks.cloud}/?${params.toString()}`
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
    eduPriceKey: 'pricing.plan.standard.eduPrice',
    eduYearlyPriceKey: 'pricing.plan.standard.eduYearlyPrice',
    eduYearlyTotalKey: 'pricing.plan.standard.eduYearlyTotal',
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
    eduPriceKey: 'pricing.plan.creator.eduPrice',
    eduYearlyPriceKey: 'pricing.plan.creator.eduYearlyPrice',
    eduYearlyTotalKey: 'pricing.plan.creator.eduYearlyTotal',
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
    eduPriceKey: 'pricing.plan.pro.eduPrice',
    eduYearlyPriceKey: 'pricing.plan.pro.eduYearlyPrice',
    eduYearlyTotalKey: 'pricing.plan.pro.eduYearlyTotal',
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

function eduSavingsFeature(cycle: BillingCycle): PlanFeature {
  return {
    text:
      cycle === 'yearly'
        ? 'pricing.feature.educationalSavingsYearly'
        : 'pricing.feature.educationalSavings',
    highlight: true
  }
}

// In education mode, plans with education pricing lead with the highlighted
// savings row (whose discount tracks the billing cycle); every other case
// keeps the plan's own feature list unchanged.
export function planFeatures(
  plan: PricingPlan,
  education: boolean,
  cycle: BillingCycle
): PlanFeature[] {
  return education && plan.eduPriceKey
    ? [eduSavingsFeature(cycle), ...plan.features]
    : plan.features
}
