<template>
  <div class="flex h-full items-center justify-center p-8">
    <div class="max-w-screen p-2 lg:w-96">
      <!-- Header -->
      <div class="mb-8 flex flex-col gap-4">
        <h1 class="my-0 text-xl leading-normal font-medium">
          {{ t('auth.signup.title') }}
        </h1>
        <p class="my-0 text-base">
          <span class="text-muted">{{
            t('auth.signup.alreadyHaveAccount')
          }}</span>
          <span
            class="ml-1 cursor-pointer text-blue-500"
            @click="navigateToLogin"
            >{{ t('auth.signup.signIn') }}</span
          >
        </p>
      </div>

      <Message v-if="!isSecureContext" severity="warn" class="mb-4">
        {{ t('auth.login.insecureContextWarning') }}
      </Message>

      <!-- Form -->
      <Message v-if="userIsInChina" severity="warn" class="mb-4">
        {{ t('auth.signup.regionRestrictionChina') }}
      </Message>
      <SignUpForm v-else :auth-error="authError" @submit="signUpWithEmail" />

      <!-- Divider -->
      <Divider align="center" layout="horizontal" class="my-8">
        <span class="text-muted">{{ t('auth.login.orContinueWith') }}</span>
      </Divider>

      <!-- Social Login Buttons -->
      <div class="flex flex-col gap-6">
        <Button
          type="button"
          class="h-10 bg-[#2d2e32]"
          variant="secondary"
          @click="signInWithGoogle"
        >
          <i class="pi pi-google mr-2"></i>
          {{ t('auth.signup.signUpWithGoogle') }}
        </Button>

        <Button
          type="button"
          class="h-10 bg-[#2d2e32]"
          variant="secondary"
          @click="signInWithGithub"
        >
          <i class="pi pi-github mr-2"></i>
          {{ t('auth.signup.signUpWithGithub') }}
        </Button>
      </div>

      <!-- Terms & Contact -->
      <div class="mt-5 text-sm text-gray-600">
        {{ t('auth.login.termsText') }}
        <a
          href="https://www.comfy.org/terms-of-service"
          target="_blank"
          class="cursor-pointer text-blue-400 no-underline"
        >
          {{ t('auth.login.termsLink') }}
        </a>
        {{ t('auth.login.andText') }}
        <a
          href="/privacy-policy"
          target="_blank"
          class="cursor-pointer text-blue-400 no-underline"
        >
          {{ t('auth.login.privacyLink') }} </a
        >.
        <p class="mt-2">
          {{ t('cloudWaitlist_questionsText') }}
          <a
            href="https://support.comfy.org"
            class="cursor-pointer text-blue-400 no-underline"
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
import Divider from 'primevue/divider'
import Message from 'primevue/message'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import SignUpForm from '@/components/dialog/content/signin/SignUpForm.vue'
import Button from '@/components/ui/button/Button.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { SignUpData } from '@/schemas/signInSchema'
import { isInChina } from '@/utils/networkUtil'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authActions = useFirebaseAuthActions()
const isSecureContext = window.isSecureContext
const authError = ref('')
const userIsInChina = ref(false)
const toastStore = useToastStore()

const navigateToLogin = () => {
  void router.push({ name: 'cloud-login', query: route.query })
}

const onSuccess = async () => {
  toastStore.add({
    severity: 'success',
    summary: 'Sign up Completed',
    life: 2000
  })
  // Direct redirect to main app - email verification removed
  await router.push({ path: '/', query: route.query })
}

const signInWithGoogle = async () => {
  authError.value = ''
  if (await authActions.signInWithGoogle()) {
    await onSuccess()
  }
}

const signInWithGithub = async () => {
  authError.value = ''
  if (await authActions.signInWithGithub()) {
    await onSuccess()
  }
}

const signUpWithEmail = async (values: SignUpData) => {
  authError.value = ''
  if (await authActions.signUpWithEmail(values.email, values.password)) {
    await onSuccess()
  }
}

onMounted(async () => {
  // Track signup screen opened
  if (isCloud) {
    useTelemetry()?.trackSignupOpened()
  }

  userIsInChina.value = await isInChina()
})
</script>
<style scoped>
:deep(.p-inputtext) {
  border: none !important;
  box-shadow: none !important;
  background: #2d2e32 !important;
}

:deep(.p-password input) {
  border: none !important;
  box-shadow: none !important;
}
:deep(.p-checkbox-checked .p-checkbox-box) {
  background-color: #f0ff41 !important;
  border-color: #f0ff41 !important;
}
</style>
