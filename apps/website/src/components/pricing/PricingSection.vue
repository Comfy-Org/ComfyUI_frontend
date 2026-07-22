<script setup lang="ts">
import type { Locale, TranslationKey } from '../../i18n/translations'

import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

import { externalLinks } from '../../config/routes'
import { planFeatures, pricingPlans } from '../../data/pricingPlans'
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
import PricingStudentAmbassadorBand from './PricingStudentAmbassadorBand.vue'
import PricingTeamCard from './PricingTeamCard.vue'

const {
  locale = 'en',
  education = false,
  headingLevel = 'h1'
} = defineProps<{
  locale?: Locale
  education?: boolean
  headingLevel?: 'h1' | 'h2'
}>()

const selectedBillingPeriod = ref<BillingCycle>('yearly')

// reka-ui's single toggle group emits undefined when the active item is
// clicked again; exactly one billing cycle must stay selected, so ignore it.
const billingPeriod = computed({
  get: () => selectedBillingPeriod.value,
  set: (value: BillingCycle | undefined) => {
    if (value) {
      selectedBillingPeriod.value = value
    }
  }
})

function displayPriceKey(plan: PricingPlan): TranslationKey | undefined {
  if (education) {
    // Plans without education pricing (e.g. free) fall back to the list price.
    if (billingPeriod.value === 'yearly') {
      return plan.eduYearlyPriceKey ?? plan.eduPriceKey ?? plan.priceKey
    }
    return plan.eduPriceKey ?? plan.priceKey
  }
  if (billingPeriod.value === 'yearly' && plan.yearlyPriceKey) {
    return plan.yearlyPriceKey
  }
  return plan.priceKey
}

// In education mode the monthly list price is struck through in both cycles;
// otherwise only the yearly view strikes the (monthly) list price.
function originalPriceFor(plan: PricingPlan): string | undefined {
  if (education) {
    return plan.eduPriceKey && plan.priceKey
      ? t(plan.priceKey, locale)
      : undefined
  }
  return billingPeriod.value === 'yearly' &&
    plan.yearlyPriceKey &&
    plan.priceKey
    ? t(plan.priceKey, locale)
    : undefined
}

function yearlyTotalFor(plan: PricingPlan): string | undefined {
  if (education) {
    return plan.eduYearlyTotalKey
      ? t(plan.eduYearlyTotalKey, locale)
      : undefined
  }
  return plan.yearlyTotalKey ? t(plan.yearlyTotalKey, locale) : undefined
}

// Derive each plan's display values once so the template doesn't call the
// helpers twice (and avoids the non-null assertion on the price key).
const planCards = computed(() =>
  pricingPlans.map((plan) => ({
    plan,
    priceKey: displayPriceKey(plan),
    originalPrice: originalPriceFor(plan),
    yearlyTotal: yearlyTotalFor(plan),
    features: planFeatures(plan, education, billingPeriod.value)
  }))
)
</script>

<template>
  <section class="max-w-9xl mx-auto px-4 py-16 lg:px-20 lg:py-14">
    <!-- Header -->
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
        {{ t(education ? 'pricing.subtitle.edu' : 'pricing.subtitle', locale) }}
      </p>
    </div>

    <div class="flex items-center justify-center pb-16">
      <ToggleGroup v-model="billingPeriod" type="single">
        <ToggleGroupItem
          value="monthly"
          class="min-w-40 text-2xs sm:min-w-48 sm:text-xs"
        >
          <span class="ppformula-text-center">{{
            t(
              education
                ? 'pricing.period.monthly.edu'
                : 'pricing.period.monthly',
              locale
            )
          }}</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="yearly"
          class="min-w-40 text-2xs sm:min-w-48 sm:text-xs"
        >
          <span class="ppformula-text-center">{{
            t(
              education ? 'pricing.period.yearly.edu' : 'pricing.period.yearly',
              locale
            )
          }}</span>
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
        <!-- Label + badge -->
        <div class="flex items-center gap-4">
          <PricingPlanLabel
            :label="t(plan.labelKey, locale)"
            class="ppformula-text-center text-base uppercase"
          />
          <Badge v-if="plan.isPopular" variant="callout" size="xs">
            {{ t('pricing.badge.popular', locale) }}</Badge
          >
        </div>

        <!-- Price -->
        <PricingPrice
          v-if="priceKey"
          :price="t(priceKey, locale)"
          :period="t('pricing.plan.period', locale)"
          :original-price="originalPrice"
          :billing-period="billingPeriod"
          :yearly-total="yearlyTotal"
          :locale
        />

        <!-- Features -->
        <div v-if="features.length" class="mt-8">
          <PricingPlanFeatureList :features="[{ features }]" :locale />
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
            :href="plan.ctaHref(billingPeriod)"
            variant="outline"
            class="w-full text-center"
          >
            {{ t(plan.ctaKey, locale) }}
          </Button>
        </div>
      </PricingCard>

      <PricingTeamCard :billing-period="billingPeriod" :education :locale />

      <PricingContactBand
        :label-key="
          education
            ? 'pricing.creativeCampus.label'
            : 'pricing.enterprise.label'
        "
        :description-key="
          education
            ? 'pricing.creativeCampus.description'
            : 'pricing.enterprise.description'
        "
        :href="
          education ? externalLinks.creativeCampusApplicationForm : undefined
        "
        :locale
      />
    </div>
    <PricingStudentAmbassadorBand v-if="education" :locale />

    <!-- Footnote -->
    <p class="mt-12 text-xs text-primary-comfy-canvas/70">
      {{ t('pricing.footnote', locale) }}
    </p>
  </section>
</template>
