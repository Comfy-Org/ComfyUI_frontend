<template>
  <CloudLoginViewSkeleton v-if="skeletonType === 'login'" />
  <CloudSurveyViewSkeleton v-else-if="skeletonType === 'survey'" />
  <CloudWaitlistViewSkeleton v-else-if="skeletonType === 'waitlist'" />
  <div v-else class="flex items-center justify-center min-h-screen">
    <div class="animate-pulse text-gray-500">{{ $t('g.loading') }}</div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getSurveyCompletedStatus, getUserCloudStatus } from '@/api/auth'

import CloudLoginViewSkeleton from './skeletons/CloudLoginViewSkeleton.vue'
import CloudSurveyViewSkeleton from './skeletons/CloudSurveyViewSkeleton.vue'
import CloudWaitlistViewSkeleton from './skeletons/CloudWaitlistViewSkeleton.vue'

const router = useRouter()
const isNavigating = ref(false)
const skeletonType = ref<'login' | 'survey' | 'waitlist' | 'loading'>('loading')

onMounted(async () => {
  // Prevent multiple executions
  if (isNavigating.value) {
    return
  }
  isNavigating.value = true

  // Wait for next tick to ensure component is fully mounted
  await nextTick()

  try {
    const cloudUserStats = await getUserCloudStatus()
    const surveyStatus = await getSurveyCompletedStatus()

    if (!cloudUserStats) {
      skeletonType.value = 'login'
      await router.replace({ name: 'cloud-login' })
      return
    }

    // Check onboarding status and redirect accordingly
    if (!surveyStatus) {
      // User hasn't completed survey
      skeletonType.value = 'survey'
      await router.replace({ name: 'cloud-survey' })
    } else if (cloudUserStats.status !== 'active') {
      // User completed survey but not whitelisted
      skeletonType.value = 'waitlist'
      await router.replace({ name: 'cloud-waitlist' })
    } else {
      // User is fully onboarded - keep loading state (no specific skeleton for main app)
      await router.replace({ name: 'GraphView' })
    }
  } catch (error) {
    // On error, fallback to login
    skeletonType.value = 'login'
    await router.push({ name: 'cloud-login' })
  }
})
</script>
