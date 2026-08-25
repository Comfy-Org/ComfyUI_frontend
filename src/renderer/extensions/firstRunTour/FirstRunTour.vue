<template>
  <GettingStartedScreen v-if="shouldShowGettingStarted" />
  <FirstRunTourNudge />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import GettingStartedScreen from './gettingStarted/GettingStartedScreen.vue'
import { isDesktopLoginApprovalPending } from '@/platform/cloud/onboarding/desktopLoginRedemptionState'
import { useFirstRunEntry } from './gettingStarted/firstRunEntry'
import FirstRunTourNudge from './nudge/FirstRunTourNudge.vue'
import { useFirstRunTourController } from './tour/useFirstRunTourController'

const { gettingStartedVisible } = useFirstRunEntry()
const shouldShowGettingStarted = computed(
  () => gettingStartedVisible.value && !isDesktopLoginApprovalPending.value
)

useFirstRunTourController()
</script>
