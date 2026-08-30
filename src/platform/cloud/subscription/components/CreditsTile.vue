<template>
  <div
    :class="
      cn(
        '@container relative flex flex-col gap-6 rounded-2xl border border-interface-stroke bg-modal-panel-background px-6 py-5',
        inactivePlan && 'text-muted'
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
      <i class="icon-[lucide--refresh-cw] size-4 text-text-secondary" />
    </Button>

    <div class="flex flex-col gap-1">
      <div class="text-sm text-muted">
        {{ $t('subscription.totalCredits') }}
      </div>
      <Skeleton v-if="isLoadingBalance" width="8rem" height="2rem" />
      <div v-else class="flex items-baseline gap-2">
        <i
          :class="
            cn(
              'icon-[lucide--coins] size-4 self-center',
              !inactivePlan && 'text-credit'
            )
          "
        />
        <span class="text-2xl leading-none font-bold">{{ displayTotal }}</span>
        <span class="text-sm text-muted @max-[300px]:hidden">{{
          $t('subscription.remaining')
        }}</span>
      </div>
    </div>

    <template v-if="showBreakdown">
      <div
        v-if="emptyStateNotice"
        class="flex items-start gap-2 rounded-lg bg-base-background p-3 text-sm"
      >
        <i
          class="mt-0.5 icon-[lucide--info] size-4 shrink-0 text-base-foreground"
        />
        <div class="flex flex-col gap-1">
          <span class="text-base-foreground">{{ emptyStateNotice.title }}</span>
          <span class="text-muted">{{ emptyStateNotice.description }}</span>
        </div>
      </div>

      <div
        v-if="showBar"
        :class="cn('flex flex-col gap-2', isMonthlyDepleted && 'opacity-30')"
      >
        <div class="flex items-center justify-between text-sm">
          <span class="text-text-primary">{{
            $t('subscription.monthly')
          }}</span>
          <span class="text-muted">
            {{ refillsLabel }}
          </span>
        </div>
        <div
          role="progressbar"
          :aria-valuenow="usage.used"
          :aria-valuemin="0"
          :aria-valuemax="creditPoolTotalCredits ?? 0"
          :aria-valuetext="monthlyUsageLabel"
          class="h-2 w-full overflow-hidden rounded-full bg-secondary-background-hover"
        >
          <div
            class="h-full rounded-full bg-credit"
            :style="{ width: usedBarWidth }"
          />
        </div>
        <div class="flex items-center justify-between gap-2 text-sm">
          <Skeleton
            v-if="isLoadingBalance"
            class="@max-[300px]:hidden"
            width="5rem"
            height="1rem"
          />
          <span v-else class="text-muted @max-[300px]:hidden">
            {{ $t('subscription.creditsUsed', { used: usedDisplay }) }}
          </span>
          <Skeleton v-if="isLoadingBalance" width="9rem" height="1rem" />
          <span
            v-else
            class="flex items-center gap-1 font-bold text-text-primary"
          >
            <i class="icon-[lucide--coins] size-4 text-credit" />
            <span class="@max-[180px]:hidden">
              {{
                $t('subscription.creditsLeftOfTotal', {
                  remaining: monthlyBonusCredits,
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

      <div class="h-px w-full bg-interface-stroke" />

      <div class="flex flex-col gap-2">
        <div
          class="flex items-center justify-between gap-2 text-sm @max-[300px]:flex-col @max-[300px]:items-start"
        >
          <span class="flex items-center gap-1 text-text-primary">
            {{ $t('subscription.additionalCredits') }}
            <Button
              v-tooltip="{
                value: $t('subscription.additionalCreditsTooltip'),
                showDelay: 300
              }"
              variant="muted-textonly"
              size="icon-sm"
              :aria-label="$t('subscription.additionalCreditsInfo')"
              class="text-muted"
            >
              <i class="icon-[lucide--info] size-4" />
            </Button>
            <span
              v-if="isSpendingAdditional"
              class="flex h-3.5 items-center rounded-full bg-base-foreground px-1 text-2xs/none font-semibold text-base-background uppercase"
            >
              {{ $t('subscription.additionalCreditsInUse') }}
            </span>
          </span>
          <Skeleton v-if="isLoadingBalance" width="3rem" height="1rem" />
          <span
            v-else
            class="flex items-center gap-1 font-bold text-text-primary"
          >
            <i class="icon-[lucide--coins] size-4 text-credit" />
            {{ displayPrepaid }}
          </span>
        </div>
        <span class="text-sm text-muted @max-[300px]:hidden">
          {{ $t('subscription.usedAfterMonthly') }}
        </span>
      </div>
    </template>

    <template v-else-if="showsInactivePlanState">
      <div class="h-px w-full bg-interface-stroke" />
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2 text-sm">
          <span class="flex items-center gap-1">
            {{ $t('subscription.additionalCredits') }}
            <Button
              v-tooltip="{
                value: $t('subscription.additionalCreditsTooltip'),
                showDelay: 300
              }"
              variant="muted-textonly"
              size="icon-sm"
              :aria-label="$t('subscription.additionalCreditsInfo')"
              class="text-muted"
            >
              <i class="icon-[lucide--info] size-4" />
            </Button>
          </span>
          <span class="flex items-center gap-1 font-bold">
            <i class="icon-[lucide--coins] size-4" />
            {{ displayPrepaid }}
          </span>
        </div>
        <span class="text-sm">
          {{ $t('subscription.reactivateToUseCredits') }}
        </span>
      </div>
    </template>

    <div v-if="showActionButton" class="flex flex-col gap-3">
      <Button
        v-if="canTopUp"
        :variant="isOutOfCredits ? 'inverted' : 'secondary'"
        size="lg"
        :class="
          cn(
            'w-full font-normal',
            !isOutOfCredits &&
              'bg-interface-menu-component-surface-selected text-text-primary'
          )
        "
        @click="handleAddCredits"
      >
        {{ $t('subscription.addCredits') }}
      </Button>
      <Button
        v-else
        variant="subscribe"
        size="lg"
        class="w-full font-normal"
        @click="handleUpgradeToAddCredits"
      >
        {{ $t('subscription.upgradeToAddCredits') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener } from '@vueuse/core'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCredits } from '@/base/credits/comfyCredits'
import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useSubscriptionCredits } from '@/platform/cloud/subscription/composables/useSubscriptionCredits'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import {
  DEFAULT_TIER_KEY,
  isSalesManagedTier,
  toTierKey,
  getTierCredits
} from '@/platform/cloud/subscription/constants/tierPricing'
import { computeMonthlyUsage } from '@/platform/cloud/subscription/utils/creditsProgress'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { usePendingTopup } from '@/composables/billing/usePendingTopup'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useCustomerEventsService } from '@/services/customerEventsService'
import { useDialogService } from '@/services/dialogService'

const { zeroState = false, inactivePlan } = defineProps<{
  /** Forces the zero-credit display (e.g. unsubscribed / member view). */
  zeroState?: boolean
  inactivePlan?: boolean
}>()

const { locale, t } = useI18n()

const {
  subscription,
  balance,
  canAccessSubscriptionFeatures,
  currentTeamCreditStop,
  fetchBalance,
  fetchStatus
} = useBillingContext()
const { canTopUp, canSubscribeSelfServe } = useBillingCapabilities()
const {
  monthlyBonusCredits,
  prepaidCredits,
  totalCredits,
  monthlyBonusCreditsValue,
  prepaidCreditsValue,
  isLoadingBalance
} = useSubscriptionCredits()
const { wrapWithErrorHandlingAsync } = useErrorHandling()
const { showPricingTable } = useSubscriptionDialog()
const customerEventsService = useCustomerEventsService()
const dialogService = useDialogService()
const telemetry = useTelemetry()
const { pendingTopupNeedsRefresh, isPendingTopupCompleted } = usePendingTopup()

const tierKey = computed(() => {
  const tier = subscription.value?.tier
  if (!tier) return DEFAULT_TIER_KEY
  return toTierKey(tier) ?? DEFAULT_TIER_KEY
})

const creditPoolTotalCredits = computed<number | null>(() => {
  const monthlyCredits =
    currentTeamCreditStop.value?.credits_monthly ??
    (isSalesManagedTier(subscription.value?.tier)
      ? null
      : getTierCredits(tierKey.value))
  if (monthlyCredits === null) return null
  return subscription.value?.duration === 'ANNUAL'
    ? monthlyCredits * 12
    : monthlyCredits
})

// The reactivate-to-use-credits treatment sells a self-serve reactivation, so
// it applies only where one exists. Tier decides that, as it does for the
// credit pool above: can_top_up is a rollout-defaulted capability that also
// fails open for owners on an unreadable snapshot, which would drop a lapsed
// self-serve team out of this state during a capabilities outage.
const showsInactivePlanState = computed(
  () => inactivePlan === true && !isSalesManagedTier(subscription.value?.tier)
)

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

const compactNumber = computed(
  () => new Intl.NumberFormat(locale.value, { notation: 'compact' })
)
const monthlyRemainingCompact = computed(() =>
  compactNumber.value.format(monthlyBonusCreditsValue.value)
)
const creditPoolTotalCompact = computed(() => {
  const total = creditPoolTotalCredits.value
  return total === null ? '—' : compactNumber.value.format(total)
})

const displayTotal = computed(() =>
  zeroState || showsInactivePlanState.value
    ? formatCreditCount(0)
    : totalCredits.value
)
const displayPrepaid = computed(() =>
  zeroState || showsInactivePlanState.value
    ? formatCreditCount(0)
    : prepaidCredits.value
)
const usedBarWidth = computed(
  () => `${(usage.value.usedFraction * 100).toFixed(2)}%`
)
const monthlyUsageLabel = computed(() =>
  t('subscription.monthlyUsageProgress', {
    used: usedDisplay.value,
    total: creditPoolTotalDisplay.value
  })
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
const showActionButton = computed(
  () =>
    (canTopUp.value || canSubscribeSelfServe.value) &&
    !zeroState &&
    !showsInactivePlanState.value
)

const isMonthlyDepleted = computed(
  () =>
    showBar.value &&
    !isLoadingBalance.value &&
    balance.value != null &&
    monthlyBonusCreditsValue.value <= 0
)
const isOutOfCredits = computed(
  () => isMonthlyDepleted.value && prepaidCreditsValue.value <= 0
)
const isSpendingAdditional = computed(
  () => isMonthlyDepleted.value && prepaidCreditsValue.value > 0
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
        ? t('subscription.monthlyCreditsUsedUpTitle', {
            date: refillsDateShort.value
          })
        : t('subscription.monthlyCreditsUsedUpTitleNoDate'),
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
  if (isPendingTopupCompleted(response.events)) {
    telemetry?.trackApiCreditTopupSucceeded()
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
  void dialogService.showTopUpCreditsDialog()
}

function handleUpgradeToAddCredits() {
  showPricingTable({ reason: 'upgrade_to_add_credits' })
}

async function handleWindowFocus() {
  if (pendingTopupNeedsRefresh()) {
    await handleRefresh()
  }
}

useEventListener(window, 'focus', () => void handleWindowFocus())

onMounted(handleRefresh)
</script>
