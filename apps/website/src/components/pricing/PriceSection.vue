<script setup lang="ts">
import { ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { externalLinks } from '../../config/routes'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

type PlanTone = 'ink' | 'elevated'
type CtaVariant = 'outline' | 'solid'

interface PricingPlan {
  id: 'free' | 'standard' | 'creator' | 'pro'
  tone: PlanTone
  ctaVariant: CtaVariant
  ctaHref: string
  isMostPopular?: boolean
  label: string
  summary: string
  price: string
  credits: string
  estimate: string
  cta: string
  featureIntro?: string
  features: string[]
  nextUp?: string
  artClass: string
}

const activePlan = ref<PricingPlan['id']>('free')

const plans: PricingPlan[] = [
  {
    id: 'free',
    tone: 'ink',
    ctaVariant: 'outline',
    ctaHref: externalLinks.app,
    label: t('pricing.plan.free.label', locale),
    summary: t('pricing.plan.free.summary', locale),
    price: t('pricing.plan.free.price', locale),
    credits: t('pricing.plan.free.credits', locale),
    estimate: t('pricing.plan.free.estimate', locale),
    cta: t('pricing.plan.free.cta', locale),
    features: [
      t('pricing.plan.free.feature1', locale),
      t('pricing.plan.free.feature2', locale)
    ],
    artClass:
      'bg-linear-to-br from-primary-comfy-canvas via-primary-warm-white to-primary-warm-gray'
  },
  {
    id: 'standard',
    tone: 'ink',
    ctaVariant: 'solid',
    ctaHref: externalLinks.app,
    label: t('pricing.plan.standard.label', locale),
    summary: t('pricing.plan.standard.summary', locale),
    price: t('pricing.plan.standard.price', locale),
    credits: t('pricing.plan.standard.credits', locale),
    estimate: t('pricing.plan.standard.estimate', locale),
    cta: t('pricing.plan.standard.cta', locale),
    featureIntro: t('pricing.plan.standard.featureIntro', locale),
    features: [
      t('pricing.plan.standard.feature1', locale),
      t('pricing.plan.standard.feature2', locale)
    ],
    artClass:
      'bg-linear-to-tr from-primary-comfy-canvas via-primary-warm-gray to-primary-warm-white'
  },
  {
    id: 'creator',
    tone: 'ink',
    ctaVariant: 'solid',
    ctaHref: externalLinks.app,
    isMostPopular: true,
    label: t('pricing.plan.creator.label', locale),
    summary: t('pricing.plan.creator.summary', locale),
    price: t('pricing.plan.creator.price', locale),
    credits: t('pricing.plan.creator.credits', locale),
    estimate: t('pricing.plan.creator.estimate', locale),
    cta: t('pricing.plan.creator.cta', locale),
    featureIntro: t('pricing.plan.creator.featureIntro', locale),
    features: [
      t('pricing.plan.creator.feature1', locale),
      t('pricing.plan.creator.feature2', locale)
    ],
    nextUp: t('pricing.plan.creator.nextUp', locale),
    artClass:
      'bg-linear-to-br from-secondary-mauve via-primary-comfy-ink to-primary-comfy-plum'
  },
  {
    id: 'pro',
    tone: 'ink',
    ctaVariant: 'solid',
    ctaHref: externalLinks.app,
    label: t('pricing.plan.pro.label', locale),
    summary: t('pricing.plan.pro.summary', locale),
    price: t('pricing.plan.pro.price', locale),
    credits: t('pricing.plan.pro.credits', locale),
    estimate: t('pricing.plan.pro.estimate', locale),
    cta: t('pricing.plan.pro.cta', locale),
    featureIntro: t('pricing.plan.pro.featureIntro', locale),
    features: [
      t('pricing.plan.pro.feature1', locale),
      t('pricing.plan.pro.feature2', locale)
    ],
    nextUp: t('pricing.plan.pro.nextUp', locale),
    artClass:
      'bg-linear-to-br from-primary-comfy-ink via-primary-warm-gray to-primary-comfy-ink'
  }
]

const enterpriseFeatures = [
  t('pricing.enterprise.feature1', locale),
  t('pricing.enterprise.feature2', locale),
  t('pricing.enterprise.feature3', locale),
  t('pricing.enterprise.feature4', locale)
]

function getSurfaceClass(tone: PlanTone): string {
  return tone === 'elevated'
    ? 'bg-primary-warm-gray/45'
    : 'bg-primary-comfy-ink'
}

function getButtonVariantClass(variant: CtaVariant): string {
  if (variant === 'outline') {
    return 'border-primary-comfy-yellow text-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink'
  }

  return 'border-primary-comfy-yellow bg-primary-comfy-yellow text-primary-comfy-ink hover:brightness-105'
}
</script>

<template>
  <section class="px-4 pt-34 pb-20 lg:px-20 lg:pt-44 lg:pb-24">
    <header class="mx-auto max-w-2xl text-center">
      <h1 class="text-primary-warm-white text-4xl font-light lg:text-5xl">
        {{ t('pricing.title', locale) }}
      </h1>
      <p
        class="text-primary-warm-white/80 mx-auto mt-5 max-w-2xl text-sm/relaxed lg:text-base/relaxed"
      >
        {{ t('pricing.subtitle', locale) }}
      </p>
    </header>

    <!-- Mobile tab bar -->
    <div class="mt-8 flex gap-2 lg:hidden">
      <button
        v-for="plan in plans"
        :key="`tab-${plan.id}`"
        :class="
          activePlan === plan.id
            ? 'border-primary-comfy-yellow text-primary-comfy-yellow'
            : 'border-primary-warm-white/30 text-primary-warm-white/60'
        "
        class="flex-1 rounded-full border p-2 text-xs font-bold tracking-wider uppercase transition-colors"
        @click="activePlan = plan.id"
      >
        {{ plan.label }}
      </button>
    </div>

    <!-- Plans grid -->
    <div
      class="border-primary-warm-white/10 bg-primary-warm-white/8 mt-6 rounded-3xl border-2 p-1 lg:mt-12"
    >
      <div class="grid gap-1 lg:grid-cols-4">
        <article
          v-for="plan in plans"
          :key="plan.id"
          :class="activePlan === plan.id ? 'flex' : 'hidden lg:flex'"
          class="text-primary-comfy-canvas hover:text-primary-warm-white group [&:hover>div]:bg-secondary-cool-gray h-full flex-col gap-1 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:drop-shadow-2xl lg:row-span-4 lg:grid lg:grid-rows-subgrid"
        >
          <!-- Header: label + summary -->
          <div :class="getSurfaceClass(plan.tone)" class="rounded-2xl p-5">
            <div class="flex items-start justify-between gap-2">
              <h2
                class="text-primary-comfy-yellow text-sm leading-none font-bold"
              >
                {{ plan.label }}
              </h2>
              <span
                v-if="plan.isMostPopular"
                class="bg-primary-comfy-yellow text-primary-comfy-ink rounded-sm px-1.5 py-0.5 text-xs/tight font-bold tracking-wide"
              >
                {{ t('pricing.badge.popular', locale) }}
              </span>
            </div>

            <p class="mt-4 text-sm/snug">
              {{ plan.summary }}
            </p>
          </div>

          <!-- Pricing + CTA -->
          <div
            :class="getSurfaceClass(plan.tone)"
            class="flex flex-col rounded-2xl p-5"
          >
            <div class="flex items-end gap-1.5">
              <p
                class="font-formula-condensed text-5xl leading-none tracking-tight"
              >
                {{ plan.price }}
              </p>
              <span class="pb-1.5 text-sm leading-none opacity-70">
                {{ t('pricing.plan.period', locale) }}
              </span>
            </div>

            <p class="mt-4 text-sm/snug font-medium">
              {{ plan.credits }}
            </p>
            <p class="mt-4 text-xs/relaxed opacity-60">
              {{ plan.estimate }}
            </p>

            <a
              :href="plan.ctaHref"
              :class="getButtonVariantClass(plan.ctaVariant)"
              class="mt-auto inline-flex h-11 w-full items-center justify-center rounded-2xl border-2 text-xs font-bold tracking-wide uppercase transition-all duration-300 group-hover:-translate-y-0.5"
            >
              {{ plan.cta }}
            </a>
          </div>

          <!-- Features -->
          <div :class="getSurfaceClass(plan.tone)" class="rounded-2xl p-5">
            <p v-if="plan.featureIntro" class="mb-3 text-sm/snug font-semibold">
              {{ plan.featureIntro }}
            </p>

            <ul class="space-y-2.5">
              <li
                v-for="feature in plan.features"
                :key="feature"
                class="flex items-start gap-2"
              >
                <span
                  class="text-primary-comfy-yellow mt-px text-xs leading-none"
                >
                  ✓
                </span>
                <span class="text-xs/relaxed">
                  {{ feature }}
                </span>
              </li>
            </ul>

            <p v-if="plan.nextUp" class="mt-4 text-xs/relaxed opacity-50">
              {{ plan.nextUp }}
            </p>
          </div>

          <!-- Desktop art panel -->
          <div
            :class="plan.artClass"
            class="relative hidden h-28 overflow-hidden rounded-2xl lg:block"
          >
            <div
              class="absolute inset-0 bg-[radial-gradient(circle_at_22%_28%,rgba(255,255,255,0.34),transparent_52%)]"
            />
          </div>
        </article>
      </div>

      <!-- Mobile art strip -->
      <div class="mt-1 grid grid-cols-4 gap-1 lg:hidden">
        <div
          v-for="plan in plans"
          :key="`art-${plan.id}`"
          :class="plan.artClass"
          class="relative h-20 overflow-hidden rounded-2xl"
        >
          <div
            class="absolute inset-0 bg-[radial-gradient(circle_at_22%_28%,rgba(255,255,255,0.34),transparent_52%)]"
          />
        </div>
      </div>
    </div>

    <!-- Enterprise -->
    <div
      class="border-primary-warm-white/10 bg-primary-warm-white/8 mt-4 rounded-3xl border-2 p-1"
    >
      <div class="grid gap-1 lg:grid-cols-2">
        <div class="bg-primary-comfy-ink rounded-2xl px-5 py-6 lg:p-7">
          <p class="text-primary-comfy-yellow text-sm leading-none font-bold">
            {{ t('pricing.enterprise.label', locale) }}
          </p>
          <h2
            class="text-primary-warm-white mt-4 max-w-sm text-3xl/tight font-light"
          >
            {{ t('pricing.enterprise.heading', locale) }}
          </h2>
          <p class="text-primary-warm-white/80 mt-4 max-w-sm text-sm/relaxed">
            {{ t('pricing.enterprise.description', locale) }}
          </p>

          <a
            href="mailto:contact@comfy.org"
            class="border-primary-comfy-yellow text-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink mt-8 inline-flex h-10 items-center justify-center rounded-xl border-2 px-6 text-xs font-bold tracking-wide uppercase transition-colors"
          >
            {{ t('pricing.enterprise.cta', locale) }}
          </a>
        </div>

        <div class="bg-primary-comfy-ink rounded-2xl px-5 py-6 lg:p-7">
          <p class="text-primary-warm-white text-sm/snug font-semibold">
            {{ t('pricing.enterprise.featureIntro', locale) }}
          </p>

          <ul class="mt-4 space-y-3">
            <li
              v-for="feature in enterpriseFeatures"
              :key="feature"
              class="flex items-start gap-2"
            >
              <span
                class="text-primary-comfy-yellow mt-px text-xs leading-none"
              >
                ✓
              </span>
              <span class="text-primary-warm-white/80 text-xs/relaxed">
                {{ feature }}
              </span>
            </li>
          </ul>

          <p class="text-primary-warm-white/45 mt-5 text-xs/relaxed">
            {{ t('pricing.enterprise.andMore', locale) }}
          </p>
        </div>
      </div>
    </div>

    <p class="text-primary-warm-white/60 mt-3 text-xs/relaxed">
      {{ t('pricing.footnote', locale) }}
    </p>
  </section>
</template>
