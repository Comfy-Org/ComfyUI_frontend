<script setup lang="ts">
/**
 * The hosted checkout: the cloud app's embedded checkout steps
 * (`@comfyorg/account-ui/billing/checkout`) in the app's dialog frame, with
 * `commands.subscribe` behind them. The plan was chosen in the host app, so
 * every way out leads back there. A hosted continuation redirects this tab
 * and comes back on `/v1/result`.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  PaymentStep,
  SubscribeInput,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import {
  CheckoutSteps,
  useCheckout,
  usePaymentMethods,
  usePlans,
  usePreviewSubscribe
} from '@comfyorg/account-ui/billing'
import type { CheckoutPlan } from '@comfyorg/account-ui/billing/checkout'
import {
  TIER_CATALOG,
  toCatalogTierKey
} from '@comfyorg/account-ui/billing/catalog'
import {
  CheckoutSubscribeConfirm,
  CheckoutSuccess,
  CheckoutTransitionConfirm,
  isAnnualDuration
} from '@comfyorg/account-ui/billing/checkout'
import {
  buildBillingEntryUrl,
  buildReturnUrl
} from '@comfyorg/billing-contract'

import CheckoutFrame from '@/components/CheckoutFrame.vue'
import { useBilledWorkspace } from '@/composables/useBilledWorkspace'
import { useCheckoutCopy } from '@/composables/useCheckoutCopy'
import { useHostedCopy } from '@/composables/useHostedCopy'
import { BILLING_WEB_ENV } from '@/config/env'
import {
  awaitBillingWebStripeKey,
  useBillingWebStripeKey
} from '@/config/stripeKey'
import { useBillingEntry } from '@/entry/billingEntry'
import { createDeferredStripeChallengePort } from '@/session/stripeChallengePort'

const { locale, t } = useI18n()
const { coded } = useHostedCopy()
const { copy, successCopy, tierName } = useCheckoutCopy()
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

const checkout = useCheckout({
  openUrl: (url) => window.location.assign(url),
  navigationMode: 'redirect',
  // Deferred: reads the key at challenge time, not this setup's snapshot.
  challengePort: createDeferredStripeChallengePort(awaitBillingWebStripeKey)
})

const quotedPlan = ref<string | undefined>()
const quotedTeamCreditStopId = ref<string | undefined>()
const quoteIsCurrent = ref(false)
const applyingPromotionCode = ref(false)
const submitFailure = ref<string | undefined>()

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

onMounted(() => void quotePlan(planSlug.value, teamCreditStopId.value))

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
  if (result?.status === 'error')
    submitFailure.value = coded('failure', result.code)
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
  if (teamCreditStopId.value !== undefined) {
    const monthlyUsd =
      quoted.new_plan.price_cents /
      (isAnnualDuration(quoted.new_plan.duration) ? 12 : 1) /
      100
    const stop = plans.value?.team_credit_stops?.stops.find(
      (candidate) => candidate.id === teamCreditStopId.value
    )
    return {
      name: t('checkout.teamPlanName'),
      monthlyPriceUsd: { monthly: monthlyUsd, yearly: monthlyUsd },
      monthlyCredits: stop ? Number(stop.credits) : 0,
      pricedByQuote: false
    }
  }
  const tierKey = toCatalogTierKey(quoted.new_plan.tier)
  const tier = tierKey === undefined ? undefined : TIER_CATALOG[tierKey]
  return {
    name: tierName(quoted.new_plan.tier),
    monthlyPriceUsd: { monthly: tier?.monthly ?? 0, yearly: tier?.yearly ?? 0 },
    monthlyCredits: tier?.credits ?? 0,
    pricedByQuote: true
  }
})

const currentPlanName = computed(() => {
  const tier = preview.value?.current_plan?.tier
  if (!tier) return ''
  return tier === 'TEAM' ? t('checkout.teamPlanName') : tierName(tier)
})

const billingCycle = computed(() =>
  isAnnualDuration(preview.value?.new_plan.duration) ? 'yearly' : 'monthly'
)

/** Outcomes the app reports in a toast; this page has none, so it says them here. */
const SETTLED_FAILURE_STEPS: readonly PaymentStep[] = [
  'declined',
  'processing_error',
  'payment_received_hold'
]

const settledFailure = computed(
  () =>
    checkout.operation.value !== undefined &&
    SETTLED_FAILURE_STEPS.includes(checkout.projection.value.step)
)

const succeeded = computed(() => checkout.projection.value.step === 'success')

const paying = computed(
  () =>
    checkout.submitting.value ||
    (checkout.operation.value !== undefined &&
      !settledFailure.value &&
      !succeeded.value)
)

