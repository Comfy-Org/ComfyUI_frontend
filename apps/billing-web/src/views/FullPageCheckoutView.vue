<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SubscriptionPreview } from '@comfyorg/account-core/billing'
import {
  formatQuoteMoney,
  isAnnualDuration
} from '@comfyorg/account-ui/billing/checkout'

import {
  PENDING_PAYMENT_CANCEL_AVAILABLE,
  isLocked
} from '@/checkout/checkoutPage'
import { endingOf } from '@/checkout/endingScreen'
import { operationPlanLabel, operationPlanOf } from '@/checkout/operationPlan'
import type { EndingPlan } from '@/components/fullPage/CheckoutEnding.vue'
import CheckoutEnding from '@/components/fullPage/CheckoutEnding.vue'
import type { CheckoutCharge } from '@/components/fullPage/CheckoutPaymentColumn.vue'
import CheckoutPaymentColumn from '@/components/fullPage/CheckoutPaymentColumn.vue'
import type { LedgerContext } from '@/checkout/summaryLedger'
import { buildSummaryLedger } from '@/checkout/summaryLedger'
import CheckoutSummaryColumn from '@/components/fullPage/CheckoutSummaryColumn.vue'
import { keepSubscriptionCopy } from '@/checkout/keepSubscription'
import PromoCodeEntry from '@/components/fullPage/summary/PromoCodeEntry.vue'
import { useFullPageCheckout } from '@/composables/useFullPageCheckout'
import { useHostedCopy } from '@/composables/useHostedCopy'
import { useBillingWebStripeKey } from '@/config/stripeKey'
import { useBillingWebSession } from '@/session/billingWebSession'

const { t, locale } = useI18n()
const { coded } = useHostedCopy()
const { session } = useBillingWebSession()
const stripeKey = useBillingWebStripeKey()
const {
  page,
  preview,
  canPay,
  submitting,
  payFailure,
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
  continueVerification,
  reconcile
} = useFullPageCheckout()

// A page restored from the back-forward cache is whatever it was when the
// customer left, which may be a form over money that has since moved (rule 16).
useEventListener(window, 'pageshow', (event: PageTransitionEvent) => {
  if (event.persisted) void reconcile()
})

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

const payFailureCopy = computed(() =>
  payFailure.value === undefined
    ? undefined
    : coded('failure', payFailure.value)
)

const ending = computed(() => endingOf(page.value))

const locked = computed(() => isLocked(page.value))

/** The server cannot cancel a pending payment yet; the click has nowhere honest to go. */
function cancelPayment() {}

const recoveredPlan = computed(() => {
  const current = page.value
  if (current.kind !== 'waiting') return undefined
  const plan = current.operation.plan
  return { label: plan && operationPlanLabel(plan, ledgerContext.value) }
})

/**
 * The plan a settled payment bought, as the server reports it for the
 * operation. Only this page's own Pay, settled without a report that names or
 * prices the plan, names the plan its quote priced.
 */
const endingPlan = computed<EndingPlan | undefined>(() => {
  const current = page.value
  if (current.kind !== 'terminal') return undefined
  const reported = operationPlanOf(current.operation)
  const label = reported && operationPlanLabel(reported, ledgerContext.value)
  if (label) return label
  if (current.attribution !== 'started') return undefined
  const quoted = preview.value
  return quoted && quotedPlanLabel(quoted)
})

function quotedPlanLabel(quoted: SubscriptionPreview): EndingPlan {
  const plan = quoted.new_plan
  const currency = quoted.currency ?? 'usd'
  return {
    name: coded('tier', plan.tier),
    price: formatQuoteMoney(plan.price_cents, currency, locale.value),
    period: t(
      isAnnualDuration(plan.duration)
        ? 'checkout.fullPage.ending.perYear'
        : 'checkout.fullPage.ending.perMonth',
      { currency: currency.toUpperCase() }
    )
  }
}

function returnToProduct() {
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
        :operation-plan="recoveredPlan"
        :locked
        :repricing="promo.busy.value"
        @back="returnToProduct"
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
        :submitting
        :can-cancel="PENDING_PAYMENT_CANCEL_AVAILABLE"
        :failure="payFailureCopy"
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
