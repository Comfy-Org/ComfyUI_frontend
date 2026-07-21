<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { cn } from '@comfyorg/tailwind-utils'

import BrandButton from '../common/BrandButton.vue'
import PricingPlanFeatureList from './PricingPlanFeatureList.vue'
import PricingTierCard from './PricingTierCard.vue'
import { SHOW_FREE_TIER } from '../../config/features'
import { externalLinks, getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

function subscribeUrl(tier: string): string {
  return `${externalLinks.cloud}/cloud/subscribe?tier=${tier}&cycle=monthly`
}

interface PlanFeature {
  text: TranslationKey
}

interface PricingPlan {
  id: string
  labelKey: TranslationKey
  summaryKey: TranslationKey
  priceKey?: TranslationKey
  creditsKey?: TranslationKey
  estimateKey?: TranslationKey
  ctaKey: TranslationKey
  ctaHref: string
  featureIntroKey?: TranslationKey
  features: PlanFeature[]
  andMoreKey?: TranslationKey
  image?: string
  isPopular?: boolean
  isEnterprise?: boolean
}

const freePlan: PricingPlan = {
  id: 'free',
  labelKey: 'pricing.plan.free.label',
  summaryKey: 'pricing.plan.free.summary',
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
    summaryKey: 'pricing.plan.standard.summary',
    priceKey: 'pricing.plan.standard.price',
    creditsKey: 'pricing.plan.standard.credits',
    estimateKey: 'pricing.plan.standard.estimate',
    ctaKey: 'pricing.plan.standard.cta',
    ctaHref: subscribeUrl('standard'),
    featureIntroKey: SHOW_FREE_TIER
      ? 'pricing.plan.standard.featureIntro'
      : undefined,
    features: [
      { text: 'pricing.plan.standard.feature1' },
      { text: 'pricing.plan.standard.feature2' },
      { text: 'pricing.plan.standard.feature3' }
    ]
  },
  {
    id: 'creator',
    labelKey: 'pricing.plan.creator.label',
    summaryKey: 'pricing.plan.creator.summary',
    priceKey: 'pricing.plan.creator.price',
    creditsKey: 'pricing.plan.creator.credits',
    estimateKey: 'pricing.plan.creator.estimate',
    ctaKey: 'pricing.plan.creator.cta',
    ctaHref: subscribeUrl('creator'),
    featureIntroKey: 'pricing.plan.creator.featureIntro',
    features: [
      { text: 'pricing.plan.creator.feature1' },
      { text: 'pricing.plan.creator.feature2' }
    ],
    isPopular: true
  },
  {
    id: 'pro',
    labelKey: 'pricing.plan.pro.label',
    summaryKey: 'pricing.plan.pro.summary',
    priceKey: 'pricing.plan.pro.price',
    creditsKey: 'pricing.plan.pro.credits',
    estimateKey: 'pricing.plan.pro.estimate',
    ctaKey: 'pricing.plan.pro.cta',
    ctaHref: subscribeUrl('pro'),
    featureIntroKey: 'pricing.plan.pro.featureIntro',
    features: [
      { text: 'pricing.plan.pro.feature1' },
      { text: 'pricing.plan.pro.feature2' }
    ]
  },
  {
    id: 'enterprise',
    labelKey: 'pricing.enterprise.label',
    summaryKey: 'pricing.enterprise.description',
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
      <p class="mt-3 text-base text-primary-comfy-canvas">
        {{ t('pricing.subtitle', locale) }}
      </p>
    </div>

    <!-- Desktop: dynamic grid (3 or 4 columns) / Mobile: stacked cards -->
    <div
      :class="
        cn(
          'rounded-5xl bg-transparency-white-t4 hidden p-2 lg:grid lg:gap-2',
          standardPlans.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        )
      "
    >
      <PricingTierCard v-for="plan in standardPlans" :key="plan.id">
        <!-- Label + badge -->
        <div class="flex items-center gap-2 px-6 pt-6">
          <span
            class="text-primary-comfy-yellow translate-y-0.5 text-base font-bold tracking-wider"
          >
            {{ t(plan.labelKey, locale) }}
          </span>
          <span v-if="plan.isPopular" class="flex h-5 items-stretch">
            <img
              src="/icons/node-left.svg"
              alt=""
              class="-mx-px self-stretch"
              aria-hidden="true"
            />
            <span
              class="bg-primary-comfy-yellow font-formula-narrow flex items-center px-2 text-sm font-bold tracking-wider text-primary-comfy-ink"
            >
              {{ t('pricing.badge.popular', locale) }}
            </span>
            <img
              src="/icons/node-right.svg"
              alt=""
              class="-mx-px self-stretch"
              aria-hidden="true"
            />
          </span>
        </div>

        <!-- Summary -->
        <p class="px-6 text-sm text-primary-comfy-canvas">
          {{ t(plan.summaryKey, locale) }}
        </p>

        <!-- Price -->
        <div v-if="plan.priceKey" class="flex items-baseline gap-1 px-6 pt-2">
          <span
            class="font-formula text-5xl font-light text-primary-comfy-canvas"
          >
            {{ t(plan.priceKey, locale) }}
          </span>
          <span class="text-sm text-primary-comfy-canvas">
            {{ t('pricing.plan.period', locale) }}
          </span>
        </div>
        <div v-else class="px-6 pt-2" />

        <!-- Credits -->
        <p
          v-if="plan.creditsKey"
          class="px-6 text-sm text-primary-comfy-canvas"
        >
          {{ t(plan.creditsKey, locale) }}
        </p>
        <div v-else class="px-6" />

        <!-- Estimate -->
        <p
          v-if="plan.estimateKey"
          class="px-6 text-xs text-primary-comfy-canvas/80"
        >
          {{ t(plan.estimateKey, locale) }}
        </p>
        <div v-else class="px-6" />

        <!-- Features -->
        <div v-if="plan.features.length" class="px-6 py-3">
          <p
            v-if="plan.featureIntroKey"
            class="mb-2 text-sm font-semibold text-primary-comfy-canvas"
          >
            {{ t(plan.featureIntroKey, locale) }}
          </p>
          <ul class="space-y-2">
            <li
              v-for="feature in plan.features"
              :key="feature.text"
              class="flex items-start gap-2"
            >
              <span class="text-primary-comfy-yellow mt-0.5 text-sm">✓</span>
              <span class="text-sm text-primary-comfy-canvas">
                {{ t(feature.text, locale) }}
              </span>
            </li>
          </ul>
        </div>
        <!-- CTA -->
        <div class="flex self-end px-6">
          <BrandButton
            :href="plan.ctaHref"
            variant="outline"
            size="sm"
            class="w-full text-center"
          >
            {{ t(plan.ctaKey, locale) }}
          </BrandButton>
        </div>
      </PricingTierCard>
    </div>

    <!-- Mobile: stacked plans -->
    <div class="flex flex-col gap-8 lg:hidden">
      <div v-for="plan in plans" :key="plan.id" class="flex flex-col">
        <!-- Main info card -->
        <div class="bg-transparency-white-t4 rounded-3xl p-6">
          <!-- Label + badge -->
          <div class="flex items-center gap-2">
            <span
              class="text-primary-comfy-yellow text-xs font-bold tracking-wider"
            >
              {{ t(plan.labelKey, locale) }}
            </span>
            <span v-if="plan.isPopular" class="flex h-5 items-stretch">
              <img
                src="/icons/node-left.svg"
                alt=""
                class="-mx-px self-stretch"
                aria-hidden="true"
              />
              <span
                class="bg-primary-comfy-yellow flex items-center px-2 text-[10px] font-bold tracking-wider text-primary-comfy-ink"
              >
                {{ t('pricing.badge.popular', locale) }}
              </span>
              <img
                src="/icons/node-right.svg"
                alt=""
                class="-mx-px self-stretch"
                aria-hidden="true"
              />
            </span>
          </div>

          <!-- Enterprise heading -->
          <h2
            v-if="plan.isEnterprise"
            class="mt-3 text-2xl font-light text-primary-comfy-canvas"
          >
            {{ t('pricing.enterprise.heading', locale) }}
          </h2>

          <!-- Summary -->
          <p class="mt-2 text-sm text-primary-comfy-canvas">
            {{ t(plan.summaryKey, locale) }}
          </p>

          <!-- Price (standard plans only) -->
          <template v-if="plan.priceKey">
            <div class="mt-6 flex items-baseline gap-1">
              <span
                class="font-formula text-5xl font-light text-primary-comfy-canvas"
              >
                {{ t(plan.priceKey, locale) }}
              </span>
              <span class="text-sm text-primary-comfy-canvas/55">
                {{ t('pricing.plan.period', locale) }}
              </span>
            </div>

            <p
              v-if="plan.creditsKey"
              class="mt-4 text-xs font-medium text-primary-comfy-canvas"
            >
              {{ t(plan.creditsKey, locale) }}
            </p>

            <p
              v-if="plan.estimateKey"
              class="mt-2 text-xs text-primary-comfy-canvas"
            >
              {{ t(plan.estimateKey, locale) }}
            </p>
          </template>

          <!-- CTA -->
          <div class="mt-6">
            <BrandButton
              :href="plan.ctaHref"
              variant="outline"
              size="lg"
              class="w-full text-center"
            >
              {{ t(plan.ctaKey, locale) }}
            </BrandButton>
          </div>
        </div>

        <!-- Features card -->
        <div
          v-if="plan.features.length"
          class="bg-transparency-white-t4 mt-2 rounded-3xl p-6"
        >
          <PricingPlanFeatureList
            :features="plan.features"
            :feature-intro-key="plan.featureIntroKey"
            :and-more-key="plan.andMoreKey"
            :locale
          />
        </div>

        <!-- Image (standard plans only) -->
        <div v-if="plan.image" class="mt-2">
          <img
            :src="plan.image"
            :alt="t(plan.labelKey, locale)"
            class="aspect-21/9 w-full rounded-3xl object-cover"
          />
        </div>
      </div>
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
            {{ t(enterprisePlan.summaryKey, locale) }}
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
