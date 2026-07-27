<template>
  <h2 class="m-0 mb-8 text-center text-xl text-muted-foreground lg:text-2xl">
    {{ confirmTitle }}
  </h2>
  <div
    class="mx-auto flex h-full max-w-[400px] flex-col items-stretch justify-between text-sm"
  >
    <div>
      <!-- Plan Header -->
      <div class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-base-foreground">
          {{ newTierName }}
        </span>
        <div class="flex items-baseline gap-2">
          <span class="text-4xl font-semibold text-base-foreground">
            ${{ heroPrice }}
          </span>
          <span class="text-xl text-base-foreground">
            {{ $t('subscription.usdPerMonth') }}
          </span>
        </div>
        <template v-if="isImmediate">
          <span class="text-muted-foreground">
            {{
              newIsYearly
                ? $t('subscription.billedYearly', {
                    total: annualTotalFormatted
                  })
                : $t('subscription.billedMonthly')
            }}
          </span>
          <span class="text-muted-foreground">
            {{ $t('subscription.preview.switchesToday') }}
          </span>
        </template>
        <span v-else class="text-muted-foreground">
          {{
            $t('subscription.preview.startsOn', { date: effectiveDateLabel })
          }}
        </span>
      </div>

      <!-- Proration Line Items (immediate changes) -->
      <div v-if="isImmediate" class="flex flex-col gap-2 pt-10">
        <div class="flex items-center justify-between text-muted-foreground">
          <span>{{ subscriptionLineLabel }}</span>
          <span>{{ money(newPlanPriceUsd) }}</span>
        </div>
        <div
          v-if="prorationCreditUsd > 0"
          class="flex items-center justify-between text-muted-foreground"
        >
          <span>
            {{
              $t('subscription.preview.creditFromCurrent', {
                plan: creditFromPlanLabel
              })
            }}
          </span>
          <span>− {{ money(prorationCreditUsd) }}</span>
        </div>
      </div>

      <!-- Credits Refill (immediate changes) -->
      <div v-if="isImmediate" class="flex flex-col gap-2 pt-10">
        <div class="flex items-center justify-between">
          <span class="text-base-foreground">{{ refillLabel }}</span>
          <div class="flex items-center gap-1">
            <i class="icon-[comfy--credits] size-4 shrink-0 bg-credit" />
            <span class="font-bold text-base-foreground">{{
              refillCredits
            }}</span>
          </div>
        </div>
        <span v-if="newIsYearly" class="text-sm text-muted-foreground">
          {{ $t('subscription.preview.refillReplacesNote') }}
        </span>
      </div>

      <!-- After-That Block (scheduled changes) -->
      <div v-else class="flex flex-col gap-2 pt-10">
        <span
          class="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {{ $t('subscription.preview.afterThat') }}
        </span>
        <div class="flex items-center justify-between">
          <span class="text-base-foreground">
            {{ $t('subscription.preview.creditsRefillMonthlyTo') }}
          </span>
          <div class="flex items-center gap-1">
            <i class="icon-[comfy--credits] size-4 shrink-0 bg-credit" />
            <span class="font-bold text-base-foreground">{{
              monthlyRefillCredits
            }}</span>
          </div>
        </div>
        <span class="text-sm text-muted-foreground">
          {{
            $t('subscription.preview.billedEachMonth', {
              amount: moneyShort(newMonthlyChargeUsd)
            })
          }}
        </span>
      </div>

      <!-- Total Due -->
      <div class="mt-10 flex flex-col gap-2 border-t border-border-subtle pt-8">
        <div class="flex items-center justify-between text-base">
          <span class="text-base-foreground">
            {{ $t('subscription.preview.totalDueToday') }}
          </span>
          <span class="font-bold text-base-foreground">
            {{ money(totalDueTodayUsd) }}
          </span>
        </div>
        <span class="text-sm text-muted-foreground">{{ totalNote }}</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex flex-col gap-2 pt-8">
      <SubscriptionTermsNote />

      <Button
        variant="tertiary"
        size="lg"
        class="w-full rounded-lg"
        :loading="isLoading"
        @click="$emit('confirm')"
      >
        {{ confirmCta }}
      </Button>

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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import { getTierCredits } from '@/platform/cloud/subscription/constants/tierPricing'
import { isAnnualDuration } from '@/platform/cloud/subscription/utils/planDuration'
import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'

import SubscriptionTermsNote from './SubscriptionTermsNote.vue'

type PersonalTierKey = 'standard' | 'creator' | 'pro'

