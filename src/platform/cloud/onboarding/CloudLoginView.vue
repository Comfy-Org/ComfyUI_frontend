<template>
  <div
    class="flex size-full items-center justify-center px-4 py-8 sm:px-6 md:px-8 lg:py-12"
  >
    <div class="flex w-full max-w-md flex-col items-start">
      <div class="flex w-full flex-col gap-4">
        <h1
          class="my-0 font-inter text-xl/8 font-extrabold tracking-wide text-primary-comfy-canvas sm:text-2xl/8"
        >
          {{ t('auth.login.title') }}
        </h1>
        <p
          class="my-0 text-base/6 tracking-[-0.02em] text-primary-comfy-canvas"
        >
          {{ t('auth.login.newUser') }}
          <span
            class="cursor-pointer text-azure-600"
            @click="navigateToSignup"
            >{{ t('auth.login.signUp') }}</span
          >
        </p>
      </div>

      <Message v-if="!isSecureContext" severity="warn" class="mt-4 w-full">
        {{ t('auth.login.insecureContextWarning') }}
      </Message>

      <div class="flex w-full flex-col gap-4 pt-5 pb-2">
        <template v-if="!showEmailForm">
          <Button
            v-if="!googleSsoBlockedReason"
            type="button"
            variant="secondary"
            class="relative h-10 w-full gap-4 rounded-md border border-solid border-smoke-800/10 bg-smoke-800/10 text-sm/4 font-medium text-primary-comfy-canvas shadow-inset-highlight hover:bg-sand-300/20"
            @click="signInWithGoogle"
          >
            <i class="pi pi-google text-base" />
            {{ t('auth.login.loginWithGoogle') }}
          </Button>

          <Button
            type="button"
            variant="secondary"
            class="relative h-10 w-full gap-4 rounded-md border border-solid border-smoke-800/10 bg-smoke-800/10 font-inter text-sm/4 font-medium text-primary-comfy-canvas shadow-inset-highlight hover:bg-sand-300/20"
            @click="signInWithGithub"
          >
            <i class="pi pi-github text-base" />
            {{ t('auth.login.loginWithGithub') }}
          </Button>

          <Button
            variant="link"
            class="text-sm/4 text-primary-comfy-canvas/70 hover:text-primary-comfy-canvas"
            @click="switchToEmailForm"
          >
            {{ t('auth.login.useEmailInstead') }}
          </Button>
        </template>

        <template v-else>
          <CloudSignInForm :auth-error="authError" @submit="signInWithEmail" />

          <Button
            variant="secondary"
            class="mt-1 h-10 w-full rounded-md border-none bg-smoke-800/5 text-sm/5 font-normal tracking-[-0.011em] text-primary-comfy-canvas/55 hover:bg-primary-comfy-canvas/10"
            @click="switchToSocialLogin"
          >
            {{ t('auth.login.backToSocialLogin') }}
          </Button>
        </template>
      </div>

      <p
        class="mx-auto my-0 flex w-full max-w-10/12 flex-wrap items-center justify-center gap-x-1 py-4 text-center text-sm/5 tracking-[-0.011em] text-primary-comfy-canvas"
      >
        {{ t('auth.login.termsText') }}
        <a
          href="https://comfy.org/terms-of-service/"
          target="_blank"
          class="cursor-pointer text-azure-600 no-underline"
        >
          {{ t('auth.login.termsLink') }}
        </a>
        {{ t('auth.login.andText') }}
        <a
          href="https://comfy.org/privacy-policy/"
          target="_blank"
          class="cursor-pointer text-azure-600 no-underline"
        >
          {{ t('auth.login.privacyLink') }} </a
        >.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import Message from 'primevue/message'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import CloudSignInForm from '@/platform/cloud/onboarding/components/CloudSignInForm.vue'
import { usePostAuthRedirect } from '@/platform/cloud/onboarding/composables/usePostAuthRedirect'
import type { SignInData } from '@/schemas/signInSchema'
import { getGoogleSsoBlockedReason } from '@/base/webviewDetection'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authActions = useAuthActions()
const isSecureContext = globalThis.isSecureContext
const authError = ref('')
const showEmailForm = ref(false)
const googleSsoBlockedReason = getGoogleSsoBlockedReason()
const { onAuthSuccess } = usePostAuthRedirect({
  authError,
  successSummary: 'Login Completed',
  defaultRedirect: () => ({ name: 'cloud-user-check' })
})

function switchToEmailForm() {
  showEmailForm.value = true
}

function switchToSocialLogin() {
  showEmailForm.value = false
}

const navigateToSignup = async () => {
  await router.push({ name: 'cloud-signup', query: route.query })
}

const signInWithGoogle = async () => {
  authError.value = ''
  if (await authActions.signInWithGoogle()) {
    await onAuthSuccess()
  }
}

const signInWithGithub = async () => {
  authError.value = ''
  if (await authActions.signInWithGithub()) {
    await onAuthSuccess()
  }
}

const signInWithEmail = async (values: SignInData) => {
  authError.value = ''
  if (await authActions.signInWithEmail(values.email, values.password)) {
    await onAuthSuccess()
  }
}
</script>
