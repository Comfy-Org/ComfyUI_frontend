<template>
  <CoachmarkLanding
    v-if="isRegistryTour && tour.step?.landing"
    :title="tour.title"
    :message="tour.body"
    :image="tour.step.image"
    :primary-label="tour.primaryLabel"
    :skip-label="tour.skipLabel"
    :waiting-for-target="tour.waitingForTarget"
    @start="tour.next"
    @skip="tour.skip"
  />
  <TourSpotlight
    v-else-if="isRegistryTour && tour.step"
    :step="tour.step"
    :title="tour.title"
    :body="tour.body"
    :is-last="tour.isLast"
    :can-go-back="tour.canGoBack"
    :primary-label="tour.primaryLabel"
    :skip-label="tour.skipLabel"
    :back-label="tour.backLabel"
    :counted-step-idx="tour.countedStepIdx"
    :counted-steps-total="tour.countedStepsTotal"
    :waiting-for-target="tour.waitingForTarget"
    @advance="tour.next"
    @back="tour.back"
    @skip="tour.skip"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import CoachmarkLanding from './CoachmarkLanding.vue'
import TourSpotlight from './TourSpotlight.vue'
import { TOURS } from './onboardingTours'
import { useOnboardingTourStore } from './onboardingTourStore'

const tour = useOnboardingTourStore()

// firstRun renders its own overlay; here, render only registry-backed tours.
const isRegistryTour = computed(
  () => tour.activeTour != null && tour.activeTour in TOURS
)
</script>
