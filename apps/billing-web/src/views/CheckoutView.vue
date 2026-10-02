<script setup lang="ts">
/**
 * The hosted checkout: the cloud app's embedded checkout steps
 * (`@comfyorg/account-ui/billing/checkout`) in the app's dialog frame, with
 * `commands.subscribe` behind them. The plan was chosen in the host app, so
 * every way out leads back there. A hosted continuation redirects this tab
 * and comes back on `/v1/result`.
 */
import { useTimeoutFn } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  BillingDeclineReason,
  WebReturnControl
} from '@comfyorg/account-core/billing'
import {
  awaitsHostedAction,
  declineDetailKey,
  validateActionUrl
} from '@comfyorg/account-core/billing'
import {
  useBillingClient,
  useCheckout,
  usePaymentMethods,
  usePlans,
  usePreviewSubscribe
} from '@comfyorg/account-ui/billing'
import type { CheckoutPlan } from '@comfyorg/account-ui/billing/checkout'
import {
  CheckoutSubscribeConfirm,
  CheckoutTeamSuccess,
  CheckoutTransitionConfirm,
  isAnnualDuration
} from '@comfyorg/account-ui/billing/checkout'
import {
  buildBillingEntryUrl,
  buildReturnUrl
} from '@comfyorg/billing-contract'

import type { PaymentChoice } from '@/checkout/checkoutRequest'
import {
  buildSubscribeRequest,
  teamCheckoutPlan,
  tierCheckoutPlan
} from '@/checkout/checkoutRequest'
import CheckoutFrame from '@/components/CheckoutFrame.vue'
import type { CheckoutToastItem } from '@/components/CheckoutToasts.vue'
import CheckoutToasts from '@/components/CheckoutToasts.vue'
import { useBilledWorkspace } from '@/composables/useBilledWorkspace'
import { useCheckoutCopy } from '@/composables/useCheckoutCopy'
import { useHostedCopy } from '@/composables/useHostedCopy'
import { BILLING_WEB_ENV } from '@/config/env'
import {
  awaitBillingWebStripeKey,
  useBillingWebStripeKey
} from '@/config/stripeKey'
import { useBillingEntry } from '@/entry/billingEntry'
import { returnToHost } from '@/entry/returnToHost'
import { createDeferredStripeChallengePort } from '@/session/stripeChallengePort'
import { useWorkspaceInvites } from '@/session/workspaceInvites'
import {
  checkoutAttemptOf,
  createSubscriptionCheckoutTelemetry
} from '@/telemetry/subscriptionCheckoutTelemetry'
import { reportReturnClicked } from '@/telemetry/webReturnTelemetry'

const { locale, t } = useI18n()
const { coded, refusal } = useHostedCopy()
const { copy, successCopy, inviteCopy, tierName } = useCheckoutCopy()
const invites = useWorkspaceInvites()
const { entry } = useBillingEntry()
const billedWorkspace = useBilledWorkspace()

const planSlug = computed(() => entry.value?.plan)
const teamCreditStopId = computed(() => entry.value?.teamCreditStopId)

const {
  preview,
  loading,
  failure,
  quote,
  reset: resetQuote
} = usePreviewSubscribe()
const { methods, defaultMethod } = usePaymentMethods()
const { plans } = usePlans()

// Reactive: `stripeKey` still reflects a server key that resolves after this
// setup runs, instead of the fallback this ref started with.
const stripeKey = useBillingWebStripeKey()

const { lifecycle, status } = useBillingClient<'lifecycle' | 'status'>(
  undefined
)

const checkout = useCheckout({
  openUrl: (url) => window.location.assign(url),
  navigationMode: 'redirect',
  // Deferred: reads the key at challenge time, not this setup's snapshot.
  challengePort: createDeferredStripeChallengePort(awaitBillingWebStripeKey)
})

const attempts = createSubscriptionCheckoutTelemetry({ ui: 'embedded' })

const quotedPlan = ref<string | undefined>()
const quotedTeamCreditStopId = ref<string | undefined>()
const quoteIsCurrent = ref(false)
const applyingPromotionCode = ref(false)
const submitFailure = ref<string | undefined>()
const inviteFailure = ref<string | undefined>()

