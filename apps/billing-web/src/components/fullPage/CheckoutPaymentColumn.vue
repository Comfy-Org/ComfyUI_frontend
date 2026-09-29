<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SavedPaymentMethod } from '@comfyorg/account-core/billing'
import type {
  StripePaymentCopy,
  StripePaymentPhase
} from '@comfyorg/account-ui/billing/stripe'
import { StripePaymentForm } from '@comfyorg/account-ui/billing/stripe'

import type { CheckoutPage, PaymentTab } from '@/checkout/checkoutPage'
import type { KeepSubscriptionCopy } from '@/checkout/keepSubscription'
import { isLocked, railView, submitPhaseOf } from '@/checkout/checkoutPage'
import type { PayContext } from '@/components/fullPage/CheckoutPayAction.vue'
import CheckoutPayAction from '@/components/fullPage/CheckoutPayAction.vue'
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
  submitting,
  canCancel = false,
  failure,
  keepSubscription,
  savedMethods = []
} = defineProps<{
  page: Extract<CheckoutPage, { kind: 'resolving' | 'capture' | 'waiting' }>
  charge?: CheckoutCharge
  publishableKey: string
  canPay: boolean
  submitting: boolean
  canCancel?: boolean
  failure?: string
  /** The notice a plan set to end shows above Pay, worded for this quote. */
  keepSubscription?: KeepSubscriptionCopy
  savedMethods?: readonly SavedPaymentMethod[]
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

const phase = computed(() => submitPhaseOf(page))
const locked = computed(() => isLocked(page))

const methodTypeOf = (id: string) =>
  savedMethods.find((method) => method.id === id)?.type ?? ''

/** A Pay that collided with another operation keeps the form, with Pay locked, until it is re-read. */
const view = computed(() =>
  page.kind === 'capture' ? railView(page.rail) : undefined
)

const payContext = computed<PayContext>(() => {
  if (page.kind !== 'capture') return {}
  const { outcome, reactivation } = page
  return {
    failure,
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
  paymentMethod: tabbed.value ? '' : t('checkout.paymentMethod'),
  methodChoice: t('checkout.methodChoice'),
  billingAddress: t('checkout.billingAddress'),
  alipayRenewalNote: t('checkout.alipayRenewalNote'),
  unavailable: t('checkout.unavailable'),
  genericError: t('checkout.genericError')
}))
</script>

<template>
  <section class="flex lg:w-1/2">
    <div class="flex w-full flex-col px-6 py-12 lg:max-w-lg lg:px-16">
      <div
        v-if="!view"
        class="flex flex-col gap-6"
        :aria-busy="locked"
        :data-testid="locked ? 'checkout-waiting' : undefined"
      >
        <h3 class="m-0 text-base font-semibold text-base-foreground">
          {{ t('checkout.paymentMethod') }}
        </h3>
        <div class="h-84 rounded-lg bg-secondary-background-hover" />
        <h4 class="m-0 text-sm font-medium text-base-foreground">
          {{ t('checkout.billingAddress') }}
        </h4>
        <div class="h-84 rounded-lg bg-secondary-background-hover" />
        <CheckoutPayAction
          disabled
          :loading="locked"
          :phase
          :can-cancel="canCancel"
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
        <CheckoutPayAction
          v-bind="payContext"
          :disabled="!canPay"
          :loading="submitting"
          :phase
          :can-cancel="canCancel"
          @confirm-reactivation="emit('confirmReactivation', $event)"
          @consent-missing="emit('consentMissing')"
          @cancel="emit('cancel')"
          @continue-verification="emit('continueVerification')"
        />
      </form>
      <div v-else class="flex flex-col gap-6">
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
              v-bind="payContext"
              :disabled="!canPay"
              :loading="submitting"
              :phase
              :can-cancel="canCancel"
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
          :is-loading="submitting"
          :can-submit="canPay"
          :locked
          @phase="emit('phase', $event)"
          @confirm="
            (token, methodType) =>
              emit('pay', { confirmationToken: token, methodType })
          "
        >
          <template #submit="{ disabled, loading }">
            <CheckoutPayAction
              v-bind="payContext"
              :disabled
              :loading
              :phase="formShown ? phase : undefined"
              :can-cancel="canCancel"
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
