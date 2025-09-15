<template>
  <CloudLoginViewSkeleton v-if="skeletonType === 'login'" />
  <CloudSurveyViewSkeleton v-else-if="skeletonType === 'survey'" />
  <CloudWaitlistViewSkeleton v-else-if="skeletonType === 'waitlist'" />
  <div v-else-if="error" class="h-full flex items-center justify-center p-8">
    <div class="lg:w-96 max-w-[100vw] p-2 text-center">
      <p class="text-red-500 mb-4">{{ errorMessage }}</p>
      <Button
        :label="
          isRetrying
            ? $t('cloudOnboarding.retrying')
            : $t('cloudOnboarding.retry')
        "
        :loading="isRetrying"
        class="w-full"
        @click="handleRetry"
      />
    </div>
  </div>
  <div v-else class="flex items-center justify-center min-h-screen">
    <ProgressSpinner class="w-8 h-8" />
  </div>
</template>

<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getSurveyCompletedStatus, getUserCloudStatus } from '@/api/auth'
import { useErrorHandling } from '@/composables/useErrorHandling'

import CloudLoginViewSkeleton from './skeletons/CloudLoginViewSkeleton.vue'
import CloudSurveyViewSkeleton from './skeletons/CloudSurveyViewSkeleton.vue'
import CloudWaitlistViewSkeleton from './skeletons/CloudWaitlistViewSkeleton.vue'

const router = useRouter()
const { wrapWithErrorHandlingAsync } = useErrorHandling()

const skeletonType = ref<'login' | 'survey' | 'waitlist' | 'loading'>('loading')

const {
  isLoading,
  error,
  execute: checkUserStatus
} = useAsyncState(
  wrapWithErrorHandlingAsync(async () => {
    await nextTick()

    const [cloudUserStats, surveyStatus] = await Promise.all([
      getUserCloudStatus(),
      getSurveyCompletedStatus()
    ])

    // Navigate based on user status
    if (!cloudUserStats) {
      skeletonType.value = 'login'
      await router.replace({ name: 'cloud-login' })
      return
    }

    if (!surveyStatus) {
      skeletonType.value = 'survey'
      await router.replace({ name: 'cloud-survey' })
      return
    }

    if (cloudUserStats.status !== 'active') {
      skeletonType.value = 'waitlist'
      await router.replace({ name: 'cloud-waitlist' })
      return
    }

    // User is fully onboarded
    window.location.href = '/'
  }),
  null,
  { resetOnExecute: false }
)

const errorMessage = computed(() => {
  if (!error.value) return ''

  // Provide user-friendly error messages
  const errorStr = error.value.toString().toLowerCase()

  if (errorStr.includes('network') || errorStr.includes('fetch')) {
    return 'Connection problem. Please check your internet connection.'
  }

  if (errorStr.includes('timeout')) {
    return 'Request timed out. Please try again.'
  }

  return 'Unable to check account status. Please try again.'
})

const isRetrying = computed(() => isLoading.value && !!error.value)

const handleRetry = async () => {
  await checkUserStatus()
}
</script>