async function quotePlan(
  slug: string | undefined,
  stopId: string | undefined,
  promotionCode?: string
) {
  quotedPlan.value = slug
  quotedTeamCreditStopId.value = stopId
  if (slug === undefined) return
  const result = await quote({
    planSlug: slug,
    ...(stopId === undefined ? {} : { teamCreditStopId: stopId }),
    ...(promotionCode ? { promotionCode } : {})
  })
  if (result.status === 'ok') quoteIsCurrent.value = true
  return result
}

// A payment the server still holds for this workspace is the one the confirm
// reports on, as in the app, which adopts it from the billing status.
/**
 * When the subscription ends, from the billing status's `cancel_at`: the field
 * the app's reactivation notice reads, so both hosts name the same date.
 */
const subscriptionEndDate = ref<string | null>(null)

async function readSubscriptionEnd() {
  const result = await status.read()
  if (result.status === 'ok')
    subscriptionEndDate.value = result.value.status.cancel_at ?? null
}

onMounted(() => {
  void lifecycle.recover()
  void readSubscriptionEnd()
  void quotePlan(planSlug.value, teamCreditStopId.value)
})

// The route record is shared, so arriving with a different plan (or, for a
// team plan, a different credit stop) reuses the view. A payment in flight
// outranks the new link — repricing under it would show one plan's summary
// beside another plan's steps — but that deferral has to be made good the
// moment the operation is dismissed, or the form returns pricing what the
// customer left. Watching the operation is what closes that gap;
// `quotedPlan`/`quotedTeamCreditStopId` are what tell the two apart.
watch(
  [planSlug, teamCreditStopId, () => checkout.operation.value !== undefined],
  ([slug, stopId, busy]) => {
    if (
      busy ||
      (slug === quotedPlan.value && stopId === quotedTeamCreditStopId.value)
    ) {
      return
    }
    resetQuote()
    serverDemandsReactivation.value = false
    void quotePlan(slug, stopId)
  }
)

/**
 * A cancelled subscription is reactivated by subscribing again, and the server
 * wants that charge confirmed in so many words: the quote says so up front
 * (`requires_reactivation_confirmation`), or the subscribe answers
 * `REACTIVATION_CONFIRMATION_REQUIRED` and the plan is re-quoted before the
 * customer is asked through the plan-change confirm's reactivation banner.
 */
const serverDemandsReactivation = ref(false)
const reactivationRequired = computed(
  () =>
    preview.value?.requires_reactivation_confirmation === true ||
    serverDemandsReactivation.value
)

watch(preview, () => {
  submitFailure.value = undefined
})

async function applyPromotionCode(code: string) {
  applyingPromotionCode.value = true
  submitFailure.value = undefined
  const result = await quotePlan(
    planSlug.value,
    teamCreditStopId.value,
    code.trim()
  )
  applyingPromotionCode.value = false
  if (result?.status === 'error') submitFailure.value = refusal(result)
}

/**
 * The saved method the server marks default is preselected, as in the app;
 * choosing "Add new payment method" (or Change) swaps in the card form.
 */
const selectedSavedMethodId = ref<string | null>(null)
const collectingNewPaymentMethod = ref(false)

watch(
  defaultMethod,
  (method) => {
    if (collectingNewPaymentMethod.value || selectedSavedMethodId.value) return
    selectedSavedMethodId.value = method?.id ?? null
  },
  { immediate: true }
)

function selectSavedMethod(id: string | null) {
  collectingNewPaymentMethod.value = id === null
  selectedSavedMethodId.value = id
}

const savedMethodsForConfirm = computed(() =>
  collectingNewPaymentMethod.value || !selectedSavedMethodId.value
    ? []
    : (methods.value ?? [])
)

/**
 * A plan change on an existing subscription charges its saved default
 * payment method server-side and never accepts a new one; only a genuine new
 * subscription takes a card or a saved-method choice (#18684).
 */
const isNewSubscription = computed(
  () => preview.value?.transition_type === 'new_subscription'
)

const checkoutPlan = computed<CheckoutPlan | undefined>(() => {
  const quoted = preview.value
  if (!quoted) return undefined
  const stopId = teamCreditStopId.value
  return stopId === undefined
    ? tierCheckoutPlan(quoted, tierName(quoted.new_plan.tier))
    : teamCheckoutPlan(
        quoted,
        plans.value?.team_credit_stops,
        stopId,
        t('checkout.teamPlanName')
      )
})

