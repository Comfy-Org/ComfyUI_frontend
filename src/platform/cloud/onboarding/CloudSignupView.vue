<template>
  <div
    class="flex size-full items-center justify-center px-4 py-8 sm:px-6 md:px-8 lg:py-12"
  >
    <div class="flex w-full max-w-md flex-col items-start">
      <div class="flex w-full flex-col gap-4">
        <h1
          class="my-0 font-inter text-xl/8 font-semibold tracking-wide text-primary-comfy-canvas sm:text-2xl/8"
        >
          {{ t('auth.signup.title') }}
        </h1>
        <p
          class="my-0 text-base/6 tracking-[-0.02em] text-primary-comfy-canvas"
        >
          <span class="text-primary-comfy-canvas/70">{{
            t('auth.signup.alreadyHaveAccount')
          }}</span>
          <span
            class="ml-1 cursor-pointer text-primary-comfy-canvas underline"
            @click="navigateToLogin"
            >{{ t('auth.signup.signIn') }}</span
          >
        </p>
      </div>

      <Message v-if="!isSecureContext" severity="warn" class="mt-4 w-full">
        {{ t('auth.login.insecureContextWarning') }}
      </Message>

      <div class="flex w-full flex-col gap-4 pt-5 pb-2">
        <template v-if="!showEmailForm">
          <Button
            type="button"
            variant="secondary"
            class="relative h-10 w-full gap-4 rounded-md border border-solid border-primary-comfy-canvas/20 bg-primary-comfy-canvas/5 text-sm/4 font-medium text-primary-comfy-canvas hover:bg-primary-comfy-canvas/10"
            @click="signInWithGoogle"
          >
            <i class="pi pi-google text-base" />
            {{ t('auth.signup.signUpWithGoogle') }}
          </Button>

          <Button
            type="button"
            variant="secondary"
            class="relative h-10 w-full gap-4 rounded-md border border-solid border-primary-comfy-canvas/20 bg-primary-comfy-canvas/5 font-inter text-sm/4 font-medium text-primary-comfy-canvas hover:bg-primary-comfy-canvas/10"
            @click="signInWithGithub"
          >
            <i class="pi pi-github text-base" />
            {{ t('auth.signup.signUpWithGithub') }}
          </Button>

          <p
            v-if="showGoogleSsoInAppBrowserNotice"
            class="my-0 text-xs/5 text-primary-comfy-canvas/60"
            data-testid="google-sso-in-app-browser-notice"
          >
            {{ t('auth.login.googleSsoInAppBrowserNotice') }}
          </p>

          <Button
            variant="link"
            class="text-sm/4 text-primary-comfy-canvas/70 hover:text-primary-comfy-canvas"
            @click="switchToEmailForm"
          >
            {{ t('auth.login.useEmailInstead') }}
          </Button>
        </template>

        <template v-else>
          <Message v-if="isFreeTierEnabled" severity="warn" class="w-full">
            {{ t('auth.signup.emailNotEligibleForFreeTier') }}
          </Message>

          <Message v-if="userIsInChina" severity="warn" class="w-full">
            {{ t('auth.signup.regionRestrictionChina') }}
          </Message>
          <SignUpForm
            v-else
            ref="signUpForm"
            :auth-error="authError"
            @submit="signUpWithEmail"
          />

          <Button
            variant="secondary"
            class="mt-1 h-10 w-full rounded-md border-none bg-smoke-800/5 text-sm/5 font-normal tracking-[-0.011em] text-primary-comfy-canvas/55 hover:bg-sand-300/10"
            @click="switchToSocialLogin"
          >
            {{ t('auth.login.backToSocialLogin') }}
          </Button>
        </template>
      </div>

      <p
        class="mx-auto my-0 flex w-full max-w-10/12 flex-wrap items-center justify-center gap-x-1 py-4 text-center text-sm/5 tracking-[-0.011em] text-primary-comfy-canvas/70"
      >
        {{ t('auth.login.termsText') }}
        <a
          href="https://www.comfy.org/terms-of-service"
          target="_blank"
          class="cursor-pointer text-primary-comfy-canvas underline"
        >
          {{ t('auth.login.termsLink') }}
        </a>
        {{ t('auth.login.andText') }}
        <a
          href="https://www.comfy.org/privacy-policy"
          target="_blank"
          class="cursor-pointer text-primary-comfy-canvas underline"
        >
          {{ t('auth.login.privacyLink') }} </a
        >.
      </p>
      <p
        class="mx-auto mt-2 mb-0 flex w-full max-w-10/12 flex-wrap items-center justify-center gap-x-1 text-center text-sm/5 tracking-[-0.011em] text-primary-comfy-canvas/70"
      >
        {{ t('cloudWaitlist_questionsText') }}
        <a
          href="https://support.comfy.org"
          class="cursor-pointer text-primary-comfy-canvas underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('cloudWaitlist_contactLink') }}</a
        >.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import Message from 'primevue/message'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { isEmbeddedWebView } from '@/base/webviewDetection'
