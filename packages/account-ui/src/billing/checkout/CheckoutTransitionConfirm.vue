<template>
  <div
    class="mx-auto flex h-full min-h-0 max-w-[400px] flex-col items-stretch justify-between overflow-y-auto text-sm motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
  >
    <div>
      <div class="mb-8 flex items-center gap-3">
        <CheckoutButton
          size="icon"
          variant="muted-textonly"
          class="shrink-0 rounded-full"
          :aria-label="copy.back"
          :disabled="interactionLocked"
          @click="emit('back')"
        >
          <i class="pi pi-arrow-left text-base" />
        </CheckoutButton>
        <h2
          class="m-0 flex-1 text-center text-xl font-semibold text-base-foreground lg:text-2xl"
        >
          {{ confirmTitle }}
        </h2>
        <div class="size-8 shrink-0" aria-hidden="true" />
      </div>
      <CheckoutReactivationBanner
        v-if="isReactivating"
        v-model:confirmed="reactivationConfirmed"
        :title="bannerTitle"
        :segments="bannerSegments"
        :checkbox-label="
          exceedsMonthlyThreshold
            ? copy.reactivation.checkboxLabel(chargeDisplay)
            : null
        "
      />

      <CheckoutTransitionSummary
        :plan-name="plan.name"
        :hero-price
        :usd-per-month="copy.usdPerMonth"
        :details="planDetails"
        :heading="isImmediate ? '' : copy.afterThat"
        :refill-label="refillLabel"
        :refill-credits
        :note="refillNote"
      />

      <!-- Immediate changes carry their addends: one sum under one divider
           (Figma 5344-35724). -->
      <div :class="totalClass">
        <template v-if="discounts.length">
          <div class="flex items-center justify-between text-muted-foreground">
            <span>{{ copy.discountComposition }}</span>
          </div>
          <div
            v-for="discount in discounts"
            :key="discount.key"
            class="flex items-center justify-between text-muted-foreground"
          >
            <span>{{ discount.label }}</span>
            <span class="text-base-foreground">
              {{ discount.name
              }}<template v-if="discount.amount">
                · −{{ discount.amount }}</template
              >
            </span>
          </div>
        </template>
        <div class="flex items-center justify-between text-base">
          <span class="text-base-foreground">
            {{ copy.totalDueToday }}
          </span>
          <span class="font-bold text-base-foreground tabular-nums">
            {{ amountDueToday }}
          </span>
        </div>
        <span class="text-sm text-muted-foreground">{{ renewalTerms }}</span>
      </div>
      <CheckoutPromotionCode
        v-if="embeddedCheckoutEnabled"
        :applied-code="previewData.promotion_code"
        :disabled="interactionLocked"
        :copy
        @apply="emit('applyPromotionCode', $event)"
        @invalidate="emit('invalidateQuote')"
      />
    </div>

    <div class="flex flex-col gap-2 pt-8 pb-4">
      <CheckoutPaymentNotices
        :embedded-checkout-enabled
        :reconciliation-operation-id
        :authentication-state
        :authentication-error
        :copy
      />

      <CheckoutVerificationPrompt
        v-if="verificationUrl"
        :action-url="verificationUrl"
        :copy
      />

      <CheckoutButton
        :variant="actionUrl ? 'tertiary' : 'inverted'"
        size="lg"
        class="w-full rounded-lg"
        :loading="isLoading"
        :disabled="confirmBlocked"
        @click="emit('confirm', confirmReactivation)"
      >
        {{ confirmCta }}
      </CheckoutButton>

      <CheckoutTermsNote class="mt-2" :copy="copy.terms" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The confirm step of a change to an existing subscription: what it switches
 * to and when, what is charged today, and — for a subscription set to end —
 * the reactivation the change implies, which a large enough charge has to be
 * acknowledged before the confirm unlocks.
 */
import { computed, ref, watch } from 'vue'

