<template>
  <div
    :class="
      cn(
        '@container relative flex flex-col gap-6 rounded-2xl border bg-card px-6 py-5',
        inactivePlan && 'text-muted-foreground'
      )
    "
  >
    <Button
      variant="muted-textonly"
      size="icon-sm"
      class="absolute top-4 right-4"
      :loading="isLoadingBalance"
      :aria-label="$t('subscription.refreshCredits')"
      @click="handleRefresh"
    >
      <i class="icon-[lucide--refresh-cw] text-muted-foreground" />
    </Button>

    <div class="flex flex-col gap-1">
      <div class="text-sm text-muted-foreground">
        {{ $t('subscription.totalCredits') }}
      </div>
      <Skeleton v-if="isLoadingBalance" class="h-8 w-32" />
      <div v-else class="flex items-baseline gap-2">
        <i
          :class="
            cn(
              'icon-[lucide--coins] self-center',
              !inactivePlan && 'text-credit'
            )
          "
        />
        <span class="text-2xl leading-none font-bold">{{ displayTotal }}</span>
        <span class="text-sm text-muted-foreground @max-[300px]:hidden">{{
          $t('subscription.remaining')
        }}</span>
      </div>
    </div>

    <template v-if="showBreakdown">
      <div
        v-if="emptyStateNotice"
        class="flex items-start gap-2 rounded-lg bg-background p-3 text-sm"
      >
        <i class="mt-0.5 icon-[lucide--info] shrink-0 text-foreground" />
        <div class="flex flex-col gap-1">
          <span class="text-foreground">{{ emptyStateNotice.title }}</span>
          <span class="text-muted-foreground">{{
            emptyStateNotice.description
          }}</span>
        </div>
      </div>

      <div
        v-if="showBar"
        :class="cn('flex flex-col gap-2', isMonthlyDepleted && 'opacity-30')"
      >
        <div class="flex items-center justify-between text-sm">
          <span class="text-foreground">{{ allowanceLabel }}</span>
          <span class="text-muted-foreground">
            {{ refillsLabel }}
          </span>
        </div>
        <div
          role="progressbar"
          :aria-valuenow="usage.used"
          :aria-valuemin="0"
          :aria-valuemax="creditPoolTotalCredits ?? 0"
          :aria-valuetext="monthlyUsageLabel"
          class="h-2 w-full overflow-hidden rounded-full bg-accent"
        >
          <div
            class="h-full rounded-full bg-credit"
            :style="{ width: usedBarWidth }"
          />
        </div>
        <div class="flex items-center justify-between gap-2 text-sm">
          <Skeleton
            v-if="isLoadingBalance"
            class="h-4 w-20 @max-[300px]:hidden"
          />
          <span v-else class="text-muted-foreground @max-[300px]:hidden">
            {{ $t('subscription.creditsUsed', { used: usedDisplay }) }}
          </span>
          <Skeleton v-if="isLoadingBalance" class="h-4 w-36" />
          <span
            v-else
            class="flex items-center gap-1 font-bold text-foreground"
          >
            <i class="icon-[lucide--coins] text-credit" />
            <span class="@max-[180px]:hidden">
              {{
                $t('subscription.creditsLeftOfTotal', {
                  remaining: monthlyRemainingDisplay,
                  total: creditPoolTotalDisplay
                })
              }}
            </span>
            <span class="hidden @max-[180px]:inline">
              {{
                $t('subscription.creditsLeftOfTotal', {
                  remaining: monthlyRemainingCompact,
                  total: creditPoolTotalCompact
                })
              }}
            </span>
          </span>
        </div>
      </div>

      <div class="h-px w-full bg-border" />

      <div class="flex flex-col gap-2 text-sm">
        <div
          class="flex items-center justify-between gap-2 @max-[300px]:flex-col @max-[300px]:items-start"
        >
          <span class="flex items-center gap-1 text-foreground">
            {{ $t('subscription.additionalCredits') }}
            <Button
              :tooltip="$t('subscription.additionalCreditsTooltip')"
              variant="muted-textonly"
              size="icon-sm"
              :aria-label="$t('subscription.additionalCreditsInfo')"
            >
              <i class="icon-[lucide--info]" />
            </Button>
            <span
              v-if="isSpendingAdditional"
              class="flex h-3.5 items-center rounded-full bg-foreground px-1 text-2xs/none font-semibold text-background uppercase"
            >
              {{ $t('subscription.additionalCreditsInUse') }}
            </span>
          </span>
          <Skeleton v-if="isLoadingBalance" class="h-4 w-12" />
          <span
            v-else
            class="flex items-center gap-1 font-bold text-foreground"
          >
            <i class="icon-[lucide--coins] text-credit" />
            {{ displayPrepaid }}
          </span>
        </div>
        <span
          v-if="!isDurationUnknown"
          class="text-muted-foreground @max-[300px]:hidden"
        >
          {{ usedAfterAllowanceLabel }}
        </span>
      </div>
    </template>

    <template v-else-if="showsInactivePlanState">
      <div class="h-px w-full bg-border" />
      <div class="flex flex-col gap-2 text-sm">
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-1">
            {{ $t('subscription.additionalCredits') }}
            <Button
              :tooltip="$t('subscription.additionalCreditsTooltip')"
              variant="muted-textonly"
              size="icon-sm"
              :aria-label="$t('subscription.additionalCreditsInfo')"
            >
              <i class="icon-[lucide--info]" />
            </Button>
          </span>
          <span class="flex items-center gap-1 font-bold">
            <i class="icon-[lucide--coins]" />
            {{ displayPrepaid }}
          </span>
        </div>
        <span>
          {{ inactiveCreditsNote }}
        </span>
      </div>
    </template>

    <div v-if="canTopUp" class="flex flex-col gap-3">
      <Button
        :variant="isOutOfCredits ? 'inverted' : 'secondary'"
        size="lg"
        :class="
          cn(
            'w-full font-normal',
            !isOutOfCredits && 'bg-muted text-foreground'
          )
        "
        :data-dd-action-name="BILLING_ACTION_NAME.addCreditsTile"
        @click="handleAddCredits"
      >
        {{ $t('subscription.addCredits') }}
      </Button>
      <span v-if="creditsUseNote" class="text-sm text-muted-foreground">
        {{ creditsUseNote }}
      </span>
    </div>
    <div v-else-if="paymentRecoveryAvailable" class="flex flex-col gap-3">
      <Button
        :variant="isOutOfCredits ? 'inverted' : 'secondary'"
        size="lg"
        :class="
          cn(
            'w-full font-normal',
            !isOutOfCredits && 'bg-muted text-foreground'
          )
        "
        :data-dd-action-name="BILLING_ACTION_NAME.addCreditsTile"
        @click="handleAddCredits"
      >
        {{ $t('subscription.addCredits') }}
      </Button>
      <span v-if="creditsUseNote" class="text-sm text-muted-foreground">
        {{ creditsUseNote }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BILLING_ACTION_NAME } from '@/platform/telemetry/billingActionNames'
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener } from '@vueuse/core'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'