import SignUpForm from '@/components/dialog/content/signin/SignUpForm.vue'
import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useFreeTierOnboarding } from '@/platform/cloud/onboarding/composables/useFreeTierOnboarding'
import { usePostAuthRedirect } from '@/platform/cloud/onboarding/composables/usePostAuthRedirect'
import { useTelemetry } from '@/platform/telemetry'
import type { SignUpData } from '@/schemas/signInSchema'
import { isInChina } from '@/utils/networkUtil'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authActions = useAuthActions()
const isSecureContext = globalThis.isSecureContext
const authError = ref('')
const userIsInChina = ref(false)
const telemetry = useTelemetry()
const {
  showEmailForm,
  isFreeTierEnabled,
  switchToEmailForm,
  switchToSocialLogin
} = useFreeTierOnboarding()
const showGoogleSsoInAppBrowserNotice = isEmbeddedWebView()
const { onAuthSuccess } = usePostAuthRedirect({
  authError,
  successSummary: 'Sign up Completed',
  defaultRedirect: () => ({ path: '/', query: route.query })
})

const navigateToLogin = async () => {
  await router.push({ name: 'cloud-login', query: route.query })
}

const signInWithGoogle = async () => {
  authError.value = ''
  if (await authActions.signInWithGoogle({ isNewUser: true })) {
    await onAuthSuccess()
  }
}

const signInWithGithub = async () => {
  authError.value = ''
  if (await authActions.signInWithGithub({ isNewUser: true })) {
    await onAuthSuccess()
  }
}

const signUpForm = ref<InstanceType<typeof SignUpForm> | null>(null)

const signUpWithEmail = async (values: SignUpData, turnstileToken?: string) => {
  authError.value = ''
  if (
    await authActions.signUpWithEmail(
      values.email,
      values.password,
      turnstileToken
    )
  ) {
    await onAuthSuccess()
  } else {
    // Signup failed while the form is still mounted: re-arm the single-use
    // Turnstile token so the next attempt sends a fresh one.
    signUpForm.value?.resetTurnstile()
  }
}

onMounted(async () => {
  telemetry?.trackSignupOpened()

  userIsInChina.value = await isInChina()
})
</script>
<style scoped>
:deep(.p-inputtext) {
  border: 1px solid rgb(from var(--color-primary-comfy-canvas) r g b / 0.2) !important;
  box-shadow: none !important;
  background: transparent !important;
  color: var(--color-primary-comfy-canvas) !important;
  caret-color: var(--color-primary-comfy-canvas);
}

:deep(.p-inputtext::placeholder) {
  color: rgb(from var(--color-primary-comfy-canvas) r g b / 0.5);
}

:deep(.p-password input) {
  border: 1px solid rgb(from var(--color-primary-comfy-canvas) r g b / 0.2) !important;
  box-shadow: none !important;
  background: transparent !important;
}

:deep(.p-password-toggle-mask-icon) {
  cursor: pointer;
  color: rgb(from var(--color-primary-comfy-canvas) r g b / 0.5) !important;
}
:deep(.p-checkbox-checked .p-checkbox-box) {
  background-color: #f0ff41 !important;
  border-color: #f0ff41 !important;
}

:deep(.p-message-warn) {
  background: rgb(from var(--color-gold-500) r g b / 0.12) !important;
  border-color: rgb(from var(--color-gold-500) r g b / 0.3) !important;
  color: var(--color-gold-500) !important;
}
</style>
