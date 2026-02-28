<template>
  <Button
    v-if="isFreeTier"
    class="mr-2 shrink-0 whitespace-nowrap"
    variant="primary"
    size="sm"
    :style="{
      background: 'var(--color-subscription-button-gradient)',
      color: 'var(--color-white)',
      borderColor: 'transparent'
    }"
    data-testid="topbar-subscribe-button"
    @click="handleClick"
  >
    {{ $t('subscription.subscribeForMore') }}
  </Button>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'

const { isFreeTier, showSubscriptionDialog } = useBillingContext()

function handleClick() {
  if (isCloud) {
    useTelemetry()?.trackSubscription('subscribe_clicked', {
      current_tier: 'free'
    })
  }
  showSubscriptionDialog()
}
</script>
