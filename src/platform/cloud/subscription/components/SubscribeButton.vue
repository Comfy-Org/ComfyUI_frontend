<template>
  <Button
    :size
    :loading="isLoading"
    :disabled="isPolling"
    variant="primary"
    :style="
      variant === 'gradient'
        ? {
            background: 'var(--color-subscription-button-gradient)',
            color: 'var(--color-white)'
          }
        : undefined
    "
    :class="cn('font-bold', fluid && 'w-full')"
    @click="handleSubscribe"
  >
    {{ label || $t('subscription.required.subscribe') }}
  </Button>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { cn } from '@/utils/tailwindUtil'

const {
  size = 'lg',
  fluid = true,
  variant = 'default',
  label
} = defineProps<{
  label?: string
  size?: 'sm' | 'lg'
  variant?: 'default' | 'gradient'
  fluid?: boolean
}>()

const emit = defineEmits<{
  subscribed: []
}>()

const { subscribe, isActiveSubscription, fetchStatus, showSubscriptionDialog } =
  useSubscription()

const telemetry = useTelemetry()

const isLoading = ref(false)
const isPolling = ref(false)
let pollInterval: number | null = null
const isAwaitingStripeSubscription = ref(false)

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

watch(
  [isAwaitingStripeSubscription, isActiveSubscription],
  ([awaiting, isActive]) => {
    if (isCloud && awaiting && isActive) {
      emit('subscribed')
      isAwaitingStripeSubscription.value = false
    }
  }
)

const handleSubscribe = async () => {
  if (isCloud) {
    useTelemetry()?.trackSubscription('subscribe_clicked')
    isAwaitingStripeSubscription.value = true
    showSubscriptionDialog()
    return
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
  isAwaitingStripeSubscription.value = false
})
</script>
