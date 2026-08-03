<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import type { BillingCycle } from '../../data/pricingPlans'

import BrandButton from '../../components/common/BrandButton.vue'
import PricingCard from '../../components/pricing/PricingCard.vue'
import PricingContactBand from '../../components/pricing/PricingContactBand.vue'
import PricingPlanFeatureList from '../../components/pricing/PricingPlanFeatureList.vue'
import PricingPlanLabel from '../../components/pricing/PricingPlanLabel.vue'
import PricingPrice from '../../components/pricing/PricingPrice.vue'
import PricingTeamCard from '../../components/pricing/PricingTeamCard.vue'
import Badge from '../../components/ui/badge/Badge.vue'
import Button from '../../components/ui/button/Button.vue'
import ToggleGroup from '../../components/ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '../../components/ui/toggle-group/ToggleGroupItem.vue'
import { externalLinks } from '../../config/routes'
import { minimaxPricingPlans } from '../../data/minimax'
import { subscribeUrl } from '../../data/pricingPlans'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const selectedBillingPeriod = ref<BillingCycle>('monthly')

const billingPeriod = computed({
  get: () => selectedBillingPeriod.value,
  set: (value: BillingCycle | undefined) => {
    if (value) selectedBillingPeriod.value = value
  }
})

const planCards = computed(() =>
  minimaxPricingPlans.map((plan) => ({
    plan,
    price: t(
      billingPeriod.value === 'yearly' ? plan.yearlyPriceKey : plan.priceKey,
      locale
    ),
    originalPrice:
      billingPeriod.value === 'yearly' ? t(plan.priceKey, locale) : undefined,
    yearlyTotal:
      billingPeriod.value === 'yearly'
        ? t(plan.yearlyTotalKey, locale)
        : undefined,
    creditsLine: t('minimax.pricing.credits', locale).replace(
      '{credits}',
      t(plan.creditsKey, locale)
    )
  }))
)
</script>

<template>
  <section class="max-w-9xl mx-auto px-4 py-16 lg:px-20 lg:py-14">
    <div class="mx-auto mb-8 max-w-3xl text-center lg:mb-10">
      <h2
        class="font-formula text-4xl font-light text-primary-comfy-canvas lg:text-5xl"
      >
        {{ t('minimax.pricing.heading', locale) }}
      </h2>
      <p
        class="mx-auto mt-3 max-w-xl text-base text-pretty text-primary-comfy-canvas"
      >
        {{ t('pricing.subtitle', locale) }}
      </p>
    </div>

    <div class="flex items-center justify-center pb-10">
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
      class="bg-primary-comfy-ink-light mb-4 flex flex-col gap-4 rounded-3xl px-8 py-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="text-lg font-bold text-primary-comfy-canvas">
          {{ t('minimax.pricing.banner.title', locale) }}
        </p>
        <p class="mt-1 text-sm text-primary-comfy-canvas">
          {{ t('minimax.pricing.banner.subtitle', locale) }}
        </p>
      </div>
      <BrandButton
        :href="externalLinks.cloud"
        target="_blank"
        variant="outline"
        size="xs"
        class="shrink-0 self-start sm:self-auto"
      >
        {{ t('minimax.pricing.banner.cta', locale) }}
      </BrandButton>
    </div>

    <div
      class="rounded-5xl bg-transparency-white-t4 grid gap-2 p-2 max-lg:mx-auto max-lg:max-w-lg lg:grid-cols-3"
    >
      <PricingCard
        v-for="{
          plan,
          price,
          originalPrice,
          yearlyTotal,
          creditsLine
        } in planCards"
        :key="plan.id"
        class="flex flex-col"
      >
        <div class="flex items-center gap-4">
          <PricingPlanLabel
            :label="t(plan.labelKey, locale)"
            class="ppformula-text-center text-base uppercase"
          />
          <Badge v-if="plan.isPopular" variant="callout" size="xs">
            {{ t('pricing.badge.popular', locale) }}
          </Badge>
        </div>

        <p class="mt-3 text-sm text-primary-comfy-canvas/80">
          {{ t(plan.descriptionKey, locale) }}
        </p>

        <PricingPrice
          :price="price"
          :period="t('pricing.plan.period', locale)"
          :original-price="originalPrice"
          :billing-period="billingPeriod === 'yearly' ? 'yearly' : undefined"
          :yearly-total="yearlyTotal"
          :locale
        />

        <p class="text-primary-warm-white mt-6 text-sm">
          {{ creditsLine }}
        </p>
        <p class="text-primary-warm-gray mt-2 text-xs">
          {{ t(plan.estimateKey, locale) }}
        </p>

        <div class="mt-6">
          <PricingPlanFeatureList :features="plan.featureGroups" :locale />
        </div>

        <div class="mt-8 flex flex-1 items-end">
          <Button
            :href="subscribeUrl(plan.id, billingPeriod)"
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
