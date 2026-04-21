<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { cn } from '@comfyorg/tailwind-utils'
import { ref } from 'vue'

import BrandButton from '../common/BrandButton.vue'
import PricingTierCard from './PricingTierCard.vue'
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
  nextUpKey?: TranslationKey
  andMoreKey?: TranslationKey
  image?: string
  isPopular?: boolean
  isEnterprise?: boolean
}

const plans: PricingPlan[] = [
  {
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
  },
  {
    id: 'standard',
    labelKey: 'pricing.plan.standard.label',
    summaryKey: 'pricing.plan.standard.summary',
    priceKey: 'pricing.plan.standard.price',
    creditsKey: 'pricing.plan.standard.credits',
    estimateKey: 'pricing.plan.standard.estimate',
    ctaKey: 'pricing.plan.standard.cta',
    ctaHref: subscribeUrl('standard'),
    featureIntroKey: 'pricing.plan.standard.featureIntro',
    features: [
      { text: 'pricing.plan.standard.feature1' },
      { text: 'pricing.plan.standard.feature2' }
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
    nextUpKey: 'pricing.plan.creator.nextUp',
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
    ],
    nextUpKey: 'pricing.plan.pro.nextUp'
  },
  {
    id: 'enterprise',
    labelKey: 'pricing.enterprise.label',
    summaryKey: 'pricing.enterprise.description',
    ctaKey: 'pricing.enterprise.cta',
    ctaHref: getRoutes(locale).contact,
    featureIntroKey: 'pricing.enterprise.featureIntro',
    features: [
      { text: 'pricing.enterprise.feature1' },
      { text: 'pricing.enterprise.feature2' },
      { text: 'pricing.enterprise.feature3' },
      { text: 'pricing.enterprise.feature4' }
    ],
    andMoreKey: 'pricing.enterprise.andMore',
    isEnterprise: true
  }
]

const standardPlans = plans.filter((p) => !p.isEnterprise)
const enterprisePlan = plans.find((p) => p.isEnterprise)!

const activePlanIndex = ref(0)
</script>

