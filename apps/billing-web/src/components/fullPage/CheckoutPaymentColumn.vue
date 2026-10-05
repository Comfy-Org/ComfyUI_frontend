<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SavedPaymentMethod } from '@comfyorg/account-core/billing'
import type {
  StripePaymentCopy,
  StripePaymentPhase
} from '@comfyorg/account-ui/billing/stripe'
import { StripePaymentForm } from '@comfyorg/account-ui/billing/stripe'

import type {
  CheckoutPage,
  PaymentTab,
  RailView
} from '@/checkout/checkoutPage'
import type { KeepSubscriptionCopy } from '@/checkout/keepSubscription'
import type { PlanPurchase } from '@/checkout/summaryLedger'
import { isLocked, railView, submitPhaseOf } from '@/checkout/checkoutPage'
import type { PayContext } from '@/components/fullPage/CheckoutPayAction.vue'
import CheckoutPayAction from '@/components/fullPage/CheckoutPayAction.vue'
import MethodOnFile from '@/components/fullPage/MethodOnFile.vue'
import PaymentFormError from '@/components/fullPage/PaymentFormError.vue'
import PaymentTabsRail from '@/components/fullPage/PaymentTabsRail.vue'
import type { PayChoice } from '@/composables/useFullPageCheckout'

export interface CheckoutCharge {
  readonly amountCents: number
  readonly currency: string
  readonly paymentMethodConfigurationId: string
}

const {
  page,
  charge,
  publishableKey,
  canPay,
  reopening,
  keepSubscription,
  savedMethods = [],
  purchase = 'subscribe'
} = defineProps<{
  page: Extract<CheckoutPage, { kind: 'resolving' | 'capture' | 'waiting' }>
  charge?: CheckoutCharge
  publishableKey: string
  canPay: boolean
  /** The page is re-opening the challenge on its own, so Complete verification waits. */
  reopening: boolean
  /** The notice a plan set to end shows above Pay, worded for this quote. */
  keepSubscription?: KeepSubscriptionCopy
  savedMethods?: readonly SavedPaymentMethod[]
  purchase?: PlanPurchase | 'credits'
}>()

const emit = defineEmits<{
  phase: [phase: StripePaymentPhase]
  pay: [choice: PayChoice]
  retryElement: []
  retrySaved: []
  retryColumn: []
  selectTab: [tab: PaymentTab]
  confirmReactivation: [confirmed: boolean]
  consentMissing: []
  cancel: []
  continueVerification: []
}>()

const { t } = useI18n()

const SECTION_LABEL = 'm-0 text-base font-normal text-base-foreground'

const phase = computed(() => submitPhaseOf(page))
const locked = computed(() => isLocked(page))

const methodTypeOf = (id: string) =>
  savedMethods.find((method) => method.id === id)?.type ?? ''

const failureHidesPay = (current: RailView) =>
  current.kind === 'column_error' ||
  (current.kind === 'tabs' &&
    current.tab === 'new' &&
    current.element === 'failed')

/**
 * A Pay that collided with another operation keeps the form, with Pay
 * locked, until it is re-read. Money in flight shows the rail its quote
 * asks for, locked, once the quote is in, unless a rail failure would
 * take the payment's status and verification action with it.
 */
const view = computed(() => {
  if (page.kind === 'capture') return railView(page.rail)
  if (page.kind !== 'waiting' || !page.rail) return undefined
  const current = railView(page.rail)
  return failureHidesPay(current) ? undefined : current
})

const payContext = computed<PayContext>(() => {
  if (page.kind !== 'capture') return {}
  const { outcome, reactivation } = page
  return {
    ...(outcome === undefined || outcome.kind === 'reconciling'
      ? {}
      : { outcome }),
    ...(reactivation === 'not_required' || keepSubscription === undefined
      ? {}
      : { consent: { state: reactivation, copy: keepSubscription } })
  }
})

const tabbed = computed(() =>
  view.value?.kind === 'tabs' ? view.value : undefined
)

/** The card form stays mounted behind the Saved tab; only the shown pay action carries the phase. */
const formShown = computed(() => !tabbed.value || tabbed.value.tab === 'new')

const elementLive = computed(() => {
  const current = view.value
  return (
    (current?.kind === 'tabs' || current?.kind === 'element_only') &&
    current.element !== 'failed'
  )
})