const {
  previewData,
  isLoading = false,
  teamPlan = null
} = defineProps<{
  previewData: PreviewSubscribeResponse
  isLoading?: boolean
  /** Set for a team credit-commit change: plan name + refill credits come from
   *  the selected slider stop; all proration money stays driven by previewData. */
  teamPlan?: TeamPlanSelection | null
}>()

defineEmits<{
  confirm: []
  back: []
}>()

const { t, n } = useI18n()

function formatTierName(tier: string): string {
  return t(`subscription.tiers.${tier.toLowerCase()}.name`)
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(dateStr))
}

function money(usd: number): string {
  return `$${usd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

function moneyShort(usd: number): string {
  return `$${n(usd)}`
}

function tierMonthlyCredits(tier: string): number {
  return getTierCredits(tier.toLowerCase() as PersonalTierKey) ?? 0
}

const isImmediate = computed(() => previewData.is_immediate)
const newIsYearly = computed(() =>
  isAnnualDuration(previewData.new_plan.duration)
)
const currentIsYearly = computed(() =>
  isAnnualDuration(previewData.current_plan?.duration)
)
const isCadenceChange = computed(
  () =>
    !!previewData.current_plan &&
    previewData.current_plan.duration !== previewData.new_plan.duration
)

const newTierName = computed(() =>
  teamPlan
    ? t('subscription.teamPlan.name')
    : formatTierName(previewData.new_plan.tier)
)
const currentTierName = computed(() =>
  previewData.current_plan ? formatTierName(previewData.current_plan.tier) : ''
)
const currentPlanLabel = computed(() =>
  currentIsYearly.value
    ? t('subscription.tierNameYearly', { name: currentTierName.value })
    : currentTierName.value
)

const newMonthlyUsd = computed(() => {
  const cents = previewData.new_plan.price_cents
  return (newIsYearly.value ? cents / 12 : cents) / 100
})
const heroPrice = computed(() => newMonthlyUsd.value.toFixed(0))

const annualTotalFormatted = computed(
  () => `$${n(previewData.new_plan.price_cents / 100)}`
)

const newPlanPriceUsd = computed(() => previewData.new_plan.price_cents / 100)
const prorationCreditUsd = computed(() => {
  const credit = previewData.new_plan.price_cents - previewData.cost_today_cents
  return credit > 0 ? credit / 100 : 0
})
const totalDueTodayUsd = computed(() => previewData.cost_today_cents / 100)
const newMonthlyChargeUsd = computed(() => newMonthlyUsd.value)

const subscriptionLineLabel = computed(() =>
  newIsYearly.value
    ? t('subscription.preview.yearlySubscription')
    : t('subscription.preview.newMonthlySubscription')
)
const creditFromPlanLabel = computed(() => {
  if (teamPlan) return t('subscription.preview.commitment')
  return isCadenceChange.value
    ? t('subscription.preview.currentMonthly')
    : currentTierName.value
})

const refillCredits = computed(() => {
  const monthly = teamPlan
    ? teamPlan.credits
    : tierMonthlyCredits(previewData.new_plan.tier)
  return n(newIsYearly.value ? monthly * 12 : monthly)
})
const monthlyRefillCredits = computed(() =>
  n(teamPlan ? teamPlan.credits : tierMonthlyCredits(previewData.new_plan.tier))
)
const refillLabel = computed(() =>
  newIsYearly.value
    ? t('subscription.preview.creditsYoullGetToday')
    : t('subscription.preview.eachMonthCreditsRefill')
)

const effectiveDateLabel = computed(() => formatDate(previewData.effective_at))
const nextPaymentDate = computed(() =>
  previewData.new_plan.period_end
    ? formatDate(previewData.new_plan.period_end)
    : effectiveDateLabel.value
)
const currentPeriodEnd = computed(() =>
  previewData.current_plan?.period_end
    ? formatDate(previewData.current_plan.period_end)
    : effectiveDateLabel.value
)

const confirmTitle = computed(() =>
  isImmediate.value
    ? t('subscription.preview.confirmUpgradeTitle')
    : t('subscription.preview.confirmChangeTitle')
)
const confirmCta = computed(() =>
  isImmediate.value
    ? t('subscription.preview.confirmUpgradeCta')
    : t('subscription.preview.confirmChange')
)
const totalNote = computed(() =>
  isImmediate.value
    ? t('subscription.preview.nextPaymentDue', { date: nextPaymentDate.value })
    : t('subscription.preview.stayOnUntil', {
        plan: currentPlanLabel.value,
        date: currentPeriodEnd.value
      })
)
</script>
