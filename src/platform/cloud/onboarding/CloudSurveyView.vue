<template>
  <div
    class="dark-theme flex h-152 max-h-[85vh] w-full max-w-md flex-col overflow-y-auto px-4 sm:px-6"
  >
    <h1
      class="-mb-1 font-inter text-xl/8 font-semibold tracking-wide text-primary-comfy-canvas sm:text-2xl/8"
    >
      {{ $t('cloudOnboarding.survey.title') }}
    </h1>
    <DynamicSurveyForm
      :key="activeSurvey.version"
      class="flex-1"
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
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'

import DynamicSurveyForm from './survey/DynamicSurveyForm.vue'
import { defaultOnboardingSurvey } from './survey/defaultSurveySchema'

const router = useRouter()
const { flags } = useFeatureFlags()
const onboardingSurveyEnabled = computed(() => flags.onboardingSurveyEnabled)

// TEMPORARY: prefer the frontend default so the redesigned survey is visible
// even while the backend still ships the old schema. Revert to
// `remoteConfig.value.onboarding_survey ?? defaultOnboardingSurvey` before merge.
const activeSurvey = computed(
  () => defaultOnboardingSurvey ?? remoteConfig.value.onboarding_survey
)

const isSubmitting = ref(false)

// TEMPORARY: preview the redesigned survey regardless of enabled/completed
// state. Delete this line and its use below before merge.
const previewSurveyAlways = true

onMounted(async () => {
  if (previewSurveyAlways) {
    useTelemetry()?.trackSurvey('opened')
    return
  }
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
    useTelemetry()?.trackSurvey('opened')
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
    useTelemetry()?.trackSurvey('submitted', payload)
    await router.push({ name: 'cloud-user-check' })
  } finally {
    isSubmitting.value = false
  }
}
</script>
