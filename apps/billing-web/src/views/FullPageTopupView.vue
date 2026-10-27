<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { isLocked } from '@/checkout/checkoutPage'
import { endingOf } from '@/checkout/endingScreen'
import { buildTopupLedger } from '@/checkout/topupLedger'
import CheckoutEnding from '@/components/fullPage/CheckoutEnding.vue'
import type { CheckoutCharge } from '@/components/fullPage/CheckoutPaymentColumn.vue'
import CheckoutPaymentColumn from '@/components/fullPage/CheckoutPaymentColumn.vue'
import CheckoutSummaryColumn from '@/components/fullPage/CheckoutSummaryColumn.vue'
import { useFullPageTopup } from '@/composables/useFullPageTopup'
import { useBillingWebStripeKey } from '@/config/stripeKey'
import { useBillingWebSession } from '@/session/billingWebSession'
import { reportReturnClicked } from '@/telemetry/webReturnTelemetry'

const { t, locale } = useI18n()
const { session } = useBillingWebSession()
const stripeKey = useBillingWebStripeKey()
const {
  page,
  quote,
  paysOnce,
  savedMethods,
  canPay,
  returnLink,
  settingsLink,
  openedByScript,
  close,
  retryLoad,
  pay,
  reopening,
  continueVerification,
  onPaymentPhase,
  retryElement,
  retrySaved,
  retryColumn,
  selectTab
} = useFullPageTopup()

const charge = computed<CheckoutCharge | undefined>(() => {
  const configurationId = quote.value?.paymentMethodConfigurationId
  if (!paysOnce.value || !quote.value || configurationId === undefined)
    return undefined
  return {
    amountCents: quote.value.amountCents,
    currency: 'usd',
    paymentMethodConfigurationId: configurationId
  }
})

const ledger = computed(() => {
  const quoted = quote.value
  const shown = page.value.kind === 'capture' || page.value.kind === 'waiting'
  if (!quoted || !shown) return undefined
  return buildTopupLedger(quoted, {
    workspace: session.value?.workspace.name,
    t,
    locale: locale.value
  })
})

const ending = computed(() => endingOf(page.value))
const locked = computed(() => isLocked(page.value))

function returnToProduct() {
  window.location.assign(returnLink.value)
}

function goBack() {
  reportReturnClicked('back')
  returnToProduct()
}

function openBillingSettings() {
  window.location.assign(settingsLink.value)
}
</script>

<template>
  <CheckoutEnding
    v-if="ending"
    :screen="ending"
    :workspace="
      session?.workspace.name ?? t('checkout.fullPage.ending.thisWorkspace')
    "
    :closes-itself="openedByScript"
    @close="close"
    @retry="retryLoad"
    @view-plans="returnToProduct"
    @add-credits="openBillingSettings"
  />
  <main v-else class="fixed inset-0 overflow-auto bg-secondary font-inter">
    <h1 class="sr-only">{{ t('hosted.title.checkout') }}</h1>
    <div class="flex min-h-full flex-col lg:flex-row">
      <CheckoutSummaryColumn :ledger :locked @back="goBack" />
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
        purchase="credits"
        :saved-methods="savedMethods"
        @phase="onPaymentPhase"
        @pay="pay"
        @retry-element="retryElement"
        @retry-saved="retrySaved"
        @retry-column="retryColumn"
        @select-tab="selectTab"
        @continue-verification="continueVerification"
      />
    </div>
  </main>
</template>
