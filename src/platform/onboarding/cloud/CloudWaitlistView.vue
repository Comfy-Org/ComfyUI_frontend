<template>
  <div class="flex flex-col items-center justify-center p-8">
    <div class="w-full max-w-md text-center">
      <h1
        class="font-abcrom my-0 text-3xl font-black text-white uppercase italic"
      >
        {{ t('cloudWaitlist_titleLine1') }}<br />
        {{ t('cloudWaitlist_titleLine2') }}
      </h1>
      <p class="mt-6 leading-relaxed text-neutral-300">
        {{ t('cloudWaitlist_message') }}
      </p>
    </div>

    <!-- Signed in as -->
    <section class="mt-10">
      <p class="text-center text-sm">
        {{ t('cloudInvite_signedInAs') }}
      </p>

      <div class="mt-4 flex flex-col items-center justify-center gap-4">
        <div class="text-left">
          <div class="font-bold break-all">
            {{ userEmail }}
          </div>
        </div>
      </div>
    </section>

    <div class="mt-4">
      <span
        class="cursor-pointer text-blue-400 no-underline"
        @click="onSwitchAccounts"
      >
        {{ t('cloudInvite_switchAccounts') }}</span
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { getUserCloudStatus } from '@/api/auth'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const { t } = useI18n()
const { userEmail } = useFirebaseAuthStore()
const router = useRouter()

const onSwitchAccounts = () => {
  void router.push({
    name: 'cloud-login',
    query: { switchAccount: 'true' }
  })
}

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
