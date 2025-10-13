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
    <p class="text-foreground/80 mt-6 text-base">
      {{ t('cloudVerifyEmail_sent') }}
    </p>
    <p class="mt-3 text-base font-medium">{{ authStore.userEmail }}</p>

    <p class="text-foreground/80 mt-6 text-base">
      {{ t('cloudVerifyEmail_clickToContinue') }}
    </p>

    <p class="text-foreground/80 mt-10 text-base">
      {{ t('cloudVerifyEmail_didntReceive') }}
      <span class="cursor-pointer text-blue-400 no-underline" @click="onSend">
        {{ t('cloudVerifyEmail_resend') }}</span
      >
    </p>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useToastStore } from '@/platform/updates/common/toastStore'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

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
