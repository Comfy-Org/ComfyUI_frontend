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

const consentLine = computed(() => {
  const { monthlyLimitCents, defaultCard } = consent
  const max =
    monthlyLimitCents === undefined
      ? undefined
      : formatQuoteMoney(monthlyLimitCents, 'usd', locale.value)
  const card =
    defaultCard && t('checkout.fullPage.autoTopUp.card', { ...defaultCard })
  if (card === undefined)
    return max === undefined
      ? t('checkout.fullPage.autoTopUp.consentNoCardNoLimit')
      : t('checkout.fullPage.autoTopUp.consentNoCard', { max })
  return max === undefined
    ? t('checkout.fullPage.autoTopUp.consentDefaultCardNoLimit', { card })
    : t('checkout.fullPage.autoTopUp.consentDefaultCard', { card, max })
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
