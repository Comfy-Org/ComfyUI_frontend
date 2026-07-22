<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

import { pricingPlans } from '../../data/pricingPlans'
import type { BillingCycle, PricingPlan } from '../../data/pricingPlans'
import { t } from '../../i18n/translations'
import Badge from '../ui/badge/Badge.vue'
import Button from '../ui/button/Button.vue'
import ToggleGroup from '../ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '../ui/toggle-group/ToggleGroupItem.vue'
import PricingCard from './PricingCard.vue'
import PricingContactBand from './PricingContactBand.vue'
import PricingCredits from './PricingCredits.vue'
import PricingPlanFeatureList from './PricingPlanFeatureList.vue'
import PricingPlanLabel from './PricingPlanLabel.vue'
import PricingPrice from './PricingPrice.vue'
import PricingTeamCard from './PricingTeamCard.vue'

const { locale = 'en', headingLevel = 'h1' } = defineProps<{
  locale?: Locale
  headingLevel?: 'h1' | 'h2'
}>()

const selectedBillingPeriod = ref<BillingCycle>('yearly')

const billingPeriod = computed({
  get: () => selectedBillingPeriod.value,
  set: (value: BillingCycle | undefined) => {
    if (value) selectedBillingPeriod.value = value
  }
})

function displayPriceKey(plan: PricingPlan): TranslationKey | undefined {
  if (billingPeriod.value === 'yearly' && plan.yearlyPriceKey) {
    return plan.yearlyPriceKey
  }
  return plan.priceKey
}

function originalPriceFor(plan: PricingPlan): string | undefined {
  return billingPeriod.value === 'yearly' &&
    plan.yearlyPriceKey &&
    plan.priceKey
    ? t(plan.priceKey, locale)
    : undefined
}

const planCards = computed(() =>
  pricingPlans.map((plan) => ({
    plan,
    priceKey: displayPriceKey(plan),
    originalPrice: originalPriceFor(plan),
    yearlyTotal: plan.yearlyTotalKey
      ? t(plan.yearlyTotalKey, locale)
      : undefined,
    features: plan.features
  }))
)
</script>

<template>
  <section class="max-w-9xl mx-auto px-4 py-16 lg:px-20 lg:py-14">
    <div class="mx-auto mb-8 max-w-3xl text-center lg:mb-10">
      <component
        :is="headingLevel"
        class="font-formula text-4xl font-light text-primary-comfy-canvas lg:text-5xl"
      >
        {{ t('pricing.title', locale) }}
      </component>
      <p
        class="mx-auto mt-3 max-w-xl text-base text-pretty text-primary-comfy-canvas"
      >
        {{ t('pricing.subtitle', locale) }}
      </p>
    </div>

    <div class="flex items-center justify-center pb-16">
      <ToggleGroup v-model="billingPeriod" type="single">
        <ToggleGroupItem
          value="monthly"
          class="min-w-40 text-2xs sm:min-w-48 sm:text-xs"
        >
          <span class="ppformula-text-center">{{
            t('pricing.period.monthly', locale)
          }}</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="yearly"
          class="min-w-40 text-2xs sm:min-w-48 sm:text-xs"
        >
          <span class="ppformula-text-center">{{
            t('pricing.period.yearly', locale)
          }}</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>

    <div
      :class="
        cn(
          'rounded-5xl bg-transparency-white-t4 grid gap-2 p-2 max-lg:mx-auto max-lg:max-w-lg',
          pricingPlans.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        )
      "
    >
      <PricingCard
        v-for="{
          plan,
          priceKey,
          originalPrice,
          yearlyTotal,
          features
        } in planCards"
        :key="plan.id"
        class="row-span-7 grid grid-rows-subgrid"
      >
        <div class="flex items-center gap-4">
          <PricingPlanLabel
            :label="t(plan.labelKey, locale)"
            class="ppformula-text-center text-base uppercase"
          />
          <Badge v-if="plan.isPopular" variant="callout" size="xs">
            {{ t('pricing.badge.popular', locale) }}</Badge
          >
        </div>

        <PricingPrice
          v-if="priceKey"
          :price="t(priceKey, locale)"
          :period="t('pricing.plan.period', locale)"
          :original-price="originalPrice"
          :billing-period="billingPeriod"
          :yearly-total="yearlyTotal"
          :locale
        />

        <div v-if="features.length" class="mt-8">
          <PricingPlanFeatureList :features="[{ features }]" :locale />
        </div>

        <PricingCredits
          v-if="plan.creditsKey"
          :credits="t(plan.creditsKey, locale)"
          :label="t('pricing.creditsLabel', locale)"
          :estimate-key="plan.estimateKey"
          :locale
        />

        <div class="mt-8 flex self-end">
          <Button
            :href="plan.ctaHref(billingPeriod)"
            variant="outline"
            class="w-full text-center"
          >
            {{ t(plan.ctaKey, locale) }}
          </Button>
        </div>
      </PricingCard>

      <PricingTeamCard :billing-period="billingPeriod" :locale />

      <PricingContactBand
        label-key="pricing.enterprise.label"
        description-key="pricing.enterprise.description"
        :locale
      />
    </div>

    <p class="mt-12 text-xs text-primary-comfy-canvas/70">
      {{ t('pricing.footnote', locale) }}
    </p>
  </section>
</template>
