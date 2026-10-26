<template>
  <div v-if="banner" class="@container">
    <div
      role="status"
      class="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background p-4 @2xl:flex-row @2xl:items-center @2xl:gap-2"
      data-testid="billing-topup-checkout-banner"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-center gap-2">
          <i
            class="icon-[lucide--circle-alert] size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span class="text-sm text-foreground">{{ copy.title }}</span>
        </div>
        <p class="m-0 pl-6 text-sm text-muted-foreground">{{ copy.body }}</p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2 pl-6 @2xl:pl-0">
        <Button variant="textonly" size="lg" @click="emit('dismiss')">
          {{ $t(`${prefix}.dismiss`) }}
        </Button>
        <Button
          v-if="banner.kind === 'failed' && canTopUp"
          :variant="addCreditsVariant"
          size="lg"
          @click="emit('addCredits')"
        >
          {{ $t('workspacePanel.billingTab.credits.addCredits') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatUsdFromCents } from '@/base/credits/comfyCredits'
import Button from '@/components/ui/button/Button.vue'
import type { TopupCheckoutBanner } from '@/platform/billing/components/billingTab/topupCheckoutBanner'

const { banner, canTopUp, addCreditsVariant } = defineProps<{
  banner: TopupCheckoutBanner | null
  canTopUp: boolean
  addCreditsVariant: 'secondary' | 'inverted'
}>()
const emit = defineEmits<{
  addCredits: []
  dismiss: []
}>()

const prefix = 'workspacePanel.billingTab.topupCheckout'

const { t, locale } = useI18n()

function usd(cents: number) {
  return formatUsdFromCents({
    cents,
    locale: locale.value,
    numberOptions: {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2
    }
  })
}

function failedTitle(paymentAmountCents: number | null) {
  return paymentAmountCents === null
    ? t(`${prefix}.failed.titleNoAmount`)
    : t(`${prefix}.failed.title`, { amount: usd(paymentAmountCents) })
}

function bannerCopy(shown: TopupCheckoutBanner) {
  switch (shown.kind) {
    case 'failed':
      return {
        title: failedTitle(shown.paymentAmountCents),
        body: t(`${prefix}.failed.body`)
      }
    case 'creditsApplying':
      return {
        title: t(`${prefix}.creditsApplying.title`),
        body: t(`${prefix}.creditsApplying.body`)
      }
    case 'processing':
      return {
        title: t(`${prefix}.processing.title`),
        body: t(`${prefix}.processing.body`)
      }
  }
}

const copy = computed(() =>
  banner ? bannerCopy(banner) : { title: '', body: '' }
)
</script>