import {
  formatCredits,
  formatCreditsFromCents
} from '@/base/credits/comfyCredits'
import Button from '@comfyorg/design-system/button/Button'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useSubscriptionCredits } from '@/platform/billing/subscription/composables/useSubscriptionCredits'
import {
  DEFAULT_TIER_KEY,
  isSalesManagedTier,
  toTierKey,
  getTierCredits
} from '@/platform/billing/subscription/constants/tierPricing'
import { computeMonthlyUsage } from '@/platform/billing/subscription/utils/creditsProgress'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { paymentIntentSourceForAddCreditsClick } from '@/platform/telemetry/utils/paymentIntentSource'
import { usePendingTopup } from '@/platform/billing/composables/usePendingTopup'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useCustomerEventsService } from '@/services/customerEventsService'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'

const { zeroState = false, inactivePlan } = defineProps<{
  /** Hides the plan breakdown. The total stays the server balance. */
  zeroState?: boolean
  inactivePlan?: boolean
}>()

const { locale, t } = useI18n()

const {
  subscription,
  balance,
  canAccessSubscriptionFeatures,
  currentTeamCreditStop,
  subscriptionStatus,
  fetchBalance,
  fetchStatus
} = useBillingContext()
const { canTopUp, paymentRecoveryAvailable } = useBillingCapabilities()
const {
  prepaidCredits,
  totalCredits,
  monthlyBonusCreditsValue,
  prepaidCreditsValue,
  isLoadingBalance
} = useSubscriptionCredits()
const { wrapWithErrorHandlingAsync } = useErrorHandling()
const customerEventsService = useCustomerEventsService()
const { showTopUpCreditsDialog } = useBillingDialogs()
const telemetry = useTelemetry()
const { pendingTopupNeedsRefresh, consumeCompletedTopup } = usePendingTopup()

const tierKey = computed(() => {
  const tier = subscription.value?.tier
  if (!tier) return DEFAULT_TIER_KEY
  return toTierKey(tier) ?? DEFAULT_TIER_KEY
})

