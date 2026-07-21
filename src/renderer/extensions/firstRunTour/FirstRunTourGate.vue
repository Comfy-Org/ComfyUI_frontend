<template>
  <template v-if="eligible">
    <GettingStartedScreen />
    <FirstRunTourOverlay />
    <FirstRunTourNudge />
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useDesktopLayout } from '@/composables/useDesktopLayout'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isOnboardingCandidate } from '@/platform/workflow/persistence/onboardingEntryStore'
import { useNewUserService } from '@/services/useNewUserService'

import FirstRunTourNudge from './FirstRunTourNudge.vue'
import FirstRunTourOverlay from './FirstRunTourOverlay.vue'
import GettingStartedScreen from './GettingStartedScreen.vue'

/**
 * Gates all first tour-related components on onboarding candidacy.
 * Avoids mounting bodies or running logic unless `eligible` is true.
 * Ensures components are only loaded when the user is a valid tour candidate.
 */
const deps = {
  subscription: useSubscription(),
  newUserService: useNewUserService(),
  featureFlags: useFeatureFlags(),
  desktop: useDesktopLayout()
}
const eligible = computed(() => isOnboardingCandidate(deps))
</script>
