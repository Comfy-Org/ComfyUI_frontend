import type { TranslationKey } from '@/i18n/translations'

import { SHOW_FREE_TIER } from '@/config/features'
import { externalLinks } from '@/config/routes'

export type BillingCycle = 'monthly' | 'yearly'

export type PlanFeatureStatus = 'included' | 'excluded' | 'coming'

interface PlanFeature {
  text: TranslationKey
  params?: Record<string, string | number>
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
  yearlyCreditsKey?: TranslationKey
  estimateKey?: TranslationKey
  yearlyEstimateKey?: TranslationKey
  ctaKey: TranslationKey
  ctaHref: (cycle: BillingCycle) => string
  featureGroups: PlanFeatureGroup[]
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
  featureGroups: [
    {
      features: [
        { text: 'pricing.plan.free.feature1' },
        { text: 'pricing.plan.free.feature2' }
      ]
    }
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
    yearlyCreditsKey: 'pricing.plan.standard.yearlyCredits',
    estimateKey: 'pricing.plan.standard.estimate',
    yearlyEstimateKey: 'pricing.plan.standard.yearlyEstimate',
    ctaKey: 'pricing.plan.standard.cta',
    ctaHref: (cycle) => subscribeUrl('standard', cycle),
    featureGroups: [
      {
        titleKey: 'pricing.plan.standard.whatsIncluded',
        features: [
          { text: 'pricing.feature.shortRuntime' },
          { text: 'pricing.feature.addCredits' }
        ]
      }
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
    yearlyCreditsKey: 'pricing.plan.creator.yearlyCredits',
    estimateKey: 'pricing.plan.creator.estimate',
    yearlyEstimateKey: 'pricing.plan.creator.yearlyEstimate',
    ctaKey: 'pricing.plan.creator.cta',
    ctaHref: (cycle) => subscribeUrl('creator', cycle),
    featureGroups: [
      {
        titleKey: 'pricing.plan.creator.everythingInStandardPlus',
        features: [{ text: 'pricing.feature.importModels' }]
      }
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
    yearlyCreditsKey: 'pricing.plan.pro.yearlyCredits',
    estimateKey: 'pricing.plan.pro.estimate',
    yearlyEstimateKey: 'pricing.plan.pro.yearlyEstimate',
    ctaKey: 'pricing.plan.pro.cta',
    ctaHref: (cycle) => subscribeUrl('pro', cycle),
    featureGroups: [
      {
        titleKey: 'pricing.plan.pro.everythingInCreatorPlus',
        features: [{ text: 'pricing.feature.longRuntime' }]
      }
    ]
  }
]

export const pricingPlans: PricingPlan[] = SHOW_FREE_TIER
  ? [freePlan, ...standardPricingPlans]
  : standardPricingPlans
