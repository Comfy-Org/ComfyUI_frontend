<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { cn } from '@comfyorg/tailwind-utils'
import { ref } from 'vue'

import PricingPlanFeatureList from './PricingPlanFeatureList.vue'
import { SHOW_FREE_TIER } from '../../config/features'
import { externalLinks, getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import { Clock, Component as ComponentIcon } from '@lucide/vue'
import Button from '../ui/button/Button.vue'
import Badge from '../ui/badge/Badge.vue'
import ToggleGroup from '../ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '../ui/toggle-group/ToggleGroupItem.vue'
import PricingCard from './PricingCard.vue'
import Slider from '../ui/slider/Slider.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

type BillingPeriod = 'monthly' | 'yearly'
const billingPeriod = ref<BillingPeriod>('yearly')

function displayPriceKey(plan: PricingPlan): TranslationKey | undefined {
  if (billingPeriod.value === 'yearly' && plan.yearlyPriceKey) {
    return plan.yearlyPriceKey
  }
  return plan.priceKey
}

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
  yearlyPriceKey?: TranslationKey
  yearlyTotalKey?: TranslationKey
  creditsKey?: TranslationKey
  estimateKey?: TranslationKey
  ctaKey: TranslationKey
  ctaHref: string
  features: PlanFeature[]
  andMoreKey?: TranslationKey
  image?: string
  isPopular?: boolean
  isStandard?: boolean
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
    isStandard: true,
    labelKey: 'pricing.plan.standard.label',
    priceKey: 'pricing.plan.standard.price',
    yearlyPriceKey: 'pricing.plan.standard.yearlyPrice',
    yearlyTotalKey: 'pricing.plan.standard.yearlyTotal',
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
    isStandard: true,
    labelKey: 'pricing.plan.creator.label',
    priceKey: 'pricing.plan.creator.price',
    yearlyPriceKey: 'pricing.plan.creator.yearlyPrice',
    yearlyTotalKey: 'pricing.plan.creator.yearlyTotal',
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
    isStandard: true,
    labelKey: 'pricing.plan.pro.label',
    priceKey: 'pricing.plan.pro.price',
    yearlyPriceKey: 'pricing.plan.pro.yearlyPrice',
    yearlyTotalKey: 'pricing.plan.pro.yearlyTotal',
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
    id: 'team',
    labelKey: 'pricing.plan.team.label',
    ctaKey: 'pricing.plan.team.cta',
    ctaHref: subscribeUrl('team'),
    features: [
      { text: 'pricing.feature.inviteMembers' },
      { text: 'pricing.feature.concurrentWorkflows' },
      { text: 'pricing.feature.sharedCreditPool' },
      { text: 'pricing.feature.roleBasedPermissions' }
    ]
  },
  {
    id: 'enterprise',
    labelKey: 'pricing.enterprise.label',
    ctaKey: 'pricing.enterprise.cta',
    ctaHref: getRoutes(locale).cloudEnterprise,
    features: []
  }
]

