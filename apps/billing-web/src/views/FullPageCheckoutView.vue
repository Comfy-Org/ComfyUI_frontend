<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  formatQuoteMoney,
  isAnnualDuration
} from '@comfyorg/account-ui/billing/checkout'

import { endingOf } from '@/checkout/endingScreen'
import type { EndingPlan } from '@/components/fullPage/CheckoutEnding.vue'
import CheckoutEnding from '@/components/fullPage/CheckoutEnding.vue'
import type { CheckoutCharge } from '@/components/fullPage/CheckoutPaymentColumn.vue'
import CheckoutPaymentColumn from '@/components/fullPage/CheckoutPaymentColumn.vue'
import type { CheckoutSummary } from '@/components/fullPage/CheckoutSummaryColumn.vue'
import CheckoutSummaryColumn from '@/components/fullPage/CheckoutSummaryColumn.vue'
import { keepSubscriptionCopy } from '@/checkout/keepSubscription'
import CheckoutWaitingColumn from '@/components/fullPage/CheckoutWaitingColumn.vue'
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
  pay,
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

const planName = computed(() =>
  preview.value === undefined
    ? undefined
    : t('checkout.fullPage.planName', {
        tier: coded('tier', preview.value.new_plan.tier)
      })
)

const summary = computed<CheckoutSummary | undefined>(() => {
  const quoted = quote.value
  if (!quoted) return undefined
  const currency = quoted.currency ?? 'usd'
  const money = (cents: number) =>
    formatQuoteMoney(cents, currency, locale.value)
  const plan = planName.value ?? ''
  const workspace = session.value?.workspace.name
  return {
    eyebrow:
      workspace === undefined
        ? t('checkout.fullPage.eyebrowPlanOnly', { plan })
        : t('checkout.fullPage.eyebrow', { plan, workspace }),
    price: money(quoted.new_plan.price_cents),
    currency: currency.toUpperCase(),
    total: money(quoted.amount_due_cents ?? quoted.cost_today_cents)
  }
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

/** The plan this page's own Pay bought, as its quote priced it. */
const endingPlan = computed<EndingPlan | undefined>(() => {
  const quoted = preview.value
  if (!quoted) return undefined
  return {
    name: coded('tier', quoted.new_plan.tier),
    price: formatQuoteMoney(
      quoted.new_plan.price_cents,
      quoted.currency ?? 'usd',
      locale.value
    ),
    period: t(
      isAnnualDuration(quoted.new_plan.duration)
        ? 'checkout.fullPage.ending.perYear'
        : 'checkout.fullPage.ending.perMonth',
      { currency: (quoted.currency ?? 'usd').toUpperCase() }
    )
  }
})

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
      <CheckoutSummaryColumn :summary @back="returnToProduct" />
      <CheckoutWaitingColumn v-if="page.kind === 'waiting'" />
      <CheckoutPaymentColumn
        v-else-if="page.kind === 'resolving' || page.kind === 'capture'"
        :page
        :charge
        :publishable-key="stripeKey ?? ''"
        :can-pay="canPay"
        :submitting
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
      />
    </div>
  </main>
</template>