const isAnnualBilling = computed(
  () => subscription.value?.duration === 'ANNUAL'
)

// Paid plan with no reported duration: the allowance cycle is unknown, so no
// total is shown rather than guessing monthly. Free has no duration by design,
// and Founders Edition is a fixed monthly grant.
const isDurationUnknown = computed(
  () =>
    !!subscription.value?.tier &&
    !subscription.value.duration &&
    tierKey.value !== 'free' &&
    tierKey.value !== 'founder'
)

const creditPoolTotalCredits = computed<number | null>(() => {
  if (isDurationUnknown.value) return null
  const monthlyCredits =
    currentTeamCreditStop.value?.credits_monthly ??
    (isSalesManagedTier(subscription.value?.tier)
      ? null
      : getTierCredits(tierKey.value))
  if (monthlyCredits === null) return null
  return isAnnualBilling.value ? monthlyCredits * 12 : monthlyCredits
})

const showsInactivePlanState = computed(() => inactivePlan === true)

const inactiveCreditsNote = computed(() => {
  if (!isSalesManagedTier(subscription.value?.tier))
    return t('subscription.reactivateToUseCredits')
  return prepaidCreditsValue.value > 0
    ? t('subscription.salesManagedInactiveCreditsNote')
    : t('subscription.salesManagedCreditsEndedNote')
})

const usage = computed(() =>
  computeMonthlyUsage(
    monthlyBonusCreditsValue.value,
    creditPoolTotalCredits.value ?? 0
  )
)

const refillsDateShort = computed(() => {
  const raw = subscription.value?.renewalDate
  if (!raw) return ''
  const date = new Date(raw)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(locale.value, { month: 'short', day: 'numeric' })
})

const hasRefillsDate = computed(() => refillsDateShort.value !== '')

const refillsLabel = computed(() =>
  hasRefillsDate.value
    ? t('subscription.refillsDate', { date: refillsDateShort.value })
    : t('subscription.refillsNextCycle')
)

const allowanceLabel = computed(() =>
  t(isAnnualBilling.value ? 'subscription.yearly' : 'subscription.monthly')
)

const usedAfterAllowanceLabel = computed(() =>
  t(
    isAnnualBilling.value
      ? 'subscription.usedAfterYearly'
      : 'subscription.usedAfterMonthly'
  )
)

const formatCreditCount = (value: number) =>
  formatCredits({
    value,
    locale: locale.value,
    numberOptions: { maximumFractionDigits: 0 }
  })

const creditPoolTotalDisplay = computed(() => {
  const total = creditPoolTotalCredits.value
  return total === null ? '—' : formatCreditCount(total)
})

const usedDisplay = computed(() => formatCreditCount(usage.value.used))
const monthlyRemainingDisplay = computed(() =>
  formatCreditCount(usage.value.remaining)
)

const compactNumber = computed(
  () => new Intl.NumberFormat(locale.value, { notation: 'compact' })
)
const monthlyRemainingCompact = computed(() =>
  compactNumber.value.format(usage.value.remaining)
)
const creditPoolTotalCompact = computed(() => {
  const total = creditPoolTotalCredits.value
  return total === null ? '—' : compactNumber.value.format(total)
})

const displayTotal = computed(() => {
  if (showsInactivePlanState.value) return formatCreditCount(0)
  if (!zeroState) return totalCredits.value
  const cents =
    balance.value?.effectiveBalanceMicros ?? balance.value?.amountMicros ?? 0
  return formatCreditsFromCents({
    cents,
    locale: locale.value,
    numberOptions: { minimumFractionDigits: 0, maximumFractionDigits: 0 }
  })
})
// An ended sales-managed plan retains its prepaid balance: the note beside
// this number says the credits become spendable once the plan is restored,
// so the amount must survive the inactive state rather than read 0.
const retainsPrepaidWhileInactive = computed(() =>
  isSalesManagedTier(subscription.value?.tier)
)
const displayPrepaid = computed(() => {
  if (zeroState) return formatCreditCount(0)
  if (showsInactivePlanState.value && !retainsPrepaidWhileInactive.value) {
    return formatCreditCount(0)
  }
  return prepaidCredits.value
})
const usedBarWidth = computed(
  () => `${(usage.value.usedFraction * 100).toFixed(2)}%`
)
const monthlyUsageLabel = computed(() =>
  t(
    isAnnualBilling.value
      ? 'subscription.yearlyUsageProgress'
      : 'subscription.monthlyUsageProgress',
    {
      used: usedDisplay.value,
      total: creditPoolTotalDisplay.value
    }
  )
)

