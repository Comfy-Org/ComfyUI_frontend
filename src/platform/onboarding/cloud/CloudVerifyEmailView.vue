<template>
  <div class="mx-auto max-w-[640px] px-6 py-8">
    <!-- Back button -->
    <button
      type="button"
      class="text-foreground/80 flex size-10 items-center justify-center rounded-lg border border-white bg-transparent"
      aria-label="{{ t('cloudVerifyEmail_back') }}"
      @click="goBack"
    >
      <i class="pi pi-arrow-left" />
    </button>

    <!-- Title -->
    <h1 class="mt-8 text-2xl font-semibold">
      {{ t('cloudVerifyEmail_title') }}
    </h1>

    <!-- Body copy -->
    <p class="text-foreground/80 mt-6 mb-0 text-base">
      {{ t('cloudVerifyEmail_sent') }}
    </p>
    <p class="mt-2 text-base font-medium">{{ authStore.userEmail }}</p>

    <p class="text-foreground/80 mt-6 text-base whitespace-pre-line">
      {{ t('cloudVerifyEmail_clickToContinue') }}
    </p>

    <p class="text-foreground/80 mt-6 text-base whitespace-pre-line">
      {{ t('cloudVerifyEmail_tip') }}
    </p>

    <p class="text-foreground/80 mt-6 mb-0 text-base">
      {{ t('cloudVerifyEmail_didntReceive') }}
    </p>

    <p class="text-foreground/80 mt-1 text-base">
      <span class="cursor-pointer text-blue-400 no-underline" @click="onSend">
        {{ t('cloudVerifyEmail_resend') }}</span
      >
    </p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useFirebaseAuth } from 'vuefire'

import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

const authStore = useFirebaseAuthStore()
const auth = useFirebaseAuth()!

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const toastStore = useToastStore()

let intervalId: number | null = null
let timeoutId: number | null = null
const redirectInProgress = ref(false)

function clearPolling(): void {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
  if (timeoutId !== null) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
}

async function redirectToNextStep(): Promise<void> {
  if (redirectInProgress.value) return

  redirectInProgress.value = true
  clearPolling()

  const inviteCode = route.query.inviteCode as string | undefined

  if (inviteCode) {
    await router.push({
      name: 'cloud-invite-check',
      query: { inviteCode }
    })
  } else {
    await router.push({ name: 'cloud-user-check' })
  }
}

const goBack = async () => {
  const inviteCode = route.query.inviteCode as string | undefined
  const authStore = useFirebaseAuthStore()
  // If the user is already verified (email link already clicked),
  // continue to the next step automatically.
  if (authStore.isEmailVerified) {
    await router.push({
      name: 'cloud-invite-check',
      query: inviteCode ? { inviteCode } : {}
    })
  } else {
    await router.push({
      name: 'cloud-login',
      query: {
        inviteCode
      }
    })
  }
}

async function onSend() {
  try {
    await authStore.verifyEmail()

    // Track email verification requested
    if (isCloud) {
      useTelemetry()?.trackEmailVerification('requested')
    }

    toastStore.add({
      severity: 'info',
      summary: t('cloudVerifyEmail_toast_title'),
      detail: t('cloudVerifyEmail_toast_summary'),
      life: 2000
    })
  } catch (e) {
    toastStore.add({
      severity: 'error',
      summary: t('cloudVerifyEmail_toast_failed'),
      life: 2000
    })
  }
}

onMounted(async () => {
  // Track email verification screen opened
  if (isCloud) {
    useTelemetry()?.trackEmailVerification('opened')
  }

  // If the user is already verified (email link already clicked),
  // continue to the next step automatically.
  if (authStore.isEmailVerified) {
    return redirectToNextStep()
  }

  // Only send verification email automatically if coming from signup/login flow
  // Check if 'fromAuth' query parameter is present
  const fromAuth = route.query.fromAuth === 'true'
  if (fromAuth) {
    await onSend()
    // Remove fromAuth query parameter after sending email to prevent re-sending on refresh
    const { fromAuth: _, ...remainingQuery } = route.query
    await router.replace({
      name: route.name as string,
      query: remainingQuery
    })
  }

  // Start polling to check email verification status
  intervalId = window.setInterval(async () => {
    if (auth.currentUser && !redirectInProgress.value) {
      await auth.currentUser.reload()
      if (auth.currentUser?.emailVerified) {
        // Track email verification completed
        if (isCloud) {
          useTelemetry()?.trackEmailVerification('completed')
        }
        void redirectToNextStep()
      }
    }
  }, 5000) // Check every 5 seconds

  // Stop polling after 5 minutes
  timeoutId = window.setTimeout(
    () => {
      clearPolling()
    },
    5 * 60 * 1000
  )
})

onUnmounted(() => {
  clearPolling()
})
</script>
