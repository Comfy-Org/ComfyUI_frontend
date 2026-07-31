<template>
  <component
    :is="currentButton"
    :key="canRunWorkflows ? 'queue' : 'subscribe'"
  />
</template>
<script setup lang="ts">
import { computed } from 'vue'

import ComfyQueueButton from '@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import SubscribeToRunButton from '@/platform/cloud/subscription/components/SubscribeToRun.vue'

const { canRunWorkflows } = useBillingContext()

const currentButton = computed(() =>
  canRunWorkflows.value ? ComfyQueueButton : SubscribeToRunButton
)
</script>
