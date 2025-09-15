<template>
  <div class="flex flex-col items-center justify-center p-8">
    <div class="w-full max-w-md text-center">
      <h1 class="font-abcrom font-black italic uppercase hero-title">
        {{ t('cloudWaitlist_titleLine1') }}<br />
        {{ t('cloudWaitlist_titleLine2') }}
      </h1>
      <div class="max-w-[320px] text-lg font-light">
        <p class="text-white">
          {{ t('cloudWaitlist_message') }}
        </p>
        <p class="text-white">
          {{ t('cloudWaitlist_questionsText') }}
          <a
            href="https://support.comfy.org"
            class="text-blue-400 no-underline cursor-pointer"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('cloudWaitlist_contactLink') }}</a
          >.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import { getUserCloudStatus } from '@/api/auth'

const { t } = useI18n()

// Check if user is whitelisted on mount
onMounted(async () => {
  try {
    const userStatus = await getUserCloudStatus()
    if (userStatus.status === 'active') {
      // User is whitelisted, redirect to main app
      window.location.href = '/'
    }
  } catch (error) {
    console.error('Failed to check user status:', error)
  }
})
</script>
