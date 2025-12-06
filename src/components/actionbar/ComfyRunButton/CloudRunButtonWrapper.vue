<template>
  <component
    :is="currentButton"
    :key="isSubscriptionRequirementMet ? 'queue' : 'subscribe'"
  />
</template>
<script setup lang="ts">
import { computed } from 'vue'

import ComfyQueueButton from '@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue'
import SubscribeToRunButton from '@/platform/cloud/subscription/components/SubscribeToRun.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'

const { isSubscriptionRequirementMet } = useSubscription()

const currentButton = computed(() =>
  isSubscriptionRequirementMet.value ? ComfyQueueButton : SubscribeToRunButton
)
</script>
