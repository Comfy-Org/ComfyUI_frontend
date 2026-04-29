<template>
  <div class="flex h-[700px] max-h-[85vh] w-[320px] max-w-[90vw] flex-col">
    <DynamicSurveyForm
      :key="activeSurvey.version"
      :survey="activeSurvey"
      :is-submitting="isSubmitting"
      @submit="onSubmitSurvey"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  getSurveyCompletedStatus,
  submitSurvey
} from '@/platform/cloud/onboarding/auth'
import { isCloud } from '@/platform/distribution/types'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'

import DynamicSurveyForm from './survey/DynamicSurveyForm.vue'
import { defaultOnboardingSurvey } from './survey/defaultSurveySchema'

const router = useRouter()
const { flags } = useFeatureFlags()
const onboardingSurveyEnabled = computed(() => flags.onboardingSurveyEnabled)

const activeSurvey = computed(
  () => remoteConfig.value.onboarding_survey ?? defaultOnboardingSurvey
)

const isSubmitting = ref(false)

onMounted(async () => {
  if (!onboardingSurveyEnabled.value) {
    await router.replace({ name: 'cloud-user-check' })
    return
  }
  try {
    const surveyCompleted = await getSurveyCompletedStatus()
    if (surveyCompleted) {
      await router.replace({ name: 'cloud-user-check' })
      return
    }
    if (isCloud) {
      useTelemetry()?.trackSurvey('opened')
    }
  } catch (error) {
    console.error('Failed to check survey status:', error)
  }
})

const onSubmitSurvey = async (payload: Record<string, unknown>) => {
  if (!onboardingSurveyEnabled.value) {
    await router.replace({ name: 'cloud-user-check' })
    return
  }
  isSubmitting.value = true
  try {
    await submitSurvey(payload)
    if (isCloud) {
      useTelemetry()?.trackSurvey('submitted', payload)
    }
    await router.push({ name: 'cloud-user-check' })
  } finally {
    isSubmitting.value = false
  }
}
</script>
