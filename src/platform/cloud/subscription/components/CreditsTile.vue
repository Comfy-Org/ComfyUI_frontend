<template>
  <div
    class="@container relative flex flex-col gap-6 rounded-2xl border border-interface-stroke bg-modal-panel-background px-6 py-5"
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
          class="icon-[lucide--component] size-4 self-center"
          :style="creditIconStyle"
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
            {{ $t('subscription.refillsDate', { date: refillsDateShort }) }}
          </span>
        </div>
        <div
          class="h-2 w-full overflow-hidden rounded-full bg-secondary-background-hover"
        >
          <div
            class="h-full rounded-full"
            :style="{ width: usedBarWidth, backgroundColor: CREDIT_COLOR }"
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
            <i
              class="icon-[lucide--component] size-4"
              :style="creditIconStyle"
            />
            <span class="@max-[180px]:hidden">
              {{
                $t('subscription.creditsLeftOfTotal', {
                  remaining: monthlyBonusCredits,
                  total: monthlyTotalDisplay
                })
              }}
            </span>
            <span class="hidden @max-[180px]:inline">
              {{
                $t('subscription.creditsLeftOfTotal', {
                  remaining: monthlyRemainingCompact,
                  total: monthlyTotalCompact
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
            <i
              v-tooltip="{
                value: $t('subscription.additionalCreditsTooltip'),
                showDelay: 300
              }"
              class="icon-[lucide--info] size-4 text-muted"
            />
            <span
              v-if="isSpendingAdditional"
              class="flex h-3.5 items-center rounded-full bg-base-foreground px-1 text-[10px] leading-none font-semibold text-base-background uppercase"
            >
              {{ $t('subscription.additionalCreditsInUse') }}
            </span>
          </span>
          <Skeleton v-if="isLoadingBalance" width="3rem" height="1rem" />
          <span
            v-else
            class="flex items-center gap-1 font-bold text-text-primary"
          >
            <i
              class="icon-[lucide--component] size-4"
              :style="creditIconStyle"
            />
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import Skeleton from 'primevue/skeleton'
import { computed, onBeforeUnmount, onMounted, toValue } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useSubscriptionCredits } from '@/platform/cloud/subscription/composables/useSubscriptionCredits'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import {
  DEFAULT_TIER_KEY,
  TIER_TO_KEY,
  getTierCredits
} from '@/platform/cloud/subscription/constants/tierPricing'
import { computeMonthlyUsage } from '@/platform/cloud/subscription/utils/creditsProgress'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'

const { zeroState = false } = defineProps<{
  /** Forces the zero-credit display (e.g. unsubscribed / member view). */
  zeroState?: boolean
}>()

const CREDIT_COLOR = '#fabc25'
const creditIconStyle = { color: CREDIT_COLOR }

const PENDING_TOPUP_KEY = 'pending_topup_timestamp'
const TOPUP_EXPIRY_MS = 5 * 60 * 1000

const { locale, n, t } = useI18n()

const {
  subscription,
  balance,
  isActiveSubscription,
  isFreeTier,
  currentTeamCreditStop,
  fetchBalance,
  fetchStatus
} = useBillingContext()
const {
  monthlyBonusCredits,
  prepaidCredits,
  totalCredits,
  monthlyBonusCreditsValue,
  prepaidCreditsValue,
  isLoadingBalance
} = useSubscriptionCredits()
const { permissions } = useWorkspaceUI()
const { showPricingTable } = useSubscriptionDialog()
const dialogService = useDialogService()
const telemetry = useTelemetry()

const isYearly = computed(() => subscription.value?.duration === 'ANNUAL')

const tierKey = computed(() => {
  const tier = subscription.value?.tier
  if (!tier) return DEFAULT_TIER_KEY
  return TIER_TO_KEY[tier] ?? DEFAULT_TIER_KEY
})

const monthlyTotalCredits = computed<number | null>(() => {
  const teamStop = currentTeamCreditStop.value
  if (teamStop) return teamStop.credits_monthly
  const credits = getTierCredits(tierKey.value)
  if (credits === null) return null
  return isYearly.value ? credits * 12 : credits
})

const usage = computed(() =>
  computeMonthlyUsage(
    monthlyBonusCreditsValue.value,
    monthlyTotalCredits.value ?? 0
  )
)

const refillsDateShort = computed(() => {
  const raw = subscription.value?.renewalDate
  if (!raw) return ''
  const date = new Date(raw)
  return Number.isNaN(date.getTime())
    ? raw
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})

const monthlyTotalDisplay = computed(() => {
  const total = monthlyTotalCredits.value
  return total === null ? '—' : n(total)
})

const usedDisplay = computed(() => n(usage.value.used))

const compactNumber = computed(
  () => new Intl.NumberFormat(locale.value, { notation: 'compact' })
)
const monthlyRemainingCompact = computed(() =>
  compactNumber.value.format(monthlyBonusCreditsValue.value)
)
const monthlyTotalCompact = computed(() => {
  const total = monthlyTotalCredits.value
  return total === null ? '—' : compactNumber.value.format(total)
})

const displayTotal = computed(() => (zeroState ? '0' : totalCredits.value))
const displayPrepaid = computed(() => (zeroState ? '0' : prepaidCredits.value))
const usedBarWidth = computed(
  () => `${(usage.value.usedFraction * 100).toFixed(2)}%`
)

const showBreakdown = computed(() => isActiveSubscription.value && !zeroState)
const showBar = computed(
  () =>
    showBreakdown.value &&
    monthlyTotalCredits.value !== null &&
    monthlyTotalCredits.value > 0
)
const showActionButton = computed(
  () => isActiveSubscription.value && !zeroState && permissions.value.canTopUp
)

const isMonthlyDepleted = computed(
  () =>
    showBar.value &&
    !isLoadingBalance.value &&
    toValue(balance) != null &&
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
      title: t('subscription.outOfCreditsTitle', {
        date: refillsDateShort.value
      }),
      description: t('subscription.outOfCreditsDescription')
    }
  }
  if (isMonthlyDepleted.value) {
    return {
      title: t('subscription.monthlyCreditsUsedUpTitle', {
        date: refillsDateShort.value
      }),
      description: t('subscription.monthlyCreditsUsedUpDescription')
    }
  }
  return null
})

async function handleRefresh() {
  await Promise.all([fetchBalance(), fetchStatus()])
}

function handleAddCredits() {
  telemetry?.trackAddApiCreditButtonClicked()
  void dialogService.showTopUpCreditsDialog()
}

function handleUpgradeToAddCredits() {
  showPricingTable()
}

function handleWindowFocus() {
  const timestampStr = localStorage.getItem(PENDING_TOPUP_KEY)
  if (!timestampStr) return

  const timestamp = parseInt(timestampStr, 10)
  if (Date.now() - timestamp > TOPUP_EXPIRY_MS) {
    localStorage.removeItem(PENDING_TOPUP_KEY)
    return
  }

  void handleRefresh()
  localStorage.removeItem(PENDING_TOPUP_KEY)
}

onMounted(() => {
  window.addEventListener('focus', handleWindowFocus)
  void handleRefresh()
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', handleWindowFocus)
})
</script>
