<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import type { PlanFeatureGroup } from './PricingPlanFeatureList.vue'
import { computed, ref } from 'vue'

import { Component as ComponentIcon } from '@lucide/vue'

import { subscribeUrl } from '../../data/pricingPlans'
import {
  formatTeamCreditsShort,
  teamCreditTiers
} from '../../data/teamCreditTiers'
import { t } from '../../i18n/translations'
import Button from '../ui/button/Button.vue'
import Slider from '../ui/slider/Slider.vue'
import PricingCard from './PricingCard.vue'
import PricingCredits from './PricingCredits.vue'
import PricingPlanFeatureList from './PricingPlanFeatureList.vue'
import PricingPlanLabel from './PricingPlanLabel.vue'
import PricingPrice from './PricingPrice.vue'

const { locale = 'en', billingPeriod } = defineProps<{
  billingPeriod: 'monthly' | 'yearly'
  locale?: Locale
}>()

const teamCreditTierIndex = ref<number[]>([2])

const selectedTeamTier = computed(
  () => teamCreditTiers[teamCreditTierIndex.value[0] ?? 0]
)
const selectedTeamPrice = computed(() => {
  const tier = selectedTeamTier.value
  return billingPeriod === 'yearly' ? tier.yearlyPrice : tier.monthlyPrice
})

function fmtPrice(n: number): string {
  return `$${n.toLocaleString('en-US')}`
}

const teamSaving = computed<string | undefined>(() => {
  const base = selectedTeamTier.value.basePrice
  const discounted = selectedTeamPrice.value
  if (base === discounted) return undefined
  // Round to 1 decimal so future tiers can't render repeating decimals
  // (e.g. 8.333333%), while preserving exact values like 2.5% / 7.5%.
  const pct = Math.round(((base - discounted) / base) * 1000) / 10
  return t('pricing.savePercent', locale)
    .replace('{pct}', String(pct))
    .replace('{amount}', fmtPrice(base - discounted))
})

const featureGroups: PlanFeatureGroup[] = [
  {
    titleKey: 'pricing.plan.team.everythingInProPlus',
    features: [
      { text: 'pricing.feature.inviteMembers' },
      { text: 'pricing.feature.concurrentWorkflows' },
      { text: 'pricing.feature.sharedCreditPool' },
      { text: 'pricing.feature.roleBasedPermissions' }
    ]
  },
  {
    titleKey: 'pricing.plan.team.comingSoon',
    features: [
      { text: 'pricing.plan.team.sharedWorkflowsAndAssets', status: 'coming' },
      { text: 'pricing.plan.team.projects', status: 'coming' }
    ]
  }
]

const ctaHref = computed(() =>
  subscribeUrl(
    'team',
    billingPeriod,
    `team_${selectedTeamTier.value.basePrice}`
  )
)
</script>

<template>
  <PricingCard class="col-span-full">
    <div class="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-20">
      <div class="lg:col-span-2 lg:max-w-xl">
        <div
          class="flex flex-col items-start gap-2 lg:flex-row lg:items-center lg:gap-4"
        >
          <PricingPlanLabel :label="t('pricing.plan.team.label', locale)" />
          <p class="text-primary-warm-gray text-sm">
            {{ t('pricing.team.description', locale) }}
          </p>
        </div>

        <PricingPrice
          :price="fmtPrice(selectedTeamPrice)"
          :period="t('pricing.plan.period', locale)"
          :original-price="
            selectedTeamTier.basePrice !== selectedTeamPrice
              ? fmtPrice(selectedTeamTier.basePrice)
              : undefined
          "
          :discount="teamSaving"
          :billing-period="billingPeriod"
          :yearly-total="fmtPrice(selectedTeamPrice * 12)"
          :locale
        />

        <div class="mt-6">
          <Slider
            v-model="teamCreditTierIndex"
            class="w-full"
            :min="0"
            :max="teamCreditTiers.length - 1"
            :step="1"
            :ticks="teamCreditTiers.length"
            :thumb-label="t('pricing.team.sliderLabel', locale)"
            :thumb-value-text="`${selectedTeamTier.credits.toLocaleString('en-US')} ${t('pricing.creditsLabel', locale)}, ${fmtPrice(selectedTeamPrice)} ${t('pricing.plan.period', locale)}`"
          >
            <template #tick="{ index, active }">
              <ComponentIcon
                class="hidden size-4 shrink-0 lg:block"
                :class="
                  active
                    ? 'text-primary-comfy-orange'
                    : 'text-primary-warm-gray'
                "
              />
              <span
                class="text-sm max-sm:text-[10px]"
                :class="
                  active ? 'text-primary-warm-white' : 'text-primary-warm-gray'
                "
              >
                {{ formatTeamCreditsShort(teamCreditTiers[index].credits) }}
              </span>
            </template>
          </Slider>
        </div>

        <PricingCredits
          :credits="selectedTeamTier.credits.toLocaleString('en-US')"
          :label="t('pricing.creditsLabel', locale)"
          estimate-key="pricing.team.videosEstimate"
          :estimate-count="selectedTeamTier.videos.toLocaleString('en-US')"
          :locale
        />
      </div>

      <div>
        <PricingPlanFeatureList :features="featureGroups" :locale />

        <div class="mt-8">
          <Button :href="ctaHref" class="w-full" variant="outline">
            {{ t('pricing.plan.team.cta', locale) }}
          </Button>
        </div>
      </div>
    </div>
  </PricingCard>
</template>
