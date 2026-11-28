<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatQuoteMoney } from '@comfyorg/account-ui/billing/checkout'

import type { AutoTopUpConsent } from '@/checkout/topupRequest'

const { consent } = defineProps<{
  consent: AutoTopUpConsent
}>()

const { t, locale } = useI18n()

const credits = (count: number) => count.toLocaleString(locale.value)

const rule = computed(() =>
  t('checkout.fullPage.autoTopUp.rule', {
    threshold: credits(consent.thresholdCredits),
    target: credits(consent.targetCredits)
  })
)

const CONSENT_KEYS = {
  default: {
    limit: 'checkout.fullPage.autoTopUp.consentDefaultCard',
    noLimit: 'checkout.fullPage.autoTopUp.consentDefaultCardNoLimit'
  },
  none: {
    limit: 'checkout.fullPage.autoTopUp.consentNoCard',
    noLimit: 'checkout.fullPage.autoTopUp.consentNoCardNoLimit'
  },
  unknown: {
    limit: 'checkout.fullPage.autoTopUp.consentEitherCard',
    noLimit: 'checkout.fullPage.autoTopUp.consentEitherCardNoLimit'
  }
} as const

const consentLine = computed(() => {
  const { monthlyLimitCents, card } = consent
  const keys = CONSENT_KEYS[card.kind]
  const named =
    card.kind === 'default'
      ? { card: t('checkout.fullPage.autoTopUp.card', { ...card.card }) }
      : {}
  return monthlyLimitCents === undefined
    ? t(keys.noLimit, named)
    : t(keys.limit, {
        ...named,
        max: formatQuoteMoney(monthlyLimitCents, 'usd', locale.value)
      })
})
</script>

<template>
  <div
    class="flex flex-col gap-2 rounded-lg border border-border p-4"
    data-testid="checkout-auto-top-up"
  >
    <h3 class="m-0 text-base font-normal text-foreground">
      {{ t('checkout.fullPage.autoTopUp.title') }}
    </h3>
    <p class="m-0 text-sm text-muted-foreground">{{ rule }}</p>
    <p
      class="m-0 text-sm text-muted-foreground"
      data-testid="checkout-auto-top-up-consent"
    >
      {{ consentLine }}
    </p>
  </div>
</template>
