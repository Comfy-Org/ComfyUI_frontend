<template>
  <Button
    v-tooltip.bottom="{
      value: $t('subscription.subscribeToRun'),
      showDelay: 600
    }"
    class="subscribe-to-run-button"
    :label="$t('subscription.subscribeToRun')"
    icon="pi pi-lock"
    severity="primary"
    size="small"
    data-testid="subscribe-to-run-button"
    @click="handleSubscribeToRun"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'

const { showSubscriptionDialog } = useSubscription()

const handleSubscribeToRun = () => {
  if (isCloud) {
    useTelemetry()?.trackRunButton({ subscribe_to_run: true })
  }

  showSubscriptionDialog()
}
</script>
