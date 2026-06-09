<template>
  <div
    class="relative flex flex-col gap-5 rounded-2xl bg-modal-panel-background p-5"
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

    <div class="flex flex-col gap-2">
      <div class="text-sm text-muted">
        {{ $t('subscription.totalCredits') }}
      </div>
      <Skeleton v-if="isLoadingBalance" width="8rem" height="2rem" />
      <div v-else class="flex items-center gap-2">
        <i
          class="icon-[lucide--component] size-5"
          :style="{ color: SEGMENT_MONTHLY }"
        />
        <span class="text-2xl leading-none font-bold">{{ displayTotal }}</span>
        <span class="text-sm text-muted">{{
          $t('subscription.remaining')
        }}</span>
      </div>
    </div>

    <template v-if="showBreakdown">
      <div v-if="showBar" class="flex flex-col gap-2">
        <div
          class="flex h-2 w-full overflow-hidden rounded-full bg-secondary-background"
        >
          <div
            class="h-full"
            :style="{
              width: toPercent(progress.monthlyFraction),
              backgroundColor: SEGMENT_MONTHLY
            }"
          />
          <div
            class="h-full"
            :style="{
              width: toPercent(progress.additionalFraction),
              backgroundColor: SEGMENT_ADDITIONAL
            }"
          />
        </div>
        <div class="text-sm text-muted">
          {{
            $t('subscription.monthlyRemainingSummary', {
              remaining: monthlyBonusCredits,
              total: monthlyTotalCompact
            })
          }}
        </div>
      </div>

      <div class="flex flex-col gap-2 text-sm">
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-2 text-muted">
            <span
              class="size-2 shrink-0 rounded-full"
              :style="{ backgroundColor: SEGMENT_MONTHLY }"
            />
            {{ $t('subscription.monthlyRefills', { date: refillsDateShort }) }}
          </span>
          <Skeleton v-if="isLoadingBalance" width="5rem" height="1rem" />
          <span v-else class="font-bold text-text-primary">
            {{ includedCreditsDisplay }}
          </span>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-2 text-muted">
            <span
              class="size-2 shrink-0 rounded-full"
              :style="{ backgroundColor: SEGMENT_ADDITIONAL }"
            />
            {{ $t('subscription.creditsYouveAdded') }}
            <i
              v-tooltip="{
                value: $t('subscription.additionalCreditsTooltip'),
                showDelay: 300
              }"
              class="icon-[lucide--info] size-4 text-muted"
            />
          </span>
          <Skeleton v-if="isLoadingBalance" width="3rem" height="1rem" />
          <span v-else class="font-bold text-text-primary">
            {{ displayPrepaid }}
          </span>
        </div>
      </div>
    </template>

    <div v-if="showActionButton" class="flex flex-col gap-3">
      <Button
        v-if="isFreeTier"
        variant="gradient"
        class="min-h-8 w-full rounded-lg p-2 text-sm font-normal"
        @click="handleUpgradeToAddCredits"
      >
        {{ $t('subscription.upgradeToAddCredits') }}
      </Button>
      <Button
        v-else
        variant="secondary"
        class="min-h-8 w-full rounded-lg bg-interface-menu-component-surface-selected p-2 text-sm font-normal text-text-primary"
        @click="handleAddCredits"
      >
        {{ $t('subscription.addCredits') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
import { computed, onBeforeUnmount, onMounted } from 'vue'
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
import { computeCreditsProgress } from '@/platform/cloud/subscription/utils/creditsProgress'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'

const { zeroState = false } = defineProps<{
  /** Forces the zero-credit display (e.g. unsubscribed / member view). */
  zeroState?: boolean
}>()

const SEGMENT_MONTHLY = '#fbbf24'
const SEGMENT_ADDITIONAL = '#6b5ca8'

const PENDING_TOPUP_KEY = 'pending_topup_timestamp'
const TOPUP_EXPIRY_MS = 5 * 60 * 1000

const { t, n, locale } = useI18n()

const {
  subscription,
  isActiveSubscription,
  isFreeTier,
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
  const credits = getTierCredits(tierKey.value)
  if (credits === null) return null
  return isYearly.value ? credits * 12 : credits
})

const progress = computed(() =>
  computeCreditsProgress(
    monthlyBonusCreditsValue.value,
    prepaidCreditsValue.value,
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

const monthlyTotalCompact = computed(() => {
  const total = monthlyTotalCredits.value
  if (total === null) return '—'
  return new Intl.NumberFormat(locale.value, {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(total)
})

const includedCreditsDisplay = computed(() => {
  const total = monthlyTotalCredits.value
  return t('subscription.creditsOfTotal', {
    remaining: monthlyBonusCredits.value,
    total: total === null ? '—' : n(total)
  })
})

const displayTotal = computed(() => (zeroState ? '0' : totalCredits.value))
const displayPrepaid = computed(() => (zeroState ? '0' : prepaidCredits.value))

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

const toPercent = (fraction: number) => `${(fraction * 100).toFixed(2)}%`

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
