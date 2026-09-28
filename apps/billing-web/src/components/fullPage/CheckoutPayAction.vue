<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { CheckoutTermsNote } from '@comfyorg/account-ui/billing/checkout'

import type { InlineOutcome } from '@/checkout/checkoutPage'
import { supportLinkFor } from '@/checkout/payVerdict'
import InlineOutcomeCard from '@/components/fullPage/InlineOutcomeCard.vue'
import type { KeepSubscriptionConsent } from '@/components/fullPage/KeepSubscriptionNotice.vue'
import KeepSubscriptionNotice from '@/components/fullPage/KeepSubscriptionNotice.vue'

/** What the last Pay left, and the consent a plan set to end needs, around the button. */
export interface PayContext {
  readonly failure?: string
  readonly outcome?: Exclude<InlineOutcome, { kind: 'reconciling' }>
  readonly consent?: KeepSubscriptionConsent
}

const {
  disabled,
  loading = false,
  failure,
  outcome,
  consent
} = defineProps<
  PayContext & {
    disabled: boolean
    loading?: boolean
  }
>()

const emit = defineEmits<{
  confirmReactivation: [confirmed: boolean]
  consentMissing: []
}>()

const { t } = useI18n()

/** Support is for a payment that failed; a notice over a fresh price is not one. */
const supportLink = computed(() =>
  outcome !== undefined && 'operationId' in outcome
    ? supportLinkFor(outcome)
    : undefined
)

/** Pay without the tick submits nothing and hands the click back to the consent. */
function guardConsent(event: Event) {
  if (consent === undefined || consent.state === 'confirmed') return
  event.preventDefault()
  emit('consentMissing')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <InlineOutcomeCard
      v-if="outcome"
      :key="`${outcome.kind}:${'operationId' in outcome ? outcome.operationId : ''}`"
      :outcome
    />
    <p
      v-if="failure"
      role="alert"
      class="m-0 text-sm text-destructive-background"
    >
      {{ failure }}
    </p>
    <KeepSubscriptionNotice
      v-if="consent"
      :consent
      @confirm="emit('confirmReactivation', $event)"
    />
    <button
      type="submit"
      :disabled="disabled || loading"
      :aria-busy="loading"
      class="h-10 w-full cursor-pointer rounded-lg bg-base-foreground px-4 text-sm font-semibold text-base-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      @click="guardConsent"
    >
      {{ t('checkout.payAndSubscribe') }}
    </button>
    <a
      v-if="supportLink"
      :href="supportLink"
      class="flex h-10 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold text-base-foreground hover:bg-secondary-background-hover focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none"
    >
      {{ t('checkout.fullPage.outcome.contactSupport') }}
    </a>
    <CheckoutTermsNote
      :copy="{
        agreement: t('checkout.fullPage.terms.agreement', {
          terms: '{terms}',
          privacy: '{privacy}'
        }),
        terms: t('checkout.fullPage.terms.terms'),
        privacyPolicy: t('checkout.fullPage.terms.privacyPolicy')
      }"
    />
  </div>
</template>
