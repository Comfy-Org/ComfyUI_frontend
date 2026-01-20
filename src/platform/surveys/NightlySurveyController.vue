<script setup lang="ts">
import { computed } from 'vue'

import { isCloud, isDesktop, isNightly } from '@/platform/distribution/types'

import NightlySurveyPopover from './NightlySurveyPopover.vue'
import { getEnabledSurveys } from './surveyRegistry'

const isNightlyLocalhost = computed(() => isNightly && !isCloud && !isDesktop)

const enabledSurveys = computed(() => {
  if (!isNightlyLocalhost.value) return []
  return getEnabledSurveys()
})
</script>

<template>
  <template v-for="config in enabledSurveys" :key="config.featureId">
    <NightlySurveyPopover :config="config" />
  </template>
</template>
