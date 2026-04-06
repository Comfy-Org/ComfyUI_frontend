<script setup lang="ts">
import { computed } from 'vue'

import NightlySurveyPopover from './NightlySurveyPopover.vue'
import { getEnabledSurveys } from './surveyRegistry'

const enabledSurveys = computed(() => getEnabledSurveys())
</script>

<template>
  <template v-for="config in enabledSurveys" :key="config.featureId">
    <NightlySurveyPopover :config="config" />
  </template>
</template>
