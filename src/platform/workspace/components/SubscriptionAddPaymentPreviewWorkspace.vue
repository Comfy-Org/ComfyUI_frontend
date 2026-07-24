<template>
  <h2 class="m-0 mb-8 text-center text-xl text-muted-foreground lg:text-2xl">
    {{ $t('subscription.preview.confirmPayment') }}
  </h2>
  <div
    class="mx-auto flex h-full max-w-[400px] flex-col items-stretch justify-between text-sm"
  >
    <div class="">
      <!-- Plan Header -->
      <div class="flex flex-col gap-2">
        <span class="text-sm text-base-foreground">
          {{ tierName }}
        </span>
        <div class="flex items-baseline gap-2">
          <span class="text-4xl font-semibold text-base-foreground">
            ${{ displayPrice }}
          </span>
          <span class="text-xl text-base-foreground">
            {{ $t('subscription.usdPerMonth') }}
          </span>
        </div>
        <span class="text-muted-foreground">
          {{
            isYearly
              ? $t('subscription.billedYearly', { total: annualTotalFormatted })
              : $t('subscription.billedMonthly')
          }}
        </span>
        <span class="text-muted-foreground">
          {{ $t('subscription.preview.startingToday') }}
        </span>
      </div>

      <!-- Credits Section -->
      <div class="flex flex-col gap-3 pt-16 pb-8">
        <div class="flex items-center justify-between">
          <span class="text-base-foreground">
            {{ $t(creditsRefillLabelKey) }}
          </span>
          <div class="flex items-center gap-1">
            <i class="icon-[comfy--credits] size-4 shrink-0 bg-credit" />
            <span class="font-bold text-base-foreground">
              {{ refillCredits }}
            </span>
          </div>
        </div>

        <!-- Expandable Features -->
        <button
          class="flex cursor-pointer items-center justify-end gap-1 border-none bg-transparent p-0 text-sm text-muted-foreground hover:text-base-foreground"
          @click="isFeaturesCollapsed = !isFeaturesCollapsed"
        >
          <span>
            {{
              isFeaturesCollapsed
                ? $t('subscription.preview.showMoreFeatures')
                : $t('subscription.preview.hideFeatures')
            }}
          </span>
          <i
            :class="
              cn(
                'pi text-xs',
                isFeaturesCollapsed ? 'pi-chevron-down' : 'pi-chevron-up'
              )
            "
          />
        </button>
        <div v-show="!isFeaturesCollapsed" class="flex flex-col gap-2 pt-2">
          <template v-if="teamPlan">
            <div
              v-for="perk in teamPerks"
              :key="perk"
              class="flex items-center gap-2"
            >
              <i class="pi pi-check text-success-foreground text-xs" />
              <span class="text-sm text-base-foreground">{{ perk }}</span>
            </div>
          </template>
          <template v-else>
            <div class="flex items-center justify-between">
              <span class="text-sm text-base-foreground">
                {{ $t('subscription.maxDurationLabel') }}
              </span>
              <span class="text-sm font-bold text-base-foreground">
                {{ maxDuration }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-base-foreground">
                {{ $t('subscription.gpuLabel') }}
              </span>
              <i class="pi pi-check text-success-foreground text-xs" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-base-foreground">
                {{ $t('subscription.addCreditsLabel') }}
              </span>
              <i class="pi pi-check text-success-foreground text-xs" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-base-foreground">
                {{ $t('subscription.customLoRAsLabel') }}
              </span>
              <i
                v-if="hasCustomLoRAs"
                class="pi pi-check text-success-foreground text-xs"
              />
              <i v-else class="pi pi-times text-xs text-muted-foreground" />
            </div>
          </template>
        </div>
      </div>

      <!-- Total Due Section -->
      <div class="flex flex-col gap-2 border-t border-border-subtle pt-8">
        <div class="flex items-center justify-between text-base">
          <span class="text-base-foreground">
            {{ $t('subscription.preview.totalDueToday') }}
          </span>
          <span class="font-bold text-base-foreground">
            ${{ totalDueToday }}
          </span>
        </div>
        <span class="text-sm text-muted-foreground">
          {{
            $t('subscription.preview.nextPaymentDue', {
              date: nextPaymentDate
            })
          }}
        </span>
      </div>
    </div>
    <!-- Footer -->
    <div class="flex flex-col gap-2 pt-8">
      <!-- Terms Agreement -->
      <SubscriptionTermsNote />

      <!-- Add Credit Card Button -->
      <Button
        variant="tertiary"
        size="lg"
        class="w-full rounded-lg"
        :loading="isLoading"
        @click="$emit('addCreditCard')"
      >
        {{ $t('subscription.preview.subscribeToPlan', { plan: tierName }) }}
      </Button>

      <!-- Back Link -->
      <Button
        variant="textonly"
        class="cursor-pointer text-center text-xs text-muted-foreground transition-colors hover:bg-none hover:text-base-foreground"
        @click="$emit('back')"
      >
        {{ $t('subscription.preview.backToAllPlans') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import {
  getTierCredits,
  getTierFeatures,
  getTierPrice
} from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import { isYearlyCheckout } from '@/platform/cloud/subscription/utils/planDuration'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'
import { cn } from '@comfyorg/tailwind-utils'

import SubscriptionTermsNote from './SubscriptionTermsNote.vue'

interface Props {
  /** Personal-tier checkout. Required unless `teamPlan` is set. */
  tierKey?: Exclude<TierKey, 'free' | 'founder'>
  billingCycle?: BillingCycle
  isLoading?: boolean
  previewData?: PreviewSubscribeResponse | null
  /** Team-plan checkout (selected slider stop); overrides tier-derived display. */
  teamPlan?: TeamPlanSelection | null
}

const {
  tierKey,
  billingCycle = 'monthly',
  isLoading = false,
  previewData = null,
  teamPlan = null
} = defineProps<Props>()

defineEmits<{
  addCreditCard: []
  back: []
}>()

const { t, n } = useI18n()

const isFeaturesCollapsed = ref(true)

const tierName = computed(() =>
  teamPlan
    ? t('subscription.teamPlan.name')
    : t(`subscription.tiers.${tierKey}.name`)
)

const isYearly = computed(() =>
  isYearlyCheckout(previewData?.new_plan.duration, billingCycle)
)

const displayPrice = computed(() => {
  if (teamPlan) return teamPlan.discountedUsd
  if (previewData?.new_plan) {
    const cents = previewData.new_plan.price_cents
    return ((isYearly.value ? cents / 12 : cents) / 100).toFixed(0)
  }
  return tierKey ? getTierPrice(tierKey, isYearly.value) : 0
})

const annualTotalUsd = computed(() => {
  if (teamPlan) return teamPlan.discountedUsd * 12
  if (previewData?.new_plan) return previewData.new_plan.price_cents / 100
  return tierKey ? getTierPrice(tierKey, true) * 12 : 0
})

const annualTotalFormatted = computed(() => `$${n(annualTotalUsd.value)}`)

const monthlyCredits = computed(() =>
  teamPlan ? teamPlan.credits : tierKey ? (getTierCredits(tierKey) ?? 0) : 0
)

const refillCredits = computed(() =>
  n(isYearly.value ? monthlyCredits.value * 12 : monthlyCredits.value)
)

const creditsRefillLabelKey = computed(() =>
  isYearly.value
    ? 'subscription.preview.eachYearCreditsRefill'
    : 'subscription.preview.eachMonthCreditsRefill'
)

const teamPerks = computed(() => [
  t('subscription.teamPlan.perkInviteMembers'),
  t('subscription.teamPlan.perkConcurrentRuns'),
  t('subscription.teamPlan.perkSharedPool'),
  t('subscription.teamPlan.perkRolePermissions')
])

const hasCustomLoRAs = computed(() =>
  tierKey ? getTierFeatures(tierKey).customLoRAs : false
)
const maxDuration = computed(() => t(`subscription.maxDuration.${tierKey}`))

const totalDueToday = computed(() => {
  if (teamPlan) {
    const total = isYearly.value
      ? teamPlan.discountedUsd * 12
      : teamPlan.discountedUsd
    return total.toFixed(2)
  }
  if (previewData) {
    return (previewData.cost_today_cents / 100).toFixed(2)
  }
  if (!tierKey) return '0.00'
  const priceValue = getTierPrice(tierKey, isYearly.value)
  return (isYearly.value ? priceValue * 12 : priceValue).toFixed(2)
})

const nextPaymentDate = computed(() => {
  if (previewData?.new_plan?.period_end) {
    return new Date(previewData.new_plan.period_end).toLocaleDateString(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }
    )
  }
  const date = new Date()
  if (billingCycle === 'yearly') {
    date.setFullYear(date.getFullYear() + 1)
  } else {
    date.setMonth(date.getMonth() + 1)
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
})
</script>
