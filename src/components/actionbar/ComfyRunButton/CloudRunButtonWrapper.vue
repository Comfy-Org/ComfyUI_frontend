<template>
  <component
    :is="currentButton"
    :key="canRunWorkflows ? 'queue' : 'subscribe'"
    v-coachmark="COACH_IDS.graphRunButton"
  />
</template>
<script setup lang="ts">
import { computed } from 'vue'

import ComfyQueueButton from '@/components/actionbar/ComfyRunButton/ComfyQueueButton.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { COACH_IDS } from '@/platform/onboarding/onboardingTours'
import { vCoachmark } from '@/platform/onboarding/vCoachmark'
import SubscribeToRunButton from '@/platform/cloud/subscription/components/SubscribeToRun.vue'

const { canRunWorkflows } = useBillingContext()

const currentButton = computed(() =>
  canRunWorkflows.value ? ComfyQueueButton : SubscribeToRunButton
)
</script>
