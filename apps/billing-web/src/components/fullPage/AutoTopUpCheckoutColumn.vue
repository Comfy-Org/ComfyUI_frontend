<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CheckoutPage } from '@/checkout/checkoutPage'
import { isLocked, submitPhaseOf } from '@/checkout/checkoutPage'
import type { AutoTopUpConsent } from '@/checkout/topupRequest'
import AutoTopUpConsentCard from '@/components/fullPage/AutoTopUpConsentCard.vue'
import CheckoutPayAction from '@/components/fullPage/CheckoutPayAction.vue'

const { page, consent, canPay } = defineProps<{
  page: Extract<CheckoutPage, { kind: 'capture' }>
  consent: AutoTopUpConsent
  canPay: boolean
}>()

const emit = defineEmits<{
  pay: []
}>()

const { t } = useI18n()

const locked = computed(() => isLocked(page))
const phase = computed(() => submitPhaseOf(page))
const outcome = computed(() =>
  page.outcome === undefined || page.outcome.kind === 'reconciling'
    ? undefined
    : page.outcome
)
</script>

<template>
  <section class="flex justify-center lg:w-1/2 lg:justify-start">
    <form
      class="flex w-full max-w-lg flex-col gap-6 px-6 py-12 lg:px-16"
      @submit.prevent="emit('pay')"
    >
      <AutoTopUpConsentCard :consent />
      <p class="m-0 text-sm text-muted-foreground">
        {{ t('checkout.fullPage.autoTopUp.hostedNote') }}
      </p>
      <CheckoutPayAction
        purchase="credits"
        :outcome
        :disabled="!canPay"
        :loading="locked"
        :locked
        :phase
      />
    </form>
  </section>
</template>
