<template>
  <div
    :class="
      cn(
        '@container relative flex flex-col gap-6 rounded-2xl border border-interface-stroke bg-modal-panel-background px-6 py-5 transition-opacity',
        // Paused subscriptions can't spend credits, so dim the whole tile to
        // read as frozen and defer to the Update-payment banner. A lapsed plan
        // (frozen) reads the same way.
        (isPaused || frozen) && 'opacity-50',
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
                value: additionalCreditsTooltip,
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
          {{ additionalCreditsUsageLabel }}
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
        :variant="isOutOfCredits ? 'inverted' : 'tertiary'"
        size="lg"
        class="w-full font-normal"
        :disabled="isPaused || frozen"
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
import { useTelemetry } from '@/platform/telemetry'
import { consumePendingTopup } from '@/platform/telemetry/topupTracker'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'

const {
  zeroState = false,
  frozen = false,
  class: customClass
} = defineProps<{
  /** Forces the zero-credit display (e.g. unsubscribed / member view). */
  zeroState?: boolean
  /**
   * Renders the full breakdown but dimmed and non-interactive, for a lapsed
   * subscription that still has a shape to show. Mirrors the paused treatment.
   */
  frozen?: boolean
  class?: HTMLAttributes['class']
}>()

const { locale, t } = useI18n()

const {
  subscription,
  isPaused,
  balance,
  isActiveSubscription,
  isFreeTier,
  fetchBalance,
  fetchStatus
} = useBillingContext()
const {
  prepaidCredits,
  totalCredits,
  monthlyBonusCreditsValue,
  prepaidCreditsValue,
  isLoadingBalance,
  allowanceTotalCredits,
  usage
} = useSubscriptionCredits()
const { permissions } = useWorkspaceUI()
const { showPricingTable } = useSubscriptionDialog()
const { wrapWithErrorHandlingAsync } = useErrorHandling()
const dialogService = useDialogService()
const telemetry = useTelemetry()

const isAnnual = computed(() => subscription.value?.duration === 'ANNUAL')

const cycleLabel = computed(() =>
  isAnnual.value ? t('subscription.yearly') : t('subscription.monthly')
)

const additionalCreditsUsageLabel = computed(() =>
  t(
    isAnnual.value
      ? 'subscription.usedAfterYearly'
      : 'subscription.usedAfterMonthly'
  )
)

const additionalCreditsTooltip = computed(() =>
  t(
    isAnnual.value
      ? 'subscription.additionalCreditsTooltipYearly'
      : 'subscription.additionalCreditsTooltip'
  )
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

const showBreakdown = computed(
  () => (isActiveSubscription.value || frozen) && !zeroState
)
const showBar = computed(
  () =>
    showBreakdown.value &&
    allowanceTotalCredits.value !== null &&
    allowanceTotalCredits.value > 0
)
const showActionButton = computed(
  () =>
    (isActiveSubscription.value || frozen) &&
    !zeroState &&
    permissions.value.canTopUp
)

const isAllowanceDepleted = computed(
  () =>
    !isPaused.value &&
    !frozen &&
    showBar.value &&
    !isLoadingBalance.value &&
    balance.value != null &&
    monthlyBonusCreditsValue.value <= 0
)
const isSpendingAdditional = computed(
  () => isAllowanceDepleted.value && prepaidCreditsValue.value > 0
)
// Fully out (monthly depleted and no additional credits left): emphasize the
// add-credits button. Spending-additional keeps the quieter tertiary.
const isOutOfCredits = computed(
  () => isAllowanceDepleted.value && prepaidCreditsValue.value <= 0
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
