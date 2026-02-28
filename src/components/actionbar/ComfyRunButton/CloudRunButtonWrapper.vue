<template>
  <div class="relative">
    <ComfyQueueButton />
    <SubscribeToRunButton
      v-if="!isActiveSubscription"
      class="absolute inset-0 z-10"
    />
  </div>
</template>
<script setup lang="ts">
import ComfyQueueButton from '@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import SubscribeToRunButton from '@/platform/cloud/subscription/components/SubscribeToRun.vue'

const { isActiveSubscription } = useBillingContext()
</script>
