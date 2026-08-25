<template>
  <GettingStartedScreen
    v-if="gettingStartedVisible && !isDesktopLoginApprovalPending"
  />
  <FirstRunTourNudge />
</template>

<script setup lang="ts">
import GettingStartedScreen from './gettingStarted/GettingStartedScreen.vue'
import { isDesktopLoginApprovalPending } from '@/platform/cloud/onboarding/desktopLoginRedemptionState'
import { useFirstRunEntry } from './gettingStarted/firstRunEntry'
import FirstRunTourNudge from './nudge/FirstRunTourNudge.vue'
import { useFirstRunTourController } from './tour/useFirstRunTourController'

const { gettingStartedVisible } = useFirstRunEntry()

useFirstRunTourController()
</script>