import type {
  BillingAuthenticationState,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import { cn } from '@comfyorg/tailwind-utils'

import CheckoutButton from './CheckoutButton.vue'
import CheckoutPaymentNotices from './CheckoutPaymentNotices.vue'
import CheckoutPromotionCode from './CheckoutPromotionCode.vue'
import CheckoutReactivationBanner from './CheckoutReactivationBanner.vue'
import CheckoutTermsNote from './CheckoutTermsNote.vue'
import CheckoutTransitionSummary from './CheckoutTransitionSummary.vue'
import CheckoutVerificationPrompt from './CheckoutVerificationPrompt.vue'
import type { CheckoutCopy } from './checkoutCopy'
import { splitPlaceholders } from './checkoutCopy'
import {
  formatAmountDueToday,
  formatNumber,
  formatRenewalAmount,
  formatUsdFromCents,
  isAnnualDuration,
  resolveRenewalDate
} from './checkoutQuote'
import {
  isVerificationOffered,
  isVerificationRecoveryActive
} from './checkoutRecovery'

const {
  previewData,
  plan,
  currentPlanName,
  copy,
  locale,
  subscriptionLoaded,
  subscriptionCancelled = false,
  subscriptionEndDate = null,
  isLoading = false,
  actionUrl = null,
  forceReactivation = false,
  authenticationState = null,
  authenticationError = null,
  reconciliationOperationId = null,
  quoteIsCurrent = false,
  isApplyingPromotionCode = false,
  embeddedCheckoutEnabled = false
} = defineProps<{
  previewData: SubscriptionPreview
  /** The plan switched to: its name and the credits one month refills. All
   *  proration money stays driven by `previewData`. */
  plan: { readonly name: string; readonly monthlyCredits: number }
  currentPlanName: string
  copy: CheckoutCopy
  locale: string
  /** False until the subscription status has loaded once; the confirm stays
   *  disabled until then. */
  subscriptionLoaded: boolean
  subscriptionCancelled?: boolean
  subscriptionEndDate?: string | Date | null
  isLoading?: boolean
  actionUrl?: string | null
  /** Server-authoritative fallback for legacy status reads that omit a
   * scheduled cancellation until subscribe enforces the consent gate. */
  forceReactivation?: boolean
  authenticationState?: BillingAuthenticationState | null
  authenticationError?: string | null
  reconciliationOperationId?: string | null
  quoteIsCurrent?: boolean
  isApplyingPromotionCode?: boolean
  embeddedCheckoutEnabled?: boolean
}>()

const emit = defineEmits<{
  /** True only once the reactivation banner was shown and confirmed (checkbox
   *  ticked above the charge threshold, since the button is gated on it). */
  confirm: [confirmReactivation: boolean]
  back: []
  applyPromotionCode: [code: string]
  invalidateQuote: []
}>()

const recoveryState = computed(() => ({
  actionUrl,
  authenticationState,
  reconciliationOperationId,
  embeddedCheckoutEnabled
}))
const verificationUrl = computed(() =>
  isVerificationOffered(recoveryState.value) ? actionUrl : null
)
const verificationRecoveryActive = computed(() =>
  isVerificationRecoveryActive(recoveryState.value)
)
const quoteIsUsable = computed(() => !embeddedCheckoutEnabled || quoteIsCurrent)
const interactionLocked = computed(() => isLoading || isApplyingPromotionCode)

function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(typeof date === 'string' ? new Date(date) : date)
}

const isImmediate = computed(() => previewData.is_immediate)
const newIsYearly = computed(() =>
  isAnnualDuration(previewData.new_plan.duration)
)
const currentIsYearly = computed(() =>
  isAnnualDuration(previewData.current_plan?.duration)
)

