<template>
  <Button
    v-tooltip.bottom="{
      value: $t('subscription.subscribeToRunFull'),
      showDelay: 600
    }"
    class="subscribe-to-run-button"
    :label="buttonLabel"
    icon="pi pi-lock"
    severity="primary"
    size="small"
    :style="{
      background: 'var(--color-subscription-button-gradient)',
      color: 'var(--color-white)'
    }"
    :pt="{
      root: {
        class: 'whitespace-nowrap',
        style: {
          borderColor: 'transparent'
        }
      }
    }"
    data-testid="subscribe-to-run-button"
    @click="handleSubscribeToRun"
  />
</template>

<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'

const { t } = useI18n()
const breakpoints = useBreakpoints(breakpointsTailwind)
const isMdOrLarger = breakpoints.greaterOrEqual('md')

const buttonLabel = computed(() =>
  isMdOrLarger.value
    ? t('subscription.subscribeToRunFull')
    : t('subscription.subscribeToRun')
)

const { showSubscriptionDialog } = useSubscription()

const handleSubscribeToRun = () => {
  if (isCloud) {
    useTelemetry()?.trackRunButton({ subscribe_to_run: true })
  }

  showSubscriptionDialog()
}
</script>
