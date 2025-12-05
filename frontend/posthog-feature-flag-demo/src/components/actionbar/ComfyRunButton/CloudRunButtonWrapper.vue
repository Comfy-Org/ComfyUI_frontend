<template>
  <!-- If user has active subscription, show ComfyQueueButton (which already has FeatureFlaggedRunButton) -->
  <ComfyQueueButton v-if="isActiveSubscription" />

  <!-- If subscription required but not active, wrap SubscribeToRunButton with feature flag -->
  <FeatureFlaggedRunButton
    v-else
    flag-key="demo-run-button-experiment"
    :on-click="handleSubscribeClick"
  >
    <template #control>
      <!-- SubscribeToRunButton handles its own click (shows subscription dialog) -->
      <SubscribeToRunButton />
    </template>
  </FeatureFlaggedRunButton>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useCommandStore } from '@/stores/commandStore'

import ComfyQueueButton from './ComfyQueueButton.vue'
import FeatureFlaggedRunButton from './FeatureFlaggedRunButton.vue'
import SubscribeToRunButton from '@/platform/cloud/subscription/components/SubscribeToRun.vue'

// Get subscription status - replace with actual subscription store/composable
const isActiveSubscription = computed(() => {
  // TODO: Replace with actual subscription check
  // Example: return useSubscriptionStore().isActiveSubscription
  // For now, this would typically come from a store or composable
  return false
})

const commandStore = useCommandStore()

// Handle click for experimental button when SubscribeToRunButton is shown
// For experimental variants, trigger queue prompt (same as ComfyQueueButton)
// For control, SubscribeToRunButton handles its own click (shows subscription dialog)
const handleSubscribeClick = async (e: Event) => {
  // If this is called from the experimental button, trigger queue prompt
  // If called from SubscribeToRunButton (control), it will handle its own logic
  const isShiftPressed = 'shiftKey' in e && e.shiftKey
  const commandId = isShiftPressed
    ? 'Comfy.QueuePromptFront'
    : 'Comfy.QueuePrompt'

  await commandStore.execute(commandId, {
    metadata: {
      subscribe_to_run: false,
      trigger_source: 'button'
    }
  })
}
</script>

