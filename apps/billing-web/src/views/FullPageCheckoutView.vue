<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatQuoteMoney } from '@comfyorg/account-ui/billing/checkout'

import type { CheckoutCharge } from '@/components/fullPage/CheckoutPaymentColumn.vue'
import CheckoutPaymentColumn from '@/components/fullPage/CheckoutPaymentColumn.vue'
import type { CheckoutSummary } from '@/components/fullPage/CheckoutSummaryColumn.vue'
import CheckoutSummaryColumn from '@/components/fullPage/CheckoutSummaryColumn.vue'
import { useFullPageCheckout } from '@/composables/useFullPageCheckout'
import { useHostedCopy } from '@/composables/useHostedCopy'
import { useBillingWebStripeKey } from '@/config/stripeKey'
import { useBillingEntry } from '@/entry/billingEntry'
import { useBillingWebSession } from '@/session/billingWebSession'

const { t, locale } = useI18n()
const { coded } = useHostedCopy()
const { entry } = useBillingEntry()
const { session } = useBillingWebSession()
const stripeKey = useBillingWebStripeKey()
const {
  page,
  preview,
  canPay,
  submitting,
  payFailure,
  returnLink,
  onPaymentPhase,
  savedMethods,
  retryElement,
  retrySaved,
  retryColumn,
  selectTab,
  confirmReactivation,
  pay
} = useFullPageCheckout()

const quote = computed(() =>
  page.value.kind === 'capture' ? preview.value : undefined
)

const summary = computed<CheckoutSummary | undefined>(() => {
  const quoted = quote.value
  if (!quoted) return undefined
  const currency = quoted.currency ?? 'usd'
  const money = (cents: number) =>
    formatQuoteMoney(cents, currency, locale.value)
  const plan = t('checkout.fullPage.planName', {
    tier: coded('tier', quoted.new_plan.tier)
  })
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

const payFailureCopy = computed(() =>
  payFailure.value === undefined
    ? undefined
    : coded('failure', payFailure.value)
)

const productName = computed(() => coded('product', entry.value?.product))

function returnToProduct() {
  window.location.assign(returnLink.value)
}
</script>

<template>
  <main
    v-if="page.kind === 'refused' || page.kind === 'unavailable'"
    class="dark-theme fixed inset-0 flex items-center justify-center overflow-auto bg-base-background p-6 font-inter"
  >
    <section class="flex w-full max-w-96 flex-col gap-4">
      <h1 class="m-0 text-2xl font-semibold text-base-foreground">
        {{
          page.kind === 'refused'
            ? t('checkout.fullPage.refused.title')
            : t('hosted.title.checkout')
        }}
      </h1>
      <p class="m-0 text-sm/5 text-muted-foreground">
        {{
          page.kind === 'refused'
            ? t('checkout.fullPage.refused.body')
            : coded('failure', page.code)
        }}
      </p>
      <button
        type="button"
        class="mt-2 h-10 w-full cursor-pointer rounded-lg bg-secondary-background px-4 text-sm font-semibold text-base-foreground hover:bg-secondary-background-hover focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none"
        @click="returnToProduct"
      >
        {{ t('hosted.returnTo', { product: productName }) }}
      </button>
    </section>
  </main>
  <main
    v-else
    class="dark-theme fixed inset-0 overflow-auto bg-secondary-background font-inter"
  >
    <h1 class="sr-only">{{ t('hosted.title.checkout') }}</h1>
    <div class="flex min-h-full flex-col lg:flex-row">
      <CheckoutSummaryColumn :summary @back="returnToProduct" />
      <CheckoutPaymentColumn
        :page
        :charge
        :publishable-key="stripeKey ?? ''"
        :can-pay="canPay"
        :submitting
        :failure="payFailureCopy"
        :saved-methods="savedMethods"
        @phase="onPaymentPhase"
        @pay="pay"
        @retry-element="retryElement"
        @retry-saved="retrySaved"
        @retry-column="retryColumn"
        @select-tab="selectTab"
        @confirm-reactivation="confirmReactivation"
      />
    </div>
  </main>
</template>
