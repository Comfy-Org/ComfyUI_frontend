<template>
  <template v-if="isOnboardingCandidate(deps)">
    <GettingStartedScreen />
    <FirstRunTourOverlay />
    <FirstRunTourNudge />
  </template>
</template>

<script setup lang="ts">
import { useDesktopLayout } from '@/composables/useDesktopLayout'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isOnboardingCandidate } from '@/platform/workflow/persistence/onboardingEntryStore'
import { useNewUserService } from '@/services/useNewUserService'

import FirstRunTourNudge from './FirstRunTourNudge.vue'
import FirstRunTourOverlay from './FirstRunTourOverlay.vue'
import GettingStartedScreen from './GettingStartedScreen.vue'

const deps = {
  subscription: useSubscription(),
  newUserService: useNewUserService(),
  featureFlags: useFeatureFlags(),
  desktop: useDesktopLayout()
}
</script>
