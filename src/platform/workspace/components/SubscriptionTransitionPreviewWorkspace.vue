<template>
  <h2 class="m-0 mb-8 text-center text-xl text-muted-foreground lg:text-2xl">
    {{ confirmTitle }}
  </h2>
  <div
    class="mx-auto flex h-full max-w-[400px] flex-col items-stretch justify-between text-sm"
  >
    <div>
      <div
        v-if="isReactivating"
        class="mb-6 flex gap-3 rounded-2xl border border-warning-background bg-warning-background/20 p-4"
      >
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-full text-warning-background"
        >
          <i class="pi pi-info-circle" />
        </div>
        <div class="flex flex-col gap-2">
          <p class="m-0 text-sm font-bold text-base-foreground">
            {{ bannerTitle }}
          </p>
          <p class="m-0 text-sm text-muted-foreground">
            <i18n-t :keypath="bannerBodyKey" tag="span">
              <template #plan>{{ currentTierName }}</template>
              <template #date>{{ cancelDate }}</template>
              <template #newPlan>{{ newTierName }}</template>
              <template #nextDate>{{ nextPaymentDate }}</template>
              <template #amount>
                <span
                  :class="
                    cn(
                      'font-bold text-base-foreground',
                      exceedsMonthlyThreshold && 'text-base font-extrabold'
                    )
                  "
                  >{{ chargeDisplay }}</span
                >
              </template>
            </i18n-t>
          </p>
          <label
            v-if="exceedsMonthlyThreshold"
            class="flex items-center gap-2 pt-1 text-sm text-muted-foreground"
          >
            <input
              v-model="reactivationConfirmed"
              type="checkbox"
              class="size-4 rounded-sm border-interface-stroke"
            />
            {{
              $t('subscription.preview.reactivation.checkboxLabel', {
                amount: chargeDisplay
              })
            }}
          </label>
        </div>
      </div>

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
            {{
              $t(
                newIsYearly
                  ? 'subscription.preview.eachYearCreditsRefill'
                  : 'subscription.preview.creditsRefillMonthlyTo'
              )
            }}
          </span>
          <div class="flex items-center gap-1">
            <i class="icon-[comfy--credits] size-4 shrink-0 bg-credit" />
            <span class="font-bold text-base-foreground">{{
              refillCredits
            }}</span>
          </div>
        </div>
        <span class="text-sm text-muted-foreground">
          {{
            newIsYearly
              ? $t('subscription.billedYearly', {
                  total: annualTotalFormatted
                })
              : $t('subscription.preview.billedEachMonth', {
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
        v-if="actionUrl"
        variant="primary"
        size="lg"
        class="w-full rounded-lg"
        @click="openVerification"
      >
        {{ $t('subscription.preview.completeVerification') }}
      </Button>

      <Button
        variant="tertiary"
        size="lg"
        class="w-full rounded-lg"
        :loading="isLoading"
        :disabled="confirmDisabled"
        @click="$emit('confirm', confirmReactivation)"
      >
        {{ confirmCta }}
      </Button>

      <Button
        variant="textonly"
        class="cursor-pointer text-center text-xs text-muted-foreground transition-colors hover:bg-none hover:text-base-foreground"
        :disabled="isLoading"
        @click="$emit('back')"
      >
        {{ $t('subscription.preview.backToAllPlans') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatUsdFromCents } from '@/base/credits/comfyCredits'
import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import { getTierCredits } from '@/platform/cloud/subscription/constants/tierPricing'
import { isAnnualDuration } from '@/platform/cloud/subscription/utils/planDuration'
import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'

import SubscriptionTermsNote from './SubscriptionTermsNote.vue'

type PersonalTierKey = 'standard' | 'creator' | 'pro'

const {
  previewData,
  isLoading = false,
  teamPlan = null,
  actionUrl = null,
  forceReactivation = false
} = defineProps<{
  previewData: PreviewSubscribeResponse
  isLoading?: boolean
  /** Set for a team credit-commit change: plan name + refill credits come from
   *  the selected slider stop; all proration money stays driven by previewData. */
  teamPlan?: TeamPlanSelection | null
  actionUrl?: string | null
  /** Server-authoritative fallback for legacy status reads that omit a
   * scheduled cancellation until subscribe enforces the consent gate. */
  forceReactivation?: boolean
}>()

defineEmits<{
  /** True only once the reactivation banner was shown and confirmed (checkbox
   *  ticked above the charge threshold, since confirmDisabled gates the button). */
  confirm: [confirmReactivation: boolean]
  back: []
}>()

const { t, n } = useI18n()
const { subscription } = useBillingContext()

function openVerification() {
  if (!actionUrl) return
  window.open(actionUrl, '_blank', 'noopener,noreferrer')
}

function formatTierName(tier: string): string {
  return t(`subscription.tiers.${tier.toLowerCase()}.name`)
}

function isTeamTier(tier: string): boolean {
  return tier.toUpperCase() === 'TEAM'
}

function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(typeof date === 'string' ? new Date(date) : date)
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
const currentTierName = computed(() => {
  const tier = previewData.current_plan?.tier
  if (!tier) return ''
  return isTeamTier(tier)
    ? t('subscription.teamPlan.name')
    : formatTierName(tier)
})
const currentPlanLabel = computed(() =>
  currentIsYearly.value
    ? t('subscription.tierNameYearly', { name: currentTierName.value })
    : currentTierName.value
)

const isCancelled = computed(
  () => forceReactivation || (subscription.value?.isCancelled ?? false)
)

const reactivationVariant = computed<
  'upgrade' | 'downgrade' | 'duration_change' | null
>(() => {
  if (!isCancelled.value) return null
  switch (previewData.transition_type) {
    case 'upgrade':
      return 'upgrade'
    case 'downgrade':
      return 'downgrade'
    case 'duration_change':
      return 'duration_change'
    default:
      return null
  }
})
// Requires the data the banner and threshold math actually read
// (subscription.endDate, previewData.current_plan) — without it the banner
// would render broken copy or force the checkbox on a bogus $0 threshold.
const cancelAt = computed(
  () => subscription.value?.endDate ?? previewData.current_plan?.period_end
)

const isReactivating = computed(
  () =>
    isCancelled.value &&
    reactivationVariant.value !== null &&
    !!cancelAt.value &&
    !!previewData.current_plan
)

const cancelDate = computed(() =>
  cancelAt.value ? formatDate(cancelAt.value) : ''
)

// seat_summary.total_cost_cents is the whole-subscription price; price_cents
// is per-seat and understates the threshold on multi-seat team plans. Divide
// ANNUAL by 12 to get a monthly-equivalent, matching
// PricingTableWorkspace's getPriceFromApi.
const currentMonthlyPriceCents = computed(() => {
  const plan = previewData.current_plan
  if (!plan) return 0
  const totalCents = plan.seat_summary.total_cost_cents
  return currentIsYearly.value ? totalCents / 12 : totalCents
})
const chargeCents = computed(() => previewData.cost_today_cents)
// The downgrade variant's copy always says "you won't be charged today" with
// no amount shown, so it never gets the checkbox even if cost_today_cents is
// unexpectedly positive.
const exceedsMonthlyThreshold = computed(
  () =>
    isReactivating.value &&
    reactivationVariant.value !== 'downgrade' &&
    chargeCents.value > currentMonthlyPriceCents.value
)
const chargeDisplay = computed(
  () => `$${formatUsdFromCents({ cents: chargeCents.value })}`
)

const reactivationConfirmed = ref(false)
// A checked box is consent to this exact preview. A replacement preview must
// not inherit that consent, even when its displayed charge is unchanged.
watch(
  () => previewData,
  () => {
    reactivationConfirmed.value = false
  }
)

// isInitialized is aggregate (status + balance + plans); a balance or plans
// failure must not permanently disable an otherwise-valid, already-loaded
// subscription status. subscription is null exactly until status has loaded
// at least once, so gate on that instead.
const confirmDisabled = computed(
  () =>
    subscription.value === null ||
    (exceedsMonthlyThreshold.value && !reactivationConfirmed.value)
)
const confirmReactivation = computed(
  () =>
    isReactivating.value &&
    (!exceedsMonthlyThreshold.value || reactivationConfirmed.value)
)

const bannerTitle = computed(() =>
  reactivationVariant.value === 'duration_change' && newIsYearly.value
    ? t('subscription.preview.reactivation.titleAnnual')
    : t('subscription.preview.reactivation.title')
)
const bannerBodyKey = computed<string>(() => {
  switch (reactivationVariant.value) {
    case 'upgrade':
      return 'subscription.preview.reactivation.upgradeBody'
    case 'downgrade':
      return 'subscription.preview.reactivation.downgradeBody'
    case 'duration_change':
      return newIsYearly.value
        ? 'subscription.preview.reactivation.durationChangeBody'
        : 'subscription.preview.reactivation.durationChangeBodyMonthly'
    default:
      return ''
  }
})

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
const refillLabel = computed(() =>
  newIsYearly.value
    ? t('subscription.preview.creditsYoullGetToday')
    : t('subscription.preview.eachMonthCreditsRefill')
)

const effectiveDateLabel = computed(() => formatDate(previewData.effective_at))
// Date.setUTCMonth rolls a day-of-month past the target month's end into the
// following month (e.g. Jan 31 + 1mo => Mar 3); clamp to the target month's
// last day instead.
function addUtcMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear()
  const targetMonthIndex = date.getUTCMonth() + months
  const lastDayOfTargetMonth = new Date(
    Date.UTC(year, targetMonthIndex + 1, 0)
  ).getUTCDate()
  return new Date(
    Date.UTC(
      year,
      targetMonthIndex,
      Math.min(date.getUTCDate(), lastDayOfTargetMonth)
    )
  )
}
// Without an explicit period_end, fall back to one billing period after
// activation rather than the activation date itself — the activation date
// reads as "renews today" for an immediate reactivation, which is wrong.
const nextPaymentDate = computed(() => {
  if (previewData.new_plan.period_end) {
    return formatDate(previewData.new_plan.period_end)
  }
  const fallback = addUtcMonthsClamped(
    new Date(previewData.effective_at),
    newIsYearly.value ? 12 : 1
  )
  return formatDate(fallback)
})
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
const confirmCta = computed(() => {
  // Gated on isReactivating, not reactivationVariant: the banner and the
  // emitted confirmReactivation use the same stricter gate, so the label
  // must never promise a reactivation the click won't actually confirm.
  if (!isReactivating.value) {
    return isImmediate.value
      ? t('subscription.preview.confirmUpgradeCta')
      : t('subscription.preview.confirmChange')
  }
  if (reactivationVariant.value === 'downgrade') {
    return t('subscription.preview.reactivation.confirmButton')
  }
  return t('subscription.preview.reactivation.confirmButtonWithCharge', {
    amount: chargeDisplay.value
  })
})
const totalNote = computed(() =>
  isImmediate.value
    ? t('subscription.preview.nextPaymentDue', { date: nextPaymentDate.value })
    : t('subscription.preview.stayOnUntil', {
        plan: currentPlanLabel.value,
        date: currentPeriodEnd.value
      })
)
</script>