const isCancelled = computed(
  () => forceReactivation || (!embeddedCheckoutEnabled && subscriptionCancelled)
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
// The banner and threshold math read the end date and the current plan;
// without them the banner would render broken copy or force the checkbox on
// a bogus $0 threshold.
const cancelAt = computed(
  () => subscriptionEndDate ?? previewData.current_plan?.period_end
)

const isReactivating = computed(
  () =>
    isCancelled.value &&
    reactivationVariant.value !== null &&
    !!cancelAt.value &&
    !!previewData.current_plan
)

// seat_summary.total_cost_cents is the whole-subscription price; price_cents
// is per-seat and understates the threshold on multi-seat team plans. ANNUAL
// divides by 12 for a monthly equivalent.
const currentMonthlyPriceCents = computed(() => {
  const current = previewData.current_plan
  if (!current) return 0
  const totalCents = current.seat_summary.total_cost_cents
  return currentIsYearly.value ? totalCents / 12 : totalCents
})
const chargeCents = computed(
  () => previewData.amount_due_cents ?? previewData.cost_today_cents
)
// The downgrade copy always says "you won't be charged today" with no amount
// shown, so it never gets the checkbox even if cost_today_cents is positive.
const exceedsMonthlyThreshold = computed(
  () =>
    isReactivating.value &&
    reactivationVariant.value !== 'downgrade' &&
    chargeCents.value > currentMonthlyPriceCents.value
)
const chargeDisplay = computed(
  () => `$${formatUsdFromCents(chargeCents.value)}`
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

const confirmDisabled = computed(
  () =>
    !subscriptionLoaded ||
    (exceedsMonthlyThreshold.value && !reactivationConfirmed.value)
)
const confirmBlocked = computed(
  () =>
    confirmDisabled.value ||
    !quoteIsUsable.value ||
    verificationRecoveryActive.value
)
const confirmReactivation = computed(
  () =>
    isReactivating.value &&
    (!exceedsMonthlyThreshold.value || reactivationConfirmed.value)
)

const bannerTitle = computed(() =>
  reactivationVariant.value === 'duration_change' && newIsYearly.value
    ? copy.reactivation.titleAnnual
    : copy.reactivation.title
)
const bannerBody = computed(() => {
  switch (reactivationVariant.value) {
    case 'upgrade':
      return copy.reactivation.upgradeBody
    case 'downgrade':
      return copy.reactivation.downgradeBody
    case 'duration_change':
      return newIsYearly.value
        ? copy.reactivation.durationChangeBody
        : copy.reactivation.durationChangeBodyMonthly
    default:
      return ''
  }
})
const bannerSegments = computed(() =>
  splitPlaceholders(bannerBody.value, [
    'plan',
    'date',
    'newPlan',
    'nextDate',
    'amount'
  ] as const).map((segment) => {
    if (segment.kind === 'text') return { text: segment.text, emphasis: false }
    if (segment.key === 'amount') {
      return { text: chargeDisplay.value, emphasis: true }
    }
    return { text: bannerValues.value[segment.key], emphasis: false }
  })
)

const newMonthlyUsd = computed(() => {
  const cents = previewData.new_plan.price_cents
  return (newIsYearly.value ? cents / 12 : cents) / 100
})
const heroPrice = computed(() => newMonthlyUsd.value.toFixed(0))

const annualTotalFormatted = computed(
  () => `$${formatNumber(previewData.new_plan.price_cents / 100, locale)}`
)

const refillCredits = computed(() =>
  formatNumber(
    newIsYearly.value ? plan.monthlyCredits * 12 : plan.monthlyCredits,
    locale
  )
)
const refillLabel = computed(() => {
  if (isImmediate.value) {
    return newIsYearly.value
      ? copy.creditsYoullGetToday
      : copy.eachMonthCreditsRefill
  }
  return newIsYearly.value
    ? copy.eachYearCreditsRefill
    : copy.creditsRefillMonthlyTo
})

const billedLabel = computed(() =>
  newIsYearly.value
    ? copy.billedYearly(annualTotalFormatted.value)
    : copy.billedMonthly
)

const planDetails = computed(() =>
  isImmediate.value
    ? [billedLabel.value, copy.switchesToday]
    : [copy.startsOn(effectiveDateLabel.value)]
)

const refillNote = computed(() => {
  if (isImmediate.value) return newIsYearly.value ? copy.refillReplacesNote : ''
  return newIsYearly.value
    ? copy.billedYearly(annualTotalFormatted.value)
    : copy.billedEachMonth(`$${formatNumber(newMonthlyUsd.value, locale)}`)
})

const totalClass = computed(() =>
  cn(
    'flex flex-col gap-2 border-t border-border-subtle pt-6',
    !isImmediate.value && 'mt-10'
  )
)

const discounts = computed(() =>
  isImmediate.value
    ? (previewData.discounts ?? []).map((discount) => ({
        key: `${discount.kind}:${discount.code}`,
        label: copy.discount[discount.kind],
        name: discount.name || discount.code,
        amount: discount.amount_off_cents
          ? `$${formatUsdFromCents(discount.amount_off_cents)}`
          : ''
      }))
    : []
)

const effectiveDateLabel = computed(() => formatDate(previewData.effective_at))
// Date.setUTCMonth rolls a day-of-month past the target month's end into the
// following month (Jan 31 + 1mo => Mar 3); clamp to the target month's last
// day instead.
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
// activation: the activation date itself would read as "renews today".
const nextPaymentDate = computed(() => {
  if (previewData.new_plan.period_end) {
    return formatDate(previewData.new_plan.period_end)
  }
  return formatDate(
    addUtcMonthsClamped(
      new Date(previewData.effective_at),
      newIsYearly.value ? 12 : 1
    )
  )
})

const bannerValues = computed(() => ({
  plan: currentPlanName,
  date: cancelAt.value ? formatDate(cancelAt.value) : '',
  newPlan: plan.name,
  nextDate: nextPaymentDate.value
}))

const confirmTitle = computed(() =>
  isImmediate.value ? copy.confirmUpgradeTitle : copy.confirmChangeTitle
)
const confirmCta = computed(() => {
  // Gated on isReactivating, like the banner and the emitted consent, so the
  // label never promises a reactivation the click will not confirm.
  if (!isReactivating.value) {
    return isImmediate.value ? copy.confirmUpgradeCta : copy.confirmChange
  }
  if (reactivationVariant.value === 'downgrade') {
    return copy.reactivation.confirmButton
  }
  return copy.reactivation.confirmButtonWithCharge(chargeDisplay.value)
})
const amountDueToday = computed(
  () => formatAmountDueToday(previewData, locale) || copy.quoteUnavailable
)
const renewalTerms = computed(() => {
  const amount = formatRenewalAmount(previewData, locale)
  if (!amount) return copy.quoteUnavailable
  const renewsAt = resolveRenewalDate(previewData)
  if (!renewsAt) return copy.renewsAtAmount(amount)
  return copy.renewsAt(amount, formatDate(renewsAt))
})
</script>
