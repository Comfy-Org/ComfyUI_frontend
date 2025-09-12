<template>
  <BaseViewTemplate dark />
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getMe } from '@/api/auth'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const router = useRouter()
const isNavigating = ref(false)

onMounted(async () => {
  // Prevent multiple executions
  if (isNavigating.value) {
    return
  }
  isNavigating.value = true

  // Wait for next tick to ensure component is fully mounted
  await nextTick()

  // Get user status from API (synchronous)
  const user = getMe()

  try {
    if (!user) {
      // No user data, redirect to login
      await router.replace({ name: 'cloud-login' })
      return
    }

    // Check onboarding status and redirect accordingly
    if (!user.surveyCompleted) {
      // User hasn't completed survey
      await router.replace({ name: 'cloud-survey' })
    } else if (!user.whitelisted) {
      // User completed survey but not whitelisted
      await router.replace({ name: 'cloud-waitlist' })
    } else {
      // User is fully onboarded - just reload the page to bypass router issues
      window.location.href = '/'
    }
  } catch (error) {
    // On error, fallback to page reload
    window.location.href = '/'
  }
})
</script>
