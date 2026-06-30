<template>
  <CoachmarkLanding
    v-if="step?.landing"
    v-model:open="landingOpen"
    :title="t(step.titleKey)"
    :message="t(step.bodyKey)"
    :image="step.image"
    :primary-label="primaryLabel"
    :skip-label="skipLabel"
    @start="next"
  />
  <TourSpotlight
    v-else-if="step"
    :step="step"
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import CoachmarkLanding from './CoachmarkLanding.vue'
import TourSpotlight from './TourSpotlight.vue'
import { useCoachmarkTour } from './useCoachmarkTour'

const { t } = useI18n()

const {
  step,
  isLast,
  primaryLabel,
  skipLabel,
  countedStepIdx,
  countedSteps,
  suspendFocusGuard,
  next,
  end
} = useCoachmarkTour()

// Dismissing the landing Dialog (escape/close/Skip) ends the tour; advancing flips
// `step.landing` false to close it without skipping.
const landingOpen = computed({
  get: () => !!step.value?.landing,
  set: (value) => {
    if (!value) end('skipped')
  }
})
</script>
