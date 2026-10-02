<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  formatQuoteMoney,
  isAnnualDuration
} from '@comfyorg/account-ui/billing/checkout'

import { isLocked, submitPhaseOf } from '@/checkout/checkoutPage'
import { endingOf } from '@/checkout/endingScreen'
import type { EndingPlan } from '@/components/fullPage/EndingPlanCard.vue'
import CheckoutEnding from '@/components/fullPage/CheckoutEnding.vue'
import type { CheckoutCharge } from '@/components/fullPage/CheckoutPaymentColumn.vue'
import CheckoutPaymentColumn from '@/components/fullPage/CheckoutPaymentColumn.vue'
import { successBreakdown } from '@/checkout/successBreakdown'
import type { LedgerContext } from '@/checkout/summaryLedger'
import { buildSummaryLedger } from '@/checkout/summaryLedger'
import CheckoutSummaryColumn from '@/components/fullPage/CheckoutSummaryColumn.vue'
import { keepSubscriptionCopy } from '@/checkout/keepSubscription'
import PromoCodeEntry from '@/components/fullPage/summary/PromoCodeEntry.vue'
import { useFullPageCheckout } from '@/composables/useFullPageCheckout'
import { useHostedCopy } from '@/composables/useHostedCopy'
import { useBillingWebStripeKey } from '@/config/stripeKey'
import { useBillingWebSession } from '@/session/billingWebSession'
import { reportReturnClicked } from '@/telemetry/webReturnTelemetry'

const { t, locale } = useI18n()
const { coded } = useHostedCopy()
const { session } = useBillingWebSession()
const stripeKey = useBillingWebStripeKey()
const {
  page,
  preview,
  canPay,
  returnLink,
  viewPlansLink,
  openedByScript,
  close,
  retryLoad,
  onPaymentPhase,
  savedMethods,
  retryElement,
  retrySaved,
  retryColumn,
  selectTab,
  confirmReactivation,
  payWithoutConsent,
  cancelAt,
  promo,
  promoLive,
  pay,
  reopening,
  continueVerification,
  cancelPayment,
  reconcile
} = useFullPageCheckout()

// A page restored from the back-forward cache is whatever it was when the
// customer left, which may be a form over money that has since moved (rule 16).
// One that left for a payment method's own site loads afresh instead: the
// challenge it handed over froze with it and never settles.
useEventListener(window, 'pageshow', (event: PageTransitionEvent) => {
  if (!event.persisted) return
  if (leftForProvider()) window.location.reload()
  else void reconcile()
})

function leftForProvider() {
  const current = page.value
  return (
    current.kind === 'capture' && submitPhaseOf(current).kind === 'redirecting'
  )
}

const quote = computed(() =>
  page.value.kind === 'capture' || page.value.kind === 'waiting'
    ? preview.value
    : undefined
)

const ledgerContext = computed<LedgerContext>(() => ({
  workspace: session.value?.workspace.name,
  tierName: (tier) => coded('tier', tier),
  t,
  locale: locale.value
}))

const ledger = computed(() => {
  const quoted = quote.value
  if (!quoted) return undefined
  return buildSummaryLedger(quoted, ledgerContext.value)
})

const charge = computed<CheckoutCharge | undefined>(() => {
  const quoted = quote.value
  if (!quoted) return undefined
  return {
    amountCents: quoted.amount_due_cents ?? quoted.cost_today_cents,
    currency: quoted.currency ?? 'usd',
    paymentMethodConfigurationId: quoted.payment_method_configuration_id ?? ''
  }
})

const keepSubscription = computed(() => {
  const quoted = quote.value
  if (!quoted) return undefined
  return keepSubscriptionCopy(quoted, cancelAt.value, {
    tierName: (tier) => coded('tier', tier),
    t,
    locale: locale.value
  })
})

const ending = computed(() => endingOf(page.value))

const breakdown = computed(() =>
  successBreakdown(page.value, ledgerContext.value)
)

const locked = computed(() => isLocked(page.value))

/**
 * The plan a settled payment bought: as this page's own quote priced it, or,
 * for any payment it did not price here, as the server's catalog lists it.
 */
const boughtPlan = computed(() => {
  const current = page.value
  if (current.kind === 'terminal' && current.attribution !== 'started')
    return current.plan && { ...current.plan, currency: 'usd' }
  const quoted = preview.value
  return quoted && { ...quoted.new_plan, currency: quoted.currency ?? 'usd' }
})

const endingPlan = computed<EndingPlan | undefined>(() => {
  const plan = boughtPlan.value
  if (!plan) return undefined
  return {
    name: coded('tier', plan.tier),
    price: formatQuoteMoney(
      Number(plan.price_cents),
      plan.currency,
      locale.value
    ),
    period: t(
      isAnnualDuration(plan.duration)
        ? 'checkout.fullPage.ending.perYear'
        : 'checkout.fullPage.ending.perMonth',
      { currency: plan.currency.toUpperCase() }
    )
  }
})

function goBack() {
  reportReturnClicked('back')
  window.location.assign(returnLink.value)
}

function viewPlans() {
  window.location.assign(viewPlansLink.value)
}
</script>

<template>
  <CheckoutEnding
    v-if="ending"
    :screen="ending"
    :workspace="
      session?.workspace.name ?? t('checkout.fullPage.ending.thisWorkspace')
    "
    :plan="endingPlan"
    :breakdown
    :closes-itself="openedByScript"
    @close="close"
    @retry="retryLoad"
    @view-plans="viewPlans"
  />
  <main
    v-else
    class="dark-theme fixed inset-0 overflow-auto bg-secondary-background font-inter"
  >
    <h1 class="sr-only">{{ t('hosted.title.checkout') }}</h1>
    <div class="flex min-h-full flex-col lg:flex-row">
      <CheckoutSummaryColumn
        v-slot="{ ledger: shown }"
        :ledger
        :locked
        :repricing="promo.busy.value"
        @back="goBack"
      >
        <PromoCodeEntry
          :chips="shown.chips"
          :entry="promo.entry.value"
          :accepts="shown.acceptsPromo"
          :live="promoLive"
          @open="promo.open"
          @edit="promo.edit"
          @dismiss="promo.dismiss"
          @apply="promo.apply"
          @remove="promo.remove"
        />
      </CheckoutSummaryColumn>
      <CheckoutPaymentColumn
        v-if="
          page.kind === 'resolving' ||
          page.kind === 'capture' ||
          page.kind === 'waiting'
        "
        :page
        :charge
        :publishable-key="stripeKey ?? ''"
        :can-pay="canPay"
        :reopening
        :keep-subscription="keepSubscription"
        :saved-methods="savedMethods"
        @phase="onPaymentPhase"
        @pay="pay"
        @retry-element="retryElement"
        @retry-saved="retrySaved"
        @retry-column="retryColumn"
        @select-tab="selectTab"
        @confirm-reactivation="confirmReactivation"
        @consent-missing="payWithoutConsent"
        @cancel="cancelPayment"
        @continue-verification="continueVerification"
      />
    </div>
  </main>
</template>