const standardPlans = plans.filter((p) => p.isStandard)
const teamPlan = plans.find((p) => p.id === 'team')
const enterprisePlan = plans.find((p) => p.id === 'enterprise')!
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

    <div class="flex items-center justify-center pb-16">
      <ToggleGroup v-model="billingPeriod" type="single">
        <ToggleGroupItem value="monthly" class="min-w-48">
          {{ t('pricing.period.monthly', locale) }}
        </ToggleGroupItem>
        <ToggleGroupItem value="yearly" class="min-w-48">
          {{ t('pricing.period.yearly', locale) }}
        </ToggleGroupItem>
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
      <PricingCard
        v-for="plan in standardPlans"
        :key="plan.id"
        class="row-span-7 grid grid-rows-subgrid"
      >
        <!-- Label + badge -->
        <div class="flex items-center gap-4">
          <span
            class="text-primary-comfy-yellow ppformula-text-center text-base font-bold tracking-wider uppercase"
          >
            {{ t(plan.labelKey, locale) }}
          </span>
          <Badge v-if="plan.isPopular" variant="callout">
            {{ t('pricing.badge.popular', locale) }}</Badge
          >
        </div>

        <!-- Price -->
        <div
          v-if="displayPriceKey(plan)"
          class="mt-6 flex items-baseline gap-2"
        >
          <span
            class="font-formula text-5xl font-light text-primary-comfy-canvas"
          >
            {{ t(displayPriceKey(plan)!, locale) }}
          </span>
          <span
            v-if="
              billingPeriod === 'yearly' && plan.yearlyPriceKey && plan.priceKey
            "
            class="font-formula text-primary-warm-gray text-sm font-light line-through"
          >
            {{ t(plan.priceKey, locale) }}
          </span>
          <span class="text-primary-warm-white text-sm">
            {{ t('pricing.plan.period', locale) }}
          </span>
        </div>

        <p
          v-if="billingPeriod === 'yearly' && plan.yearlyTotalKey"
          class="text-primary-warm-gray mt-2 text-sm"
        >
          {{
            t('pricing.period.billedYearly', locale).replace(
              '{total}',
              t(plan.yearlyTotalKey, locale)
            )
          }}
        </p>
        <p
          v-else-if="billingPeriod === 'monthly' && plan.priceKey"
          class="text-primary-warm-gray mt-2 text-sm"
        >
          {{ t('pricing.period.billedMonthly', locale) }}
        </p>

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
            as="a"
            variant="outline"
            class="w-full text-center"
          >
            {{ t(plan.ctaKey, locale) }}
          </Button>
        </div>
      </PricingCard>

      <!-- Team -->
      <PricingCard v-if="teamPlan" class="col-span-full">
        <div class="grid grid-cols-3 gap-20">
          <div class="col-span-2">
            <div class="ppformula-text-center flex items-center gap-4">
              <span
                class="text-primary-comfy-yellow text-base font-bold tracking-wider uppercase"
              >
                {{ t(teamPlan.labelKey, locale) }}
              </span>
              <p class="text-primary-warm-gray text-sm">
                {{ t('pricing.team.description', locale) }}
              </p>
            </div>

            <div class="mt-6">
              <Slider class="w-full" />
            </div>
          </div>

          <div>
            <PricingPlanFeatureList
              v-if="teamPlan"
              :features="teamPlan.features"
              title-key="pricing.plan.team.everythingInProPlus"
              :locale
            />

            <div class="mt-5">
              <div class="text-primary-warm-gray flex flex-col gap-2 text-sm">
                <span>{{ t('pricing.plan.team.comingSoon', locale) }}</span>
                <span>
                  <Clock class="inline size-4" />
                  {{ t('pricing.plan.team.projectAssetManagement', locale) }}
                </span>
              </div>
              <div class="mt-8">
                <Button class="w-full" variant="outline">
                  {{ t(teamPlan.ctaKey, locale) }}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PricingCard>

      <!-- Enterprise -->
      <PricingCard
        class="col-span-full flex flex-col justify-between gap-8 lg:flex-row lg:items-center"
      >
        <div class="flex flex-col gap-6 lg:flex-row lg:items-center">
          <span
            class="text-primary-comfy-yellow text-xs font-bold tracking-wider"
          >
            {{ t(enterprisePlan.labelKey, locale) }}
          </span>
          <p class="text-primary-warm-white text-sm">
            {{ t('pricing.enterprise.description', locale) }}
          </p>
        </div>
        <Button :href="enterprisePlan.ctaHref" as="a" variant="outline">
          {{ t(enterprisePlan.ctaKey, locale) }}
        </Button>
      </PricingCard>
    </div>

    <!-- Footnote -->
    <p class="mt-12 text-xs text-primary-comfy-canvas/70">
      {{ t('pricing.footnote', locale) }}
    </p>
  </section>
</template>
