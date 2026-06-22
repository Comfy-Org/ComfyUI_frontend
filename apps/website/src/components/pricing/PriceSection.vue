<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { cn } from '@comfyorg/tailwind-utils'

import BrandButton from '../common/BrandButton.vue'
import PricingPlanFeatureList from './PricingPlanFeatureList.vue'
import PricingTierCard from './PricingTierCard.vue'
import { SHOW_FREE_TIER } from '../../config/features'
import { externalLinks, getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import { Component as ComponentIcon } from '@lucide/vue'
import Button from '../ui/button/Button.vue'
import Badge from '../ui/badge/Badge.vue'
import ToggleGroup from '../ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '../ui/toggle-group/ToggleGroupItem.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

function subscribeUrl(tier: string): string {
  return `${externalLinks.cloud}/cloud/subscribe?tier=${tier}&cycle=monthly`
}

interface PlanFeature {
  text: TranslationKey
  included?: boolean
}

interface PricingPlan {
  id: string
  labelKey: TranslationKey
  priceKey?: TranslationKey
  creditsKey?: TranslationKey
  estimateKey?: TranslationKey
  ctaKey: TranslationKey
  ctaHref: string
  features: PlanFeature[]
  andMoreKey?: TranslationKey
  image?: string
  isPopular?: boolean
  isEnterprise?: boolean
}

const freePlan: PricingPlan = {
  id: 'free',
  labelKey: 'pricing.plan.free.label',
  priceKey: 'pricing.plan.free.price',
  creditsKey: 'pricing.plan.free.credits',
  estimateKey: 'pricing.plan.free.estimate',
  ctaKey: 'pricing.plan.free.cta',
  ctaHref: externalLinks.cloud,
  features: [
    { text: 'pricing.plan.free.feature1' },
    { text: 'pricing.plan.free.feature2' }
  ]
}

const plans: PricingPlan[] = [
  ...(SHOW_FREE_TIER ? [freePlan] : []),
  {
    id: 'standard',
    labelKey: 'pricing.plan.standard.label',
    priceKey: 'pricing.plan.standard.price',
    creditsKey: 'pricing.plan.standard.credits',
    estimateKey: 'pricing.plan.standard.estimate',
    ctaKey: 'pricing.plan.standard.cta',
    ctaHref: subscribeUrl('standard'),
    features: [
      { text: 'pricing.feature.shortRuntime' },
      { text: 'pricing.feature.addCredits' },
      { text: 'pricing.feature.importModels', included: false },
      { text: 'pricing.feature.longRuntime', included: false }
    ]
  },
  {
    id: 'creator',
    labelKey: 'pricing.plan.creator.label',
    priceKey: 'pricing.plan.creator.price',
    creditsKey: 'pricing.plan.creator.credits',
    estimateKey: 'pricing.plan.creator.estimate',
    ctaKey: 'pricing.plan.creator.cta',
    ctaHref: subscribeUrl('creator'),
    features: [
      { text: 'pricing.feature.shortRuntime' },
      { text: 'pricing.feature.addCredits' },
      { text: 'pricing.feature.importModels' },
      { text: 'pricing.feature.longRuntime', included: false }
    ],
    isPopular: true
  },
  {
    id: 'pro',
    labelKey: 'pricing.plan.pro.label',
    priceKey: 'pricing.plan.pro.price',
    creditsKey: 'pricing.plan.pro.credits',
    estimateKey: 'pricing.plan.pro.estimate',
    ctaKey: 'pricing.plan.pro.cta',
    ctaHref: subscribeUrl('pro'),
    features: [
      { text: 'pricing.feature.shortRuntime' },
      { text: 'pricing.feature.addCredits' },
      { text: 'pricing.feature.importModels' },
      { text: 'pricing.feature.longRuntime' }
    ]
  },
  {
    id: 'enterprise',
    labelKey: 'pricing.enterprise.label',
    ctaKey: 'pricing.enterprise.cta',
    ctaHref: getRoutes(locale).cloudEnterprise,
    features: [],
    isEnterprise: true
  }
]

const standardPlans = plans.filter((p) => !p.isEnterprise)
const enterprisePlan = plans.find((p) => p.isEnterprise)!
</script>

<template>
  <section class="max-w-9xl mx-auto px-4 py-16 lg:px-20 lg:py-14">
    <!-- Header -->
    <div class="mx-auto mb-8 max-w-3xl text-center lg:mb-10">
      <h1
        class="font-formula text-4xl font-light text-primary-comfy-canvas lg:text-5xl"
      >
        {{ t('pricing.title', locale) }}
      </h1>
      <p
        class="mx-auto mt-3 max-w-xl text-base text-pretty text-primary-comfy-canvas"
      >
        {{ t('pricing.subtitle', locale) }}
      </p>
    </div>

    <div class="flex items-center justify-center">
      <ToggleGroup type="single">
        <ToggleGroupItem value="a"> A </ToggleGroupItem>
        <ToggleGroupItem value="b"> B </ToggleGroupItem>
      </ToggleGroup>
    </div>

    <!-- Desktop: dynamic grid (3 or 4 columns) / Mobile: stacked cards -->
    <div
      :class="
        cn(
          'rounded-5xl bg-transparency-white-t4 grid gap-2 p-2 max-lg:mx-auto max-lg:max-w-lg',
          standardPlans.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        )
      "
    >
      <PricingTierCard v-for="plan in standardPlans" :key="plan.id">
        <!-- Label + badge -->
        <div class="flex items-center gap-4">
          <span
            class="text-primary-comfy-yellow translate-y-0.5 text-base font-bold tracking-wider"
          >
            {{ t(plan.labelKey, locale) }}
          </span>
          <Badge v-if="plan.isPopular" variant="callout">
            {{ t('pricing.badge.popular', locale) }}</Badge
          >
        </div>

        <!-- Price -->
        <div v-if="plan.priceKey" class="mt-6 flex items-baseline gap-1">
          <span
            class="font-formula text-5xl font-light text-primary-comfy-canvas"
          >
            {{ t(plan.priceKey, locale) }}
          </span>
          <span class="text-primary-warm-white text-sm">
            {{ t('pricing.plan.period', locale) }}
          </span>
        </div>

        <!-- Features -->
        <div v-if="plan.features.length" class="mt-8">
          <PricingPlanFeatureList
            :features="plan.features"
            :and-more-key="plan.andMoreKey"
            :locale
          />
        </div>

        <!-- Credits -->
        <div v-if="plan.creditsKey" class="mt-6 flex items-center gap-2">
          <ComponentIcon class="text-primary-comfy-orange size-4 shrink-0" />
          <span class="text-primary-warm-white ppformula-text-center text-sm">
            <span class="font-extrabold">
              {{ t(plan.creditsKey, locale) }}
            </span>
            {{ t('pricing.creditsLabel', locale) }}
          </span>
        </div>

        <!-- Estimate -->
        <p v-if="plan.estimateKey" class="text-primary-warm-gray px-6 text-xs">
          {{ t(plan.estimateKey, locale) }}
        </p>

        <!-- CTA -->
        <div class="mt-8 flex self-end">
          <Button
            :href="plan.ctaHref"
            variant="outline"
            class="w-full text-center"
          >
            {{ t(plan.ctaKey, locale) }}
          </Button>
        </div>
      </PricingTierCard>
    </div>

    <!-- Enterprise section (desktop only, mobile handled in plan loop) -->
    <div
      class="bg-transparency-white-t4 rounded-5xl mt-8 hidden w-full flex-col p-2 lg:mt-8 lg:flex lg:flex-row"
    >
      <!-- Left side -->
      <div
        class="rounded-4.5xl flex w-full flex-col items-start justify-between gap-8 bg-primary-comfy-ink p-8"
      >
        <div>
          <span
            class="text-primary-comfy-yellow text-xs font-bold tracking-wider"
          >
            {{ t(enterprisePlan.labelKey, locale) }}
          </span>
          <h2
            class="mt-3 text-2xl font-light text-primary-comfy-canvas lg:text-3xl"
          >
            {{ t('pricing.enterprise.heading', locale) }}
          </h2>
          <p class="mt-3 text-sm text-primary-comfy-canvas">
            {{ t('pricing.enterprise.description', locale) }}
          </p>
        </div>
        <BrandButton :href="enterprisePlan.ctaHref" variant="outline" size="lg">
          {{ t(enterprisePlan.ctaKey, locale) }}
        </BrandButton>
      </div>
    </div>

    <!-- Footnote -->
    <p class="mt-12 text-xs text-primary-comfy-canvas/70">
      {{ t('pricing.footnote', locale) }}
    </p>
  </section>
</template>
