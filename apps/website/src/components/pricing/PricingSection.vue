<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { cn } from '@comfyorg/tailwind-utils'
import { ref } from 'vue'

import { pricingPlans } from '../../data/pricingPlans'
import type { PricingPlan } from '../../data/pricingPlans'
import { t } from '../../i18n/translations'
import Badge from '../ui/badge/Badge.vue'
import Button from '../ui/button/Button.vue'
import ToggleGroup from '../ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '../ui/toggle-group/ToggleGroupItem.vue'
import PricingCard from './PricingCard.vue'
import PricingCredits from './PricingCredits.vue'
import PricingEnterpriseBand from './PricingEnterpriseBand.vue'
import PricingPlanFeatureList from './PricingPlanFeatureList.vue'
import PricingPlanLabel from './PricingPlanLabel.vue'
import PricingPrice from './PricingPrice.vue'
import PricingTeamCard from './PricingTeamCard.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

type BillingPeriod = 'monthly' | 'yearly'
const billingPeriod = ref<BillingPeriod>('yearly')

function displayPriceKey(plan: PricingPlan): TranslationKey | undefined {
  if (billingPeriod.value === 'yearly' && plan.yearlyPriceKey) {
    return plan.yearlyPriceKey
  }
  return plan.priceKey
}
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
          pricingPlans.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        )
      "
    >
      <PricingCard
        v-for="plan in pricingPlans"
        :key="plan.id"
        class="row-span-7 grid grid-rows-subgrid"
      >
        <!-- Label + badge -->
        <div class="flex items-center gap-4">
          <PricingPlanLabel
            :label="t(plan.labelKey, locale)"
            class="ppformula-text-center text-base uppercase"
          />
          <Badge v-if="plan.isPopular" variant="callout">
            {{ t('pricing.badge.popular', locale) }}</Badge
          >
        </div>

        <!-- Price -->
        <PricingPrice
          v-if="displayPriceKey(plan)"
          :price="t(displayPriceKey(plan)!, locale)"
          :period="t('pricing.plan.period', locale)"
          :original-price="
            billingPeriod === 'yearly' && plan.yearlyPriceKey && plan.priceKey
              ? t(plan.priceKey, locale)
              : undefined
          "
          :billing-period="billingPeriod"
          :yearly-total="
            plan.yearlyTotalKey ? t(plan.yearlyTotalKey, locale) : undefined
          "
          :locale
        />

        <!-- Features -->
        <div v-if="plan.features.length" class="mt-8">
          <PricingPlanFeatureList
            :features="[{ features: plan.features }]"
            :locale
          />
        </div>

        <!-- Credits -->
        <PricingCredits
          v-if="plan.creditsKey"
          :credits="t(plan.creditsKey, locale)"
          :label="t('pricing.creditsLabel', locale)"
          :estimate-key="plan.estimateKey"
          :locale
        />

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

      <PricingTeamCard :billing-period="billingPeriod" :locale />

      <PricingEnterpriseBand :locale />
    </div>

    <!-- Footnote -->
    <p class="mt-12 text-xs text-primary-comfy-canvas/70">
      {{ t('pricing.footnote', locale) }}
    </p>
  </section>
</template>