<template>
  <section class="px-4 py-16 lg:px-20 lg:py-24">
    <!-- Header -->
    <div class="mx-auto mb-12 max-w-3xl text-center lg:mb-16">
      <h1
        class="text-primary-comfy-canvas font-formula text-4xl font-light lg:text-6xl"
      >
        {{ t('pricing.title', locale) }}
      </h1>
      <p class="text-primary-comfy-canvas mt-4 text-base">
        {{ t('pricing.subtitle', locale) }}
      </p>
    </div>

    <!-- Mobile plan tabs -->
    <div class="scrollbar-none mb-6 flex gap-2 overflow-x-auto lg:hidden">
      <button
        v-for="(plan, index) in plans"
        :key="plan.id"
        :class="
          cn(
            'shrink-0 rounded-full px-4 py-2 text-xs font-bold tracking-wider transition-colors',
            activePlanIndex === index
              ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
              : 'bg-transparency-white-t4 text-primary-comfy-canvas'
          )
        "
        @click="activePlanIndex = index"
      >
        <span class="ppformula-text-center">
          {{ t(plan.labelKey, locale) }}
        </span>
      </button>
    </div>

    <!-- Desktop: 4-column grid / Mobile: single card -->
    <div
      class="rounded-5xl bg-transparency-white-t4 hidden p-2 lg:grid lg:grid-cols-4 lg:gap-2"
    >
      <PricingTierCard v-for="plan in standardPlans" :key="plan.id">
        <!-- Label + badge -->
        <div class="flex items-center gap-2 px-8 pt-8">
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
              class="bg-primary-comfy-yellow text-primary-comfy-ink flex items-center px-2 text-[10px] font-bold tracking-wider"
            >
              <span class="ppformula-text-center">
                {{ t('pricing.badge.popular', locale) }}
              </span>
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
        <p class="text-primary-comfy-canvas px-8 text-base">
          {{ t(plan.summaryKey, locale) }}
        </p>

        <!-- Price -->
        <div v-if="plan.priceKey" class="flex items-baseline gap-1 px-8 pt-4">
          <span
            class="text-primary-comfy-canvas font-formula text-6.5xl font-light"
          >
            {{ t(plan.priceKey, locale) }}
          </span>
          <span class="text-primary-comfy-canvas text-sm">
            {{ t('pricing.plan.period', locale) }}
          </span>
        </div>
        <div v-else class="px-8 pt-4" />

        <!-- Credits -->
        <p
          v-if="plan.creditsKey"
          class="text-primary-comfy-canvas px-8 text-sm"
        >
          {{ t(plan.creditsKey, locale) }}
        </p>
        <div v-else class="px-8" />

        <!-- Estimate -->
        <p
          v-if="plan.estimateKey"
          class="text-primary-comfy-canvas/80 px-8 text-sm"
        >
          {{ t(plan.estimateKey, locale) }}
        </p>
        <div v-else class="px-8" />

        <!-- Features -->
        <div class="px-8 py-4">
          <p class="text-primary-comfy-canvas mb-3 text-sm font-semibold">
            {{
              plan.featureIntroKey ? t(plan.featureIntroKey, locale) : '&nbsp;'
            }}
          </p>
          <ul class="space-y-2">
            <li
              v-for="feature in plan.features"
              :key="feature.text"
              class="flex items-start gap-2"
            >
              <span class="text-primary-comfy-yellow mt-0.5 text-sm">✓</span>
              <span class="text-primary-comfy-canvas text-sm">
                {{ t(feature.text, locale) }}
              </span>
            </li>
          </ul>
          <p
            v-if="plan.nextUpKey"
            class="text-primary-comfy-canvas/80 mt-4 text-sm"
          >
            {{ t(plan.nextUpKey, locale) }}
          </p>
        </div>
        <!-- CTA -->
        <div class="flex self-end px-8">
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

    <!-- Mobile: single plan view -->
    <div class="lg:hidden">
      <div
        v-for="(plan, index) in plans"
        :key="plan.id"
        :class="cn('flex-col', activePlanIndex !== index ? 'hidden' : 'flex')"
      >
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
                class="bg-primary-comfy-yellow text-primary-comfy-ink flex items-center px-2 text-[10px] font-bold tracking-wider"
              >
                <span class="ppformula-text-center">
                  {{ t('pricing.badge.popular', locale) }}
                </span>
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
            class="text-primary-comfy-canvas mt-3 text-2xl font-light"
          >
            {{ t('pricing.enterprise.heading', locale) }}
          </h2>

          <!-- Summary -->
          <p class="text-primary-comfy-canvas mt-2 text-sm">
            {{ t(plan.summaryKey, locale) }}
          </p>

          <!-- Price (standard plans only) -->
          <template v-if="plan.priceKey">
            <div class="mt-6 flex items-baseline gap-1">
              <span
                class="text-primary-comfy-canvas font-formula text-5xl font-light"
              >
                {{ t(plan.priceKey, locale) }}
              </span>
              <span class="text-primary-comfy-canvas/55 text-sm">
                {{ t('pricing.plan.period', locale) }}
              </span>
            </div>

            <p
              v-if="plan.creditsKey"
              class="text-primary-comfy-canvas mt-4 text-xs font-medium"
            >
              {{ t(plan.creditsKey, locale) }}
            </p>

            <p
              v-if="plan.estimateKey"
              class="text-primary-comfy-canvas mt-2 text-xs"
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
        <div class="bg-transparency-white-t4 mt-2 rounded-3xl p-6">
          <p
            v-if="plan.featureIntroKey"
            class="text-primary-comfy-canvas mb-3 text-sm font-semibold"
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
              <span class="text-primary-comfy-canvas text-sm">
                {{ t(feature.text, locale) }}
              </span>
            </li>
          </ul>
          <p
            v-if="plan.nextUpKey"
            class="text-primary-comfy-canvas mt-4 text-sm"
          >
            {{ t(plan.nextUpKey, locale) }}
          </p>
          <p
            v-if="plan.andMoreKey"
            class="text-primary-comfy-canvas mt-4 text-sm"
          >
            {{ t(plan.andMoreKey, locale) }}
          </p>
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
      class="bg-transparency-white-t4 rounded-5xl mt-8 hidden flex-col gap-8 p-2 lg:mt-2 lg:flex lg:flex-row"
    >
      <!-- Left side -->
      <div
        class="bg-primary-comfy-ink flex flex-col items-start justify-between rounded-4xl p-8 lg:w-1/2"
      >
        <div>
          <span
            class="text-primary-comfy-yellow text-xs font-bold tracking-wider"
          >
            {{ t(enterprisePlan.labelKey, locale) }}
          </span>
          <h2
            class="text-primary-comfy-canvas mt-3 text-2xl font-light lg:text-3xl"
          >
            {{ t('pricing.enterprise.heading', locale) }}
          </h2>
          <p class="text-primary-comfy-canvas mt-3 text-sm">
            {{ t(enterprisePlan.summaryKey, locale) }}
          </p>
        </div>
        <BrandButton :href="enterprisePlan.ctaHref" variant="outline" size="lg">
          {{ t(enterprisePlan.ctaKey, locale) }}
        </BrandButton>
      </div>

      <!-- Right side -->
      <div class="bg-primary-comfy-ink rounded-4xl p-8 lg:w-1/2">
        <p
          v-if="enterprisePlan.featureIntroKey"
          class="text-primary-comfy-canvas mb-4 text-sm font-semibold"
        >
          {{ t(enterprisePlan.featureIntroKey, locale) }}
        </p>
        <ul class="space-y-3">
          <li
            v-for="feature in enterprisePlan.features"
            :key="feature.text"
            class="flex items-start gap-2"
          >
            <span class="text-primary-comfy-yellow mt-0.5 text-sm">✓</span>
            <span class="text-primary-comfy-canvas text-sm">
              {{ t(feature.text, locale) }}
            </span>
          </li>
        </ul>
        <p
          v-if="enterprisePlan.andMoreKey"
          class="text-primary-comfy-canvas/70 mt-4 text-sm"
        >
          {{ t(enterprisePlan.andMoreKey, locale) }}
        </p>
      </div>
    </div>

    <!-- Footnote -->
    <p class="text-primary-comfy-canvas/70 mt-12 text-xs">
      {{ t('pricing.footnote', locale) }}
    </p>
  </section>
</template>