const currentPlanName = computed(() => {
  const tier = preview.value?.current_plan?.tier
  if (!tier) return ''
  return tier === 'TEAM' ? t('checkout.teamPlanName') : tierName(tier)
})

const billingCycle = computed(() =>
  isAnnualDuration(preview.value?.new_plan.duration) ? 'yearly' : 'monthly'
)

function declineDetail(reason: BillingDeclineReason): string {
  return t(`checkout.operation.${declineDetailKey(reason)}`)
}

/**
 * The app keeps the confirm on screen through a payment and reports how it
 * ended: a verification that failed in this tab as the confirm's inline
 * notice, a settlement the server holds as its reconciliation notice, and a
 * decline or a timeout as an error toast, after which the confirm is usable
 * again.
 */
const pendingOperation = computed(() => {
  const operation = checkout.operation.value
  return operation?.phase === 'pending' ? operation : undefined
})

const authenticationState = computed(() => {
  const operation = pendingOperation.value
  if (!operation) return null
  if (operation.challenge?.status === 'failed') return 'failed_retryable'
  return operation.authenticationState ?? null
})

/** The app's payment-progress toast: shown while the payment is pending. */
const operationToast = computed(() => {
  const operation = pendingOperation.value
  if (!operation) return undefined
  return awaitsHostedAction(operation)
    ? {
        severity: 'warn' as const,
        summary: t('checkout.operation.subscriptionActionRequired')
      }
    : {
        severity: 'info' as const,
        summary: t('checkout.operation.subscriptionProcessing')
      }
})

const actionUrl = computed(
  () => validateActionUrl(pendingOperation.value?.actionUrl) ?? null
)

const parkedCheckoutRecovery = computed(
  () => pendingOperation.value?.serverPhase === 'awaiting_payment_method'
)

const authenticationError = computed(() =>
  authenticationState.value === 'failed_retryable'
    ? declineDetail(
        pendingOperation.value?.declineReason ?? 'authentication_failed'
      )
    : null
)

/**
 * The app's busy rule: a pending payment holds the confirm unless it waits
 * on the customer, and an in-page challenge holds it until it settles.
 */
const operationHoldsConfirm = computed(() => {
  const operation = pendingOperation.value
  if (!operation) return false
  if (operation.challenge?.status === 'in_progress') return true
  if (parkedCheckoutRecovery.value) return false
  return (
    authenticationState.value !== 'failed_retryable' &&
    authenticationState.value !== 'requires_action'
  )
})

/** The app keeps a closed progress toast closed until the operation's state changes. */
const operationToastKey = computed(() =>
  operationToast.value
    ? `${pendingOperation.value?.id}:${operationToast.value.severity}`
    : undefined
)
const dismissedOperationToast = ref<string>()

const reconciliationOperationId = computed(() => {
  const operation = checkout.operation.value
  return operation?.phase === 'reconciliation_needed' ? operation.id : null
})

watch(
  () => checkout.operation.value,
  (operation) => {
    if (operation === undefined) return
    if (operation.phase === 'failed') {
      submitFailure.value = declineDetail(operation.declineReason)
      checkout.reset()
    } else if (operation.phase === 'timed_out') {
      submitFailure.value = t('checkout.operation.subscriptionTimeout')
      checkout.reset()
    } else if (
      operation.phase === 'pending' &&
      operation.declineReason !== undefined
    ) {
      submitFailure.value = declineDetail(operation.declineReason)
      checkout.reset()
    }
  }
)

const succeeded = computed(() => checkout.projection.value.step === 'success')

/**
 * The seats the success step's team invite counts against, read once the
 * subscribe settles and again after invites are sent, as the app refreshes
 * its billing status.
 */
const seats = ref<{ max: number | null; occupied: number | null }>({
  max: null,
  occupied: null
})

async function readSeats() {
  const result = await status.read()
  if (result.status !== 'ok') return
  seats.value = {
    max: result.value.status.max_seats,
    occupied: result.value.status.occupied_seats
  }
}

watch(succeeded, (done) => {
  if (done) void readSeats()
})

/**
 * As in the app, a subscribe the server had to take a payment for (or one
 * this tab recovered mid-payment) announces its success for five seconds.
 */
