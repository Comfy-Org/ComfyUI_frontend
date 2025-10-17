<template>
  <div class="grid h-full grid-cols-5 px-10 pb-10">
    <div
      class="relative col-span-2 flex items-center justify-center overflow-hidden rounded-sm"
    >
      <video
        autoplay
        loop
        muted
        playsinline
        class="h-full min-w-[125%] object-cover"
        style="margin-left: -20%"
      >
        <source
          src="/assets/images/cloud-subscription.webm"
          type="video/webm"
        />
      </video>
    </div>

    <div class="col-span-3 flex flex-col justify-between pl-8">
      <div>
        <div class="flex flex-col gap-4">
          <div class="inline-flex items-center gap-2">
            <div class="text-sm text-muted">
              {{ $t('subscription.required.title') }}
            </div>
            <TopbarBadges
              reverse-order
              no-padding
              text-class="!text-sm !font-normal"
            />
          </div>

          <div class="flex items-baseline gap-2">
            <span class="text-4xl font-bold">{{ formattedMonthlyPrice }}</span>
            <span class="text-xl">{{ $t('subscription.perMonth') }}</span>
          </div>
        </div>

        <SubscriptionBenefits class="mt-6 text-muted" />
      </div>

      <div class="flex flex-col">
        <Button
          :label="$t('subscription.required.subscribe')"
          size="large"
          class="w-full font-bold"
          :loading="isLoading"
          :disabled="isPolling"
          @click="handleSubscribe"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { onBeforeUnmount, ref } from 'vue'

import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import SubscriptionBenefits from '@/platform/cloud/subscription/components/SubscriptionBenefits.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'

const emit = defineEmits<{
  close: [subscribed: boolean]
}>()

const { subscribe, isActiveSubscription, formattedMonthlyPrice, fetchStatus } =
  useSubscription()

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
        emit('close', true)
      }
    } catch (error) {
      console.error(
        '[SubscriptionRequiredDialog] Error polling subscription status:',
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
  isLoading.value = true
  try {
    await subscribe()

    startPollingSubscriptionStatus()
  } catch (error) {
    console.error(
      '[SubscriptionRequiredDialog] Error initiating subscription:',
      error
    )
    isLoading.value = false
  }
}

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped>
:deep(.bg-comfy-menu-secondary) {
  background-color: transparent;
}

:deep(.p-button) {
  color: white;
}
</style>
