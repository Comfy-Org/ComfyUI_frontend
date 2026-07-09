<template>
  <div
    :class="
      cn(
        '@container relative flex flex-col gap-6 rounded-2xl border border-interface-stroke bg-modal-panel-background px-6 py-5 transition-opacity',
        // Paused subscriptions can't spend credits, so dim the whole tile to
        // read as frozen and defer to the Update-payment banner.
        isPaused && 'opacity-50',
        customClass
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
        <i class="icon-[lucide--coins] size-4 self-center text-credit" />
        <span class="text-2xl leading-none font-bold tabular-nums">{{
          displayTotal
        }}</span>
        <span class="text-sm text-muted @max-[300px]:hidden">{{
          $t('subscription.remaining')
        }}</span>
      </div>
    </div>

    <template v-if="showBreakdown">
      <div
        v-if="showBar"
        :class="cn('flex flex-col gap-2', isAllowanceDepleted && 'opacity-30')"
      >
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted">{{ cycleLabel }}</span>
          <span class="text-muted">
            {{ cycleStatusLabel }}
          </span>
        </div>
        <div
          role="progressbar"
          :aria-valuenow="usage.used"
          :aria-valuemin="0"
          :aria-valuemax="allowanceTotalCredits ?? 0"
          :aria-valuetext="cycleUsageLabel"
          class="h-2 w-full overflow-hidden rounded-full bg-secondary-background-hover"
        >
          <div
            class="h-full rounded-full bg-credit"
            :style="{ width: usedBarWidth }"
          />
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
              class="flex cursor-help appearance-none items-center border-none bg-transparent p-0 text-muted transition-colors hover:text-text-primary"
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
            class="flex items-center gap-1 font-bold text-text-primary tabular-nums"
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

    <div v-if="showActionButton" class="flex flex-col gap-3">
      <Button
        v-if="isFreeTier"
        variant="gradient"
        size="lg"
        class="w-full font-normal"
        @click="handleUpgradeToAddCredits"
      >
        {{ $t('subscription.upgradeToAddCredits') }}
      </Button>
      <Button
        v-else
        variant="tertiary"
        size="lg"
        class="w-full font-normal"
        :disabled="isPaused"
        @click="handleAddCredits"
      >
        {{ $t('subscription.addCredits') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useEventListener } from '@vueuse/core'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted } from 'vue'
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatCredits } from '@/base/credits/comfyCredits'
import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useSubscriptionCredits } from '@/platform/cloud/subscription/composables/useSubscriptionCredits'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import {
  DEFAULT_TIER_KEY,
  TIER_TO_KEY,
  getTierCredits
} from '@/platform/cloud/subscription/constants/tierPricing'
import { computeMonthlyUsage } from '@/platform/cloud/subscription/utils/creditsProgress'
import { useTelemetry } from '@/platform/telemetry'
import { consumePendingTopup } from '@/platform/telemetry/topupTracker'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'

const { zeroState = false, class: customClass } = defineProps<{
  /** Forces the zero-credit display (e.g. unsubscribed / member view). */
  zeroState?: boolean
  class?: HTMLAttributes['class']
}>()

const { locale, t } = useI18n()

const {
  subscription,
  isPaused,
  balance,
  isActiveSubscription,
  isFreeTier,
  currentTeamCreditStop,
  fetchBalance,
  fetchStatus
} = useBillingContext()
const {
  prepaidCredits,
  totalCredits,
  monthlyBonusCreditsValue,
  prepaidCreditsValue,
  isLoadingBalance
} = useSubscriptionCredits()
const { permissions } = useWorkspaceUI()
const { showPricingTable } = useSubscriptionDialog()
const { wrapWithErrorHandlingAsync } = useErrorHandling()
const dialogService = useDialogService()
const telemetry = useTelemetry()

const tierKey = computed(() => {
  const tier = subscription.value?.tier
  if (!tier) return DEFAULT_TIER_KEY
  return TIER_TO_KEY[tier] ?? DEFAULT_TIER_KEY
})

// Annual plans grant the whole year's credits upfront, so the allowance the
// bar tracks is the monthly nominal times the number of months in the cycle.
const cycleMonths = computed(() =>
  subscription.value?.duration === 'ANNUAL' ? 12 : 1
)

const allowanceTotalCredits = computed<number | null>(() => {
  const teamStop = currentTeamCreditStop.value
  const monthly = teamStop
    ? teamStop.credits_monthly
    : getTierCredits(tierKey.value)
  return monthly === null ? null : monthly * cycleMonths.value
})

const usage = computed(() => {
  const base = computeMonthlyUsage(
    monthlyBonusCreditsValue.value,
    allowanceTotalCredits.value ?? 0
  )
  return isPaused.value ? { ...base, used: 0, usedFraction: 0 } : base
})

const cycleLabel = computed(() =>
  subscription.value?.duration === 'ANNUAL'
    ? t('subscription.yearly')
    : t('subscription.monthly')
)

const cycleUsedPercent = computed(() =>
  Math.round(usage.value.usedFraction * 100)
)

const cycleStatusLabel = computed(() =>
  t('subscription.percentUsed', { percent: cycleUsedPercent.value })
)

const formatCreditCount = (value: number) =>
  formatCredits({
    value,
    locale: locale.value,
    numberOptions: { maximumFractionDigits: 0 }
  })

const allowanceTotalDisplay = computed(() => {
  const total = allowanceTotalCredits.value
  return total === null ? '—' : formatCreditCount(total)
})

const usedDisplay = computed(() => formatCreditCount(usage.value.used))

const displayTotal = computed(() => (zeroState ? '0' : totalCredits.value))
const displayPrepaid = computed(() => (zeroState ? '0' : prepaidCredits.value))
const usedBarWidth = computed(
  () => `${(usage.value.usedFraction * 100).toFixed(2)}%`
)
const cycleUsageLabel = computed(() =>
  t('subscription.usageProgress', {
    used: usedDisplay.value,
    total: allowanceTotalDisplay.value
  })
)

const showBreakdown = computed(() => isActiveSubscription.value && !zeroState)
const showBar = computed(
  () =>
    showBreakdown.value &&
    allowanceTotalCredits.value !== null &&
    allowanceTotalCredits.value > 0
)
const showActionButton = computed(
  () => isActiveSubscription.value && !zeroState && permissions.value.canTopUp
)

const isAllowanceDepleted = computed(
  () =>
    !isPaused.value &&
    showBar.value &&
    !isLoadingBalance.value &&
    balance.value != null &&
    monthlyBonusCreditsValue.value <= 0
)
const isSpendingAdditional = computed(
  () => isAllowanceDepleted.value && prepaidCreditsValue.value > 0
)

const handleRefresh = wrapWithErrorHandlingAsync(async () => {
  await Promise.all([fetchBalance(), fetchStatus()])
})

function handleAddCredits() {
  telemetry?.trackAddApiCreditButtonClicked({ source: 'credits_panel' })
  void dialogService.showTopUpCreditsDialog()
}

function handleUpgradeToAddCredits() {
  showPricingTable({ reason: 'upgrade_to_add_credits' })
}

async function handleWindowFocus() {
  if (consumePendingTopup()) {
    await handleRefresh()
  }
}

useEventListener(window, 'focus', () => void handleWindowFocus())

onMounted(handleRefresh)
</script>
