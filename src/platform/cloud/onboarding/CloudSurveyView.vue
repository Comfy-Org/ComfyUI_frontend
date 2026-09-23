<template>
  <div class="dark-theme flex max-h-full w-full max-w-md flex-col px-4 sm:px-6">
    <h1
      class="-mb-1 font-inter text-xl/8 font-semibold tracking-wide text-primary-comfy-canvas sm:text-2xl/8"
    >
      {{ $t('cloudOnboarding.survey.title') }}
    </h1>
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
import { useI18n } from 'vue-i18n'
import { isNavigationFailure, useRouter } from 'vue-router'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  getSurveyCompletedStatus,
  submitSurvey
} from '@/platform/cloud/onboarding/auth'
import {
  isSurveyReplayRequested,
  restoreSurveyReplayRequest
} from '@/platform/onboarding/onboardingReplay'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAuthStore } from '@/stores/authStore'

import DynamicSurveyForm from './survey/DynamicSurveyForm.vue'
import { defaultOnboardingSurvey } from './survey/defaultSurveySchema'

const router = useRouter()
const { t } = useI18n()
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
    const surveyCompleted = await getSurveyCompletedStatus(
      useAuthStore().userId
    )
    if (surveyCompleted) {
      await router.replace({ name: 'cloud-user-check' })
      return
    }
    if (!isSurveyReplayRequested(useAuthStore().userId))
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
  const replayOwner = useAuthStore().userId
  const replaying = isSurveyReplayRequested(replayOwner)
  if (replayOwner === undefined) {
    isSubmitting.value = false
    return
  }
  const result = await submitSurvey(payload, replayOwner)
  if (result.status === 'failed') {
    reportError(result.cause, {
      errorType: 'error_submitting_onboarding_survey'
    })
    useToastStore().add({
      severity: 'error',
      summary: t('cloudOnboarding.survey.submitFailed'),
      detail: t('cloudOnboarding.survey.submitFailedDetail'),
      life: 5000
    })
    isSubmitting.value = false
    return
  }
  if (result.status === 'stored') {
    useTelemetry()?.trackSurvey('submitted', payload)
  }

  try {
    const failure = await router.push({ name: 'cloud-user-check' })
    if (isNavigationFailure(failure)) throw failure
  } catch (error) {
    if (replaying && useAuthStore().userId === replayOwner)
      restoreSurveyReplayRequest(replayOwner)
    reportError(error, { errorType: 'error_navigating_from_onboarding_survey' })
    useToastStore().add({
      severity: 'error',
      summary: t('cloudOnboarding.survey.navigationFailed'),
      detail: t('cloudOnboarding.survey.navigationFailedDetail'),
      life: 5000
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>
