<template>
  <CoachmarkLanding
    v-if="step?.landing"
    :title
    :message="body"
    :image="step.image"
    :primary-label="primaryLabel"
    :skip-label="skipLabel"
    @start="next"
    @skip="end('skipped')"
  />
  <TourSpotlight
    v-else-if="step"
    :step="step"
    :title
    :body
    :is-last="isLast"
    :primary-label="primaryLabel"
    :skip-label="skipLabel"
    :counted-step-idx="countedStepIdx"
    :counted-steps-total="countedSteps.length"
    :suspend-focus-guard="suspendFocusGuard"
    @advance="next"
    @skip="end('skipped')"
  />
</template>

<script setup lang="ts">
import CoachmarkLanding from './CoachmarkLanding.vue'
import TourSpotlight from './TourSpotlight.vue'
import { useCoachmarkTour } from './useCoachmarkTour'

const {
  step,
  isLast,
  title,
  body,
  primaryLabel,
  skipLabel,
  countedStepIdx,
  countedSteps,
  suspendFocusGuard,
  next,
  end
} = useCoachmarkTour()
</script>
