<template>
  <Button
    :label="label || $t('subscription.required.subscribe')"
    :size="size"
    :loading="isLoading"
    :disabled="isPolling"
    severity="primary"
    :pt="{
      root: {
        class: 'w-full font-bold'
      }
    }"
    @click="handleSubscribe"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { onBeforeUnmount, ref } from 'vue'

import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'

withDefaults(
  defineProps<{
    label?: string
    size?: 'small' | 'large'
  }>(),
  {
    size: 'large'
  }
)

const emit = defineEmits<{
  subscribed: []
}>()

const { subscribe, isActiveSubscription, fetchStatus } = useSubscription()
const telemetry = useTelemetry()

const isLoading = ref(false)
const isPolling = ref(false)
let pollInterval: number | null = null

const POLL_INTERVAL_MS = 3000 // Poll every 3 seconds
const MAX_POLL_DURATION_MS = 5 * 60 * 1000 // Stop polling after 5 minutes

const startPollingSubscriptionStatus = () => {
  isPolling.value = true
  isLoading.value = true

  const startTime = Date.now()

  const poll = async () => {
    try {
      if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
        stopPolling()
        return
      }

      await fetchStatus()

      if (isActiveSubscription.value) {
        stopPolling()
        telemetry?.trackMonthlySubscriptionSucceeded()
        emit('subscribed')
      }
    } catch (error) {
      console.error(
        '[SubscribeButton] Error polling subscription status:',
        error
      )
    }
  }

  void poll()
  pollInterval = window.setInterval(poll, POLL_INTERVAL_MS)
}

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  isPolling.value = false
  isLoading.value = false
}

const handleSubscribe = async () => {
  if (isCloud) {
    useTelemetry()?.trackSubscription('subscribe_clicked')
  }

  isLoading.value = true
  try {
    await subscribe()

    startPollingSubscriptionStatus()
  } catch (error) {
    console.error('[SubscribeButton] Error initiating subscription:', error)
    isLoading.value = false
  }
}

onBeforeUnmount(() => {
  stopPolling()
})
</script>