const copy = computed<StripePaymentCopy>(() => ({
  paymentMethod: t('checkout.paymentMethod'),
  methodChoice: t('checkout.methodChoice'),
  billingAddress: t('checkout.billingAddress'),
  alipayRenewalNote: t('checkout.alipayRenewalNote'),
  unavailable: t('checkout.unavailable'),
  genericError: t('checkout.genericError')
}))
</script>

<template>
  <section
    class="flex lg:w-1/2"
    :data-testid="page.kind === 'waiting' ? 'checkout-waiting' : undefined"
  >
    <div class="flex w-full flex-col px-6 py-12 lg:max-w-lg lg:px-16">
      <div v-if="!view" class="flex flex-col gap-6">
        <div class="flex flex-col gap-3">
          <h3 :class="SECTION_LABEL">{{ t('checkout.paymentMethod') }}</h3>
          <div
            class="h-84 rounded-lg bg-secondary-background-hover"
            aria-busy="true"
            data-testid="checkout-skeleton"
          />
        </div>
        <div class="flex flex-col gap-3">
          <h4 :class="SECTION_LABEL">{{ t('checkout.billingAddress') }}</h4>
          <div
            class="h-84 rounded-lg bg-secondary-background-hover"
            aria-busy="true"
            data-testid="checkout-skeleton"
          />
        </div>
        <CheckoutPayAction
          :purchase
          disabled
          :loading="locked"
          :locked
          :reopening
          :phase
          @cancel="emit('cancel')"
          @continue-verification="emit('continueVerification')"
        />
      </div>
      <PaymentFormError
        v-else-if="view.kind === 'column_error'"
        @retry="emit('retryColumn')"
      />
      <form
        v-else-if="view.kind === 'on_file'"
        class="flex flex-col gap-6"
        @submit.prevent="emit('pay', undefined)"
      >
        <MethodOnFile :methods="savedMethods" />
        <CheckoutPayAction
          :purchase
          v-bind="payContext"
          :disabled="!canPay"
          :loading="locked"
          :locked
          :reopening
          :phase
          @confirm-reactivation="emit('confirmReactivation', $event)"
          @consent-missing="emit('consentMissing')"
          @cancel="emit('cancel')"
          @continue-verification="emit('continueVerification')"
        />
      </form>
      <div v-else class="flex flex-col gap-3">
        <h3 :class="SECTION_LABEL">{{ t('checkout.paymentMethod') }}</h3>
        <PaymentTabsRail
          v-if="tabbed"
          :rail="tabbed"
          :methods="savedMethods"
          :locked
          @select-tab="emit('selectTab', $event)"
          @pay-saved="
            emit('pay', {
              savedMethodId: $event,
              methodType: methodTypeOf($event)
            })
          "
          @retry-saved="emit('retrySaved')"
          @retry-element="emit('retryElement')"
        >
          <template #pay>
            <CheckoutPayAction
              :purchase
              v-bind="payContext"
              :disabled="!canPay"
              :loading="locked"
              :locked
              :reopening
              :phase
              @confirm-reactivation="emit('confirmReactivation', $event)"
              @consent-missing="emit('consentMissing')"
              @cancel="emit('cancel')"
              @continue-verification="emit('continueVerification')"
            />
          </template>
        </PaymentTabsRail>
        <StripePaymentForm
          v-if="elementLive && charge"
          v-show="formShown"
          :publishable-key
          :amount-cents="charge.amountCents"
          :currency="charge.currency"
          :copy
          :payment-method-configuration-id="charge.paymentMethodConfigurationId"
          :is-loading="locked"
          :can-submit="canPay"
          :locked
          page-layout
          @phase="emit('phase', $event)"
          @confirm="
            (token, methodType) =>
              emit('pay', { confirmationToken: token, methodType })
          "
        >
          <template #submit="{ disabled, loading }">
            <CheckoutPayAction
              :purchase
              v-bind="payContext"
              :disabled
              :loading
              :locked
              :reopening
              :phase="formShown ? phase : undefined"
              @confirm-reactivation="emit('confirmReactivation', $event)"
              @consent-missing="emit('consentMissing')"
              @cancel="emit('cancel')"
              @continue-verification="emit('continueVerification')"
            />
          </template>
        </StripePaymentForm>
      </div>
    </div>
  </section>
</template>