const frameStep = computed(() => {
  if (succeeded.value) return 'success'
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

interface PaymentChoice {
  readonly confirmationToken?: string
  readonly savedPaymentMethodId?: string
  readonly confirmReactivation?: boolean
}

/**
 * The quote's identity travels with the charge, so the server prices what
 * the customer saw. A card entered here travels as `confirmationToken`; a
 * saved method as its id; a plan change carries neither, and the server
 * charges the method on file.
 */
function subscribeRequest(
  plan: string,
  quoted: SubscriptionPreview,
  choice: PaymentChoice
): SubscribeInput {
  const returnUrl = resultUrl()
  return {
    plan_slug: plan,
    ...(choice.confirmationToken === undefined
      ? {}
      : { confirmation_token: choice.confirmationToken }),
    ...(choice.savedPaymentMethodId === undefined
      ? {}
      : { saved_payment_method_id: choice.savedPaymentMethodId }),
    ...(teamCreditStopId.value === undefined
      ? {}
      : { team_credit_stop_id: teamCreditStopId.value }),
    ...(quoted.quote_id === undefined ? {} : { quote_id: quoted.quote_id }),
    ...(quoted.quote_version === undefined
      ? {}
      : { quote_version: quoted.quote_version }),
    ...(quoted.promotion_code ? { promotion_code: quoted.promotion_code } : {}),
    ...(quoted.is_immediate && quoted.proration_at !== undefined
      ? { proration_at: quoted.proration_at }
      : {}),
    ...(returnUrl === undefined ? {} : { return_url: returnUrl }),
    ...(choice.confirmReactivation ? { confirm_reactivation: true } : {})
  }
}

async function pay(choice: PaymentChoice) {
  const quoted = preview.value
  if (planSlug.value === undefined || !quoted || loading.value) return
  submitFailure.value = undefined
  const result = await checkout.subscribe(
    subscribeRequest(planSlug.value, quoted, choice)
  )
  if (result.status === 'ok') return
  if (result.code === 'REACTIVATION_CONFIRMATION_REQUIRED') {
    // The quote did not say so, the server did: price it again and ask.
    serverDemandsReactivation.value = true
    await quotePlan(planSlug.value, teamCreditStopId.value)
    return
  }
  submitFailure.value = coded('failure', result.code)
}

function payWithoutCard() {
  void pay(
    isNewSubscription.value && selectedSavedMethodId.value
      ? { savedPaymentMethodId: selectedSavedMethodId.value }
      : {}
  )
}

function returnToHost() {
  const href = returnLink.value
  if (href !== undefined) window.location.assign(href)
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
          {{ coded('failure', failure.code) }}
        </p>
        <button
          v-if="returnLink"
          type="button"
          class="mt-4 cursor-pointer text-sm text-base-foreground underline underline-offset-4"
          @click="returnToHost"
        >
          {{ t('checkout.back') }}
        </button>
      </section>
      <template v-else-if="preview && checkoutPlan">
        <p
          v-if="submitFailure"
          role="alert"
          class="m-0 rounded-lg border border-interface-stroke bg-secondary-background p-4 text-sm text-base-foreground"
        >
          {{ submitFailure }}
        </p>
        <CheckoutFrame
          :step="frameStep"
          :close-label="t('checkout.close')"
          @close="returnToHost"
        >
          <CheckoutSuccess
            v-if="succeeded"
            :plan="checkoutPlan"
            :copy="successCopy"
            :locale
            :preview-data="preview"
            :billing-cycle
            :dark-surface="isNewSubscription"
            @close="returnToHost"
          />
          <CheckoutSteps
            v-else-if="settledFailure"
            :projection="checkout.projection.value"
            root-class="flex flex-col gap-3 pt-8"
            header-class="m-0 text-base font-semibold text-base-foreground"
            body-class="m-0 text-sm text-muted-foreground"
            reason-class="m-0 text-sm text-destructive-background"
            safety-class="m-0 text-sm text-muted-foreground"
            actions-class="mt-2 flex gap-2"
            action-class="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg bg-base-foreground px-5 font-semibold text-base-background"
            @retry="checkout.reset()"
            @cancel="checkout.cancel()"
            @continue-verification="checkout.continueVerification()"
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
            :quote-is-current
            :is-applying-promotion-code="applyingPromotionCode"
            :embedded-checkout-enabled="true"
            @update:selected-saved-method-id="selectSavedMethod"
            @change-payment-method="selectSavedMethod(null)"
            @add-credit-card="payWithoutCard"
            @confirm-payment="pay({ confirmationToken: $event })"
            @apply-promotion-code="applyPromotionCode"
            @invalidate-quote="quoteIsCurrent = false"
            @back="returnToHost"
          />
          <CheckoutTransitionConfirm
            v-else
            :preview-data="preview"
            :plan="checkoutPlan"
            :current-plan-name
            :copy
            :locale
            :subscription-loaded="true"
            :is-loading="paying"
            :force-reactivation="reactivationRequired"
            :quote-is-current
            :is-applying-promotion-code="applyingPromotionCode"
            :embedded-checkout-enabled="true"
            @confirm="pay({ confirmReactivation: $event })"
            @apply-promotion-code="applyPromotionCode"
            @invalidate-quote="quoteIsCurrent = false"
            @back="returnToHost"
          />
        </CheckoutFrame>
      </template>
    </section>
  </main>
</template>
