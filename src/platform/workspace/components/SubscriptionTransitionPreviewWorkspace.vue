<template>
  <div
    class="mx-auto flex h-full max-w-[400px] flex-col items-stretch justify-between text-sm motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
  >
    <div>
      <div class="mb-8 flex items-center gap-3">
        <Button
          size="icon"
          variant="muted-textonly"
          class="shrink-0 rounded-full"
          :aria-label="$t('g.back')"
          :disabled="interactionLocked"
          @click="$emit('back')"
        >
          <i class="pi pi-arrow-left text-base" />
        </Button>
        <h2
          class="m-0 flex-1 text-center text-xl font-semibold text-base-foreground lg:text-2xl"
        >
          {{ confirmTitle }}
        </h2>
      </div>
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
          <span
            class="text-2xl font-semibold text-base-foreground tabular-nums"
          >
            ${{ heroPrice }}
          </span>
          <span class="text-base text-base-foreground">
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

      <!-- Credits Refill (immediate changes) -->
      <div v-if="isImmediate" class="flex flex-col gap-2 pt-10">
        <div class="flex items-center justify-between">
          <span class="text-base-foreground">{{ refillLabel }}</span>
          <div class="flex items-center gap-1">
            <i class="icon-[lucide--coins] size-4 shrink-0 bg-credit" />
            <span class="font-bold text-base-foreground tabular-nums">{{
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
            <i class="icon-[lucide--coins] size-4 shrink-0 bg-credit" />
            <span class="font-bold text-base-foreground tabular-nums">{{
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

      <!-- Total Due (immediate changes carry their addends: one sum under
           one divider, per Figma 5344-35724) -->
      <div
        :class="
          cn(
            'flex flex-col gap-2 border-t border-border-subtle pt-6',
            !isImmediate && 'mt-10'
          )
        "
      >
        <template v-if="isImmediate && previewData.discounts?.length">
          <div class="flex items-center justify-between text-muted-foreground">
            <span>{{ $t('subscription.preview.discountComposition') }}</span>
          </div>
          <div
            v-for="discount in previewData.discounts"
            :key="`${discount.kind}:${discount.code}`"
            class="flex items-center justify-between text-muted-foreground"
          >
            <span>{{
              $t(`subscription.preview.discount.${discount.kind}`)
            }}</span>
            <span class="text-base-foreground">
              {{ discount.name || discount.code
              }}<template v-if="discount.amount_off_cents">
                · −${{
                  formatUsdFromCents({ cents: discount.amount_off_cents })
                }}</template
              >
            </span>
          </div>
        </template>
        <div class="flex items-center justify-between text-base">
          <span class="text-base-foreground">
            {{ $t('subscription.preview.totalDueToday') }}
          </span>
          <span class="font-bold text-base-foreground tabular-nums">
            {{ exactAmountDue }}
          </span>
        </div>
        <span class="text-sm text-muted-foreground">{{ renewalTerms }}</span>
      </div>
      <div v-if="embeddedCheckoutEnabled" class="flex gap-2 pt-6">
        <input
          v-model="promotionCode"
          :aria-label="$t('subscription.preview.promoCodePlaceholder')"
          :disabled="interactionLocked"
          class="h-10 min-w-0 flex-1 rounded-lg border border-interface-stroke bg-secondary-background px-3 text-base-foreground"
          :placeholder="$t('subscription.preview.promoCodePlaceholder')"
          @input="invalidateEditedPromotion"
        />
        <Button
          variant="secondary"
          size="lg"
          :disabled="interactionLocked"
          @click="$emit('applyPromotionCode', promotionCode)"
        >
          {{ $t('subscription.preview.applyPromoCode') }}
        </Button>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex flex-col gap-2 pt-8 pb-4">
      <div
        v-if="embeddedCheckoutEnabled && reconciliationOperationId"
        class="rounded-lg border border-interface-stroke bg-secondary-background p-4"
      >
        <p class="m-0 font-semibold text-base-foreground">
          {{ $t('billingOperation.reconciliationTitle') }}
        </p>
        <p class="m-0 mt-1 text-sm text-muted-foreground">
          {{ $t('billingOperation.reconciliationDetail') }}
          <span class="font-mono">{{ reconciliationOperationId }}</span>
        </p>
      </div>

      <div
        v-if="
          embeddedCheckoutEnabled && authenticationState === 'failed_retryable'
        "
        role="alert"
        class="rounded-lg border border-interface-stroke bg-secondary-background p-4 text-sm text-base-foreground"
      >
        {{
          authenticationError ||
          (canRetryAuthentication
            ? $t('billingOperation.authenticationFailedDetail')
            : $t('billingOperation.authenticationManagerRequired'))
        }}
      </div>

      <Button
        v-if="
          embeddedCheckoutEnabled &&
          (authenticationState === 'failed_retryable' ||
            authenticationState === 'requires_action') &&
          canRetryAuthentication
        "
        variant="inverted"
        size="lg"
        class="w-full rounded-lg"
        :loading="isAuthenticating"
        @click="$emit('retryAuthentication')"
      >
        {{
          $t(
            authenticationState === 'failed_retryable'
              ? 'billingOperation.retryVerification'
              : 'subscription.preview.completeVerification'
          )
        }}
      </Button>

      <Button
        v-if="
          actionUrl &&
          !(
            (authenticationState === 'failed_retryable' ||
              authenticationState === 'requires_action') &&
            canRetryAuthentication
          )
        "
        variant="inverted"
        size="lg"
        class="w-full rounded-lg"
        @click="openVerification"
      >
        {{ $t('subscription.preview.completeVerification') }}
      </Button>

      <Button
        :variant="actionUrl ? 'tertiary' : 'inverted'"
        size="lg"
        class="w-full rounded-lg"
        :loading="isLoading"
        :disabled="
          confirmDisabled || !quoteIsUsable || verificationRecoveryActive
        "
        @click="$emit('confirm', confirmReactivation)"
      >
        {{ confirmCta }}
      </Button>

      <SubscriptionTermsNote class="mt-2" />
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
import { formatQuoteMoney } from '@/platform/cloud/subscription/utils/subscriptionQuoteFormatting'
import type {
  BillingAuthenticationState,
  PreviewSubscribeResponse
} from '@/platform/workspace/api/workspaceApi'

import SubscriptionTermsNote from './SubscriptionTermsNote.vue'

type PersonalTierKey = 'standard' | 'creator' | 'pro'

const {
  previewData,
  isLoading = false,
  teamPlan = null,
  actionUrl = null,
  forceReactivation = false,
  authenticationState = null,
  authenticationError = null,
  canRetryAuthentication = false,
  isAuthenticating = false,
  reconciliationOperationId = null,
  quoteIsCurrent = false,
  isApplyingPromotionCode = false,
  embeddedCheckoutEnabled = false
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
  authenticationState?: BillingAuthenticationState | null
  authenticationError?: string | null
  canRetryAuthentication?: boolean
  isAuthenticating?: boolean
  reconciliationOperationId?: string | null
  quoteIsCurrent?: boolean
  isApplyingPromotionCode?: boolean
  embeddedCheckoutEnabled?: boolean
}>()

const emit = defineEmits<{
  /** True only once the reactivation banner was shown and confirmed (checkbox
   *  ticked above the charge threshold, since confirmDisabled gates the button). */
  confirm: [confirmReactivation: boolean]
  back: []
  applyPromotionCode: [code: string]
  invalidateQuote: []
  retryAuthentication: []
}>()

const { locale, n, t } = useI18n()
const verificationRecoveryActive = computed(
  () =>
    embeddedCheckoutEnabled &&
    (authenticationState === 'requires_action' ||
      authenticationState === 'failed_retryable' ||
      Boolean(reconciliationOperationId))
)
const quoteIsUsable = computed(() => !embeddedCheckoutEnabled || quoteIsCurrent)
const interactionLocked = computed(() => isLoading || isApplyingPromotionCode)

const { subscription } = useBillingContext()
const promotionCode = ref(previewData.promotion_code ?? '')
watch(
  () => previewData.promotion_code,
  (code) => {
    promotionCode.value = code ?? ''
  }
)

function invalidateEditedPromotion() {
  if (promotionCode.value !== (previewData.promotion_code ?? '')) {
    emit('invalidateQuote')
  }
}

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

const isCancelled = computed(
  () =>
    forceReactivation ||
    (!embeddedCheckoutEnabled && (subscription.value?.isCancelled ?? false))
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
const chargeCents = computed(
  () => previewData.amount_due_cents ?? previewData.cost_today_cents
)
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

const newMonthlyChargeUsd = computed(() => newMonthlyUsd.value)

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
const exactAmountDue = computed(() =>
  previewData.amount_due_cents === undefined
    ? t('subscription.preview.quoteUnavailable')
    : formatQuoteMoney(
        previewData.amount_due_cents,
        previewData.currency,
        locale.value
      )
)
const renewalTerms = computed(() => {
  if (
    previewData.renewal_amount_cents === undefined ||
    !previewData.renewal_at
  ) {
    return t('subscription.preview.quoteUnavailable')
  }
  return t('subscription.preview.renewsAt', {
    amount: formatQuoteMoney(
      previewData.renewal_amount_cents,
      previewData.currency,
      locale.value
    ),
    date: formatDate(previewData.renewal_at)
  })
})
</script>