const SUCCESS_TOAST_LIFE_MS = 5000
const {
  isPending: successToastShown,
  start: showSuccessToast,
  stop: dismissSuccessToast
} = useTimeoutFn(() => {}, SUCCESS_TOAST_LIFE_MS, { immediate: false })

const announcedSuccess = ref<string>()
watch(
  () => [succeeded.value, checkout.submitting.value] as const,
  ([settled, submitting]) => {
    const id = checkout.projection.value.operationId
    if (!settled || submitting || id === announcedSuccess.value) return
    announcedSuccess.value = id
    const result = checkout.result.value
    const tookPayment =
      result?.status !== 'ok' || result.value.issuedStatus !== 'subscribed'
    if (tookPayment) showSuccessToast()
  }
)

const toasts = computed(() => {
  const shown: CheckoutToastItem[] = []
  const operation = operationToast.value
  if (operation && operationToastKey.value !== dismissedOperationToast.value)
    shown.push({ key: 'operation', variant: 'operation', ...operation })
  if (submitFailure.value)
    shown.push({
      key: 'failure',
      severity: 'error',
      summary: t('checkout.error'),
      detail: submitFailure.value
    })
  if (inviteFailure.value)
    shown.push({
      key: 'invite',
      severity: 'error',
      summary: inviteFailure.value
    })
  if (successToastShown.value)
    shown.push({
      key: 'success',
      severity: 'success',
      summary: t('checkout.operation.subscriptionSuccess')
    })
  return shown
})

function closeToast(key: string) {
  if (key === 'operation')
    dismissedOperationToast.value = operationToastKey.value
  if (key === 'failure') submitFailure.value = undefined
  if (key === 'invite') inviteFailure.value = undefined
  if (key === 'success') dismissSuccessToast()
}

const paying = computed(
  () =>
    checkout.submitting.value ||
    (operationHoldsConfirm.value && !succeeded.value)
)

const frameStep = computed(() => {
  if (succeeded.value) return isNewSubscription.value ? 'success' : 'fit'
  return isNewSubscription.value && savedMethodsForConfirm.value.length === 0
    ? 'payment'
    : 'confirm'
})

const quoting = computed(() => loading.value && preview.value === undefined)

const returnLink = computed(() => {
  const arrival = entry.value
  if (!arrival) return undefined
  const url = buildReturnUrl({
    target: arrival.returnTo,
    environment: BILLING_WEB_ENV,
    workspace: billedWorkspace(),
    result: succeeded.value ? 'success' : undefined,
    reference: checkout.projection.value.operationId
  })
  return url?.href
})

/** Where a hosted payment step sends the customer back: this origin, same request. */
function resultUrl(): string | undefined {
  const arrival = entry.value
  if (!arrival) return undefined
  const workspaceId = billedWorkspace()
  const built = buildBillingEntryUrl({
    billingOrigin: window.location.origin,
    intent: 'result',
    product: arrival.product,
    returnTo: arrival.returnTo,
    ...(arrival.plan === undefined ? {} : { plan: arrival.plan }),
    ...(arrival.teamCreditStopId === undefined
      ? {}
      : { teamCreditStopId: arrival.teamCreditStopId }),
    ...(workspaceId === undefined ? {} : { workspaceId })
  })
  return built.status === 'ok' ? built.url.href : undefined
}

async function pay(choice: PaymentChoice) {
  const quoted = preview.value
  const slug = planSlug.value
  if (slug === undefined || !quoted || loading.value) return
  submitFailure.value = undefined
  const result = await attempts.run(
    checkoutAttemptOf(quoted, entry.value),
    () =>
      checkout.subscribe(
        buildSubscribeRequest(
          {
            planSlug: slug,
            teamCreditStopId: teamCreditStopId.value,
            returnUrl: resultUrl()
          },
          quoted,
          choice
        )
      )
  )
  if (result.status === 'ok') return
  if (result.code === 'REACTIVATION_CONFIRMATION_REQUIRED') {
    // The quote did not say so, the server did: price it again and ask.
    serverDemandsReactivation.value = true
    await quotePlan(planSlug.value, teamCreditStopId.value)
    return
  }
  if (result.code === 'QUOTE_STALE') {
    quoteIsCurrent.value = false
    const requoted = await quotePlan(planSlug.value, teamCreditStopId.value)
    submitFailure.value = coded(
      'failure',
      requoted?.status === 'ok' ? 'QUOTE_STALE' : 'QUOTE_REFRESH_FAILED'
    )
    return
  }
  submitFailure.value = refusal(result)
}

