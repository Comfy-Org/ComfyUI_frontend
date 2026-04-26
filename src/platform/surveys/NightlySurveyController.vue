<template>
  <template v-for="config in enabledSurveys" :key="config.featureId">
    <NightlySurveyPopover :config />
  </template>
  <NightlySurveyPopover
    v-if="errorPanelConfig"
    v-model:open="isErrorPopoverOpen"
    :config="errorPanelConfig"
    mode="manual"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import NightlySurveyPopover from './NightlySurveyPopover.vue'
import { getFloatingSurveys, getSurveyConfig } from './surveyRegistry'
import { useErrorSurveyPopoverState } from './useErrorSurveyPopoverState'
import { useErrorSurveyTracking } from './useErrorSurveyTracking'

useErrorSurveyTracking()

const { isPopoverOpen: isErrorPopoverOpen } = useErrorSurveyPopoverState()

const enabledSurveys = computed(() => getFloatingSurveys())
const errorPanelConfig = computed(() => {
  const config = getSurveyConfig('error-panel')
  if (!config || config.enabled === false) return undefined
  if (config.presentation !== 'inline-cta') return undefined
  return config
})
</script>
