<template>
  <div class="px-6 py-8 max-w-[640px] mx-auto">
    <!-- Back button -->
    <button
      type="button"
      class="flex items-center justify-center size-10 rounded-lg bg-transparent border border-white text-foreground/80"
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
    <p class="mt-6 text-base text-foreground/80">
      {{ t('cloudVerifyEmail_sent') }}
    </p>
    <p class="mt-3 text-base font-medium">{{ authStore.userEmail }}</p>

    <p class="mt-6 text-base text-foreground/80">
      {{ t('cloudVerifyEmail_clickToContinue') }}
    </p>

    <p class="mt-10 text-base text-foreground/80">
      {{ t('cloudVerifyEmail_didntReceive') }}
      <span class="text-blue-400 no-underline cursor-pointer" @click="onSend">
        {{ t('cloudVerifyEmail_resend') }}</span
      >
    </p>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { useToastStore } from '@/stores/toastStore'

const authStore = useFirebaseAuthStore()

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

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
    useToastStore().add({
      severity: 'success',
      summary: t('cloudVerifyEmail_toast_success', {
        email: authStore.userEmail
      })
    })
  } catch (e) {
    useToastStore().add({
      severity: 'error',
      summary: t('cloudVerifyEmail_toast_failed')
    })
  }
}

onMounted(async () => {
  // When this screen loads via invite flow,
  // ensure the invite code stays in the URL for the next step.
  const inviteCode = route.query.inviteCode as string | undefined

  // If the user is already verified (email link already clicked),
  // continue to the next step automatically.
  if (authStore.isEmailVerified) {
    if (inviteCode) {
      await router.push({
        name: 'cloud-invite-check',
        query: inviteCode ? { inviteCode } : {}
      })
    } else {
      await router.push({ name: 'cloud-user-check' })
    }
  } else {
    await onSend()
  }
})
</script>