function payWithoutCard() {
  void pay(
    isNewSubscription.value && selectedSavedMethodId.value
      ? { savedPaymentMethodId: selectedSavedMethodId.value }
      : {}
  )
}

function leaveForHost(control: WebReturnControl) {
  const href = returnLink.value
  if (href === undefined) return
  reportReturnClicked(control)
  returnToHost(href)
}
</script>

<template>
  <main
    class="dark-theme fixed inset-0 overflow-auto bg-charcoal-950 px-4 py-6 font-inter sm:px-6 sm:py-10"
  >
    <section
      class="mx-auto flex min-h-full max-w-7xl flex-col items-center justify-center gap-4"
    >
      <p v-if="quoting" class="m-0 text-sm text-muted-foreground">
        {{ t('hosted.loading') }}
      </p>
      <section
        v-else-if="failure && !preview"
        class="rounded-xl border border-border-subtle bg-secondary-background p-6"
      >
        <p class="m-0 text-sm text-destructive-background">
          {{ refusal(failure) }}
        </p>
        <button
          v-if="returnLink"
          type="button"
          class="mt-4 cursor-pointer text-sm text-base-foreground underline underline-offset-4"
          @click="leaveForHost('back')"
        >
          {{ t('checkout.back') }}
        </button>
      </section>
      <template v-else-if="preview && checkoutPlan">
        <CheckoutFrame
          :step="frameStep"
          :close-label="t('checkout.close')"
          @close="leaveForHost('close')"
        >
          <CheckoutTeamSuccess
            v-if="succeeded"
            :plan="checkoutPlan"
            :copy="successCopy"
            :invite-copy="inviteCopy"
            :locale
            :preview-data="preview"
            :billing-cycle
            :dark-surface="isNewSubscription"
            :max-seats="seats.max"
            :occupied-seats="seats.occupied"
            :invites
            @invited="readSeats"
            @invites-failed="inviteFailure = $event"
            @close="leaveForHost('success_close')"
          />
          <CheckoutSubscribeConfirm
            v-else-if="isNewSubscription"
            :selected-saved-method-id="selectedSavedMethodId"
            :plan="checkoutPlan"
            :copy
            :locale
            :publishable-key="stripeKey ?? ''"
            :billing-cycle
            :is-loading="paying"
            :preview-data="preview"
            :use-payment-element="true"
            :saved-methods="savedMethodsForConfirm"
            :action-url
            :authentication-state
            :authentication-error
            :reconciliation-operation-id
            :parked-checkout-recovery
            :quote-is-current
            :is-applying-promotion-code="applyingPromotionCode"
            :embedded-checkout-enabled="true"
            @update:selected-saved-method-id="selectSavedMethod"
            @change-payment-method="selectSavedMethod(null)"
            @add-credit-card="payWithoutCard"
            @confirm-payment="pay({ confirmationToken: $event })"
            @apply-promotion-code="applyPromotionCode"
            @invalidate-quote="quoteIsCurrent = false"
            @back="leaveForHost('back')"
          />
          <CheckoutTransitionConfirm
            v-else
            :preview-data="preview"
            :plan="checkoutPlan"
            :current-plan-name
            :copy
            :locale
            :subscription-loaded="true"
            :subscription-end-date
            :is-loading="paying"
            :force-reactivation="reactivationRequired"
            :action-url
            :authentication-state
            :authentication-error
            :reconciliation-operation-id
            :quote-is-current
            :is-applying-promotion-code="applyingPromotionCode"
            :embedded-checkout-enabled="true"
            @confirm="pay({ confirmReactivation: $event })"
            @apply-promotion-code="applyPromotionCode"
            @invalidate-quote="quoteIsCurrent = false"
            @back="leaveForHost('back')"
          />
        </CheckoutFrame>
      </template>
    </section>
    <CheckoutToasts
      :toasts
      :close-label="t('checkout.close')"
      @close="closeToast"
    />
  </main>
</template>
