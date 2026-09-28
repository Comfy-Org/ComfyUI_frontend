<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { CheckoutTermsNote } from '@comfyorg/account-ui/billing/checkout'

import type { InlineOutcome } from '@/checkout/checkoutPage'
import { supportLinkFor } from '@/checkout/payVerdict'
import InlineOutcomeCard from '@/components/fullPage/InlineOutcomeCard.vue'

/** What the last Pay left, and the reactivation charge to agree to, around the button. */
export interface PayContext {
  readonly failure?: string
  readonly outcome?: Exclude<InlineOutcome, { kind: 'reconciling' }>
  readonly reactivation?: 'required' | 'confirmed'
  readonly amount?: string
}

const {
  disabled,
  loading = false,
  failure,
  outcome,
  reactivation,
  amount = ''
} = defineProps<
  PayContext & {
    disabled: boolean
    loading?: boolean
  }
>()

const emit = defineEmits<{ confirmReactivation: [confirmed: boolean] }>()

const { t } = useI18n()

const confirmed = computed({
  get: () => reactivation === 'confirmed',
  set: (value: boolean) => emit('confirmReactivation', value)
})

const supportLink = computed(() =>
  outcome === undefined || outcome.kind === 'price_updated'
    ? undefined
    : supportLinkFor(outcome)
)
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
    <label
      v-if="reactivation"
      class="flex items-start gap-3 text-sm text-base-foreground"
    >
      <input v-model="confirmed" type="checkbox" class="mt-0.5 size-4" />
      <span>{{ t('checkout.reactivationConfirm', { amount }) }}</span>
    </label>
    <button
      type="submit"
      :disabled="disabled || loading"
      :aria-busy="loading"
      class="h-10 w-full cursor-pointer rounded-lg bg-base-foreground px-4 text-sm font-semibold text-base-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
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