const showBreakdown = computed(
  () =>
    canAccessSubscriptionFeatures.value &&
    !zeroState &&
    !showsInactivePlanState.value
)
// The monthly allowance bar is a Cloud-only presentation; Local/Desktop shows
// only the total and additional-credit balances.
const showBar = computed(
  () =>
    isCloud &&
    showBreakdown.value &&
    creditPoolTotalCredits.value !== null &&
    creditPoolTotalCredits.value > 0
)
const creditsUseNote = computed(() => {
  if (
    !isCloud ||
    canAccessSubscriptionFeatures.value ||
    zeroState ||
    showsInactivePlanState.value
  ) {
    return null
  }
  return t(
    subscriptionStatus.value === 'ended'
      ? 'subscription.resubscribeToUseCredits'
      : 'subscription.subscribeToUseCredits'
  )
})

const isMonthlyDepleted = computed(
  () =>
    showBar.value &&
    !isLoadingBalance.value &&
    balance.value != null &&
    monthlyBonusCreditsValue.value <= 0
)
// Depletion needs only the remaining allowance, not its cycle, so the
// cycle-neutral signals still work when the duration is unknown.
const isAllowanceDepleted = computed(
  () =>
    isMonthlyDepleted.value ||
    (isDurationUnknown.value &&
      isCloud &&
      showBreakdown.value &&
      !isLoadingBalance.value &&
      balance.value != null &&
      monthlyBonusCreditsValue.value <= 0)
)
const isOutOfCredits = computed(
  () => isAllowanceDepleted.value && prepaidCreditsValue.value <= 0
)
const isSpendingAdditional = computed(
  () => isAllowanceDepleted.value && prepaidCreditsValue.value > 0
)

const emptyStateNotice = computed(() => {
  if (isOutOfCredits.value) {
    return {
      title: hasRefillsDate.value
        ? t('subscription.outOfCreditsTitle', { date: refillsDateShort.value })
        : t('subscription.outOfCreditsTitleNoDate'),
      description: t('subscription.outOfCreditsDescription')
    }
  }
  if (isMonthlyDepleted.value) {
    return {
      title: hasRefillsDate.value
        ? t(
            isAnnualBilling.value
              ? 'subscription.yearlyCreditsUsedUpTitle'
              : 'subscription.monthlyCreditsUsedUpTitle',
            {
              date: refillsDateShort.value
            }
          )
        : t(
            isAnnualBilling.value
              ? 'subscription.yearlyCreditsUsedUpTitleNoDate'
              : 'subscription.monthlyCreditsUsedUpTitleNoDate'
          ),
      description: t('subscription.monthlyCreditsUsedUpDescription')
    }
  }
  return null
})

async function refreshCredits() {
  const results = await Promise.allSettled([fetchBalance(), fetchStatus()])
  for (const result of results) {
    if (result.status === 'rejected') throw result.reason
  }

  if (!pendingTopupNeedsRefresh()) return

  const response = await customerEventsService.getMyEvents({
    page: 1,
    limit: 10
  })
  if (!response) {
    throw new Error(
      customerEventsService.error.value ?? 'Fetching customer events failed'
    )
  }
  const completedTopup = consumeCompletedTopup(response.events)
  if (completedTopup) {
    telemetry?.trackApiCreditTopupSucceeded()
    telemetry?.trackBillingEvent({
      operation: 'topup',
      stage: 'succeeded',
      outcome: 'success',
      duration_ms: Date.now() - completedTopup.startedAtMs
    })
  }
}

let refreshRequested = false
let activeRefresh: Promise<void> | null = null

async function refreshLatestCredits() {
  refreshRequested = true
  if (activeRefresh) return activeRefresh

  activeRefresh = (async () => {
    let lastError: unknown
    while (refreshRequested) {
      refreshRequested = false
      try {
        await refreshCredits()
        lastError = undefined
      } catch (error) {
        lastError = error
      }
    }
    if (lastError) throw lastError
  })()

  try {
    await activeRefresh
  } finally {
    activeRefresh = null
  }
}

const handleRefresh = wrapWithErrorHandlingAsync(refreshLatestCredits)

function handleAddCredits() {
  telemetry?.trackAddApiCreditButtonClicked({ source: 'credits_panel' })
  void showTopUpCreditsDialog({
    source: paymentIntentSourceForAddCreditsClick('credits_panel')
  })
}

async function handleWindowFocus() {
  if (pendingTopupNeedsRefresh()) {
    await handleRefresh()
  }
}

useEventListener(window, 'focus', () => void handleWindowFocus())

onMounted(handleRefresh)
</script>
