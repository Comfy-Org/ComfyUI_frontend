<template>
  <div class="flex w-full flex-col">
    <h1
      class="mt-8 mb-0 text-2xl/snug font-light tracking-tighter text-primary-comfy-canvas sm:text-3xl/snug lg:text-4xl/snug xl:text-5xl/snug 2xl:text-6xl/snug"
    >
      {{ t('auth.signup.title') }}
    </h1>

    <p
      class="mt-8 mb-0 text-base/snug font-medium text-primary-comfy-canvas xl:text-lg/snug"
    >
      {{ t('auth.signup.alreadyHaveAccount') }}
      <RouterLink
        :to="{ name: 'cloud-login', query: route.query }"
        class="text-brand-yellow no-underline transition-all duration-300 hover:underline"
      >
        {{ t('auth.signup.signIn') }}
      </RouterLink>
    </p>

    <Message v-if="!isSecureContext" severity="warn" class="mt-4 w-full">
      {{ t('auth.login.insecureContextWarning') }}
    </Message>

    <div class="mt-12 flex flex-col gap-4 xl:gap-6">
      <template v-if="!showEmailForm">
        <CloudSocialAuthButtons
          :google-label="t('auth.signup.signUpWithGoogle')"
          :github-label="t('auth.signup.signUpWithGithub')"
          :show-in-app-browser-notice="showGoogleSsoInAppBrowserNotice"
          @google="signInWithGoogle"
          @github="signInWithGithub"
        />

        <button
          type="button"
          :class="CLOUD_AUTH_LINK_BUTTON_CLASS"
          @click="switchToEmailForm"
        >
          {{ t('auth.login.useEmailInstead') }}
        </button>
      </template>

      <template v-else>
        <Message v-if="isFreeTierEnabled" severity="warn" class="w-full">
          {{ t('auth.signup.emailNotEligibleForFreeTier') }}
        </Message>

        <div
          v-if="regionStatus === 'pending'"
          data-testid="region-check-pending"
          class="flex flex-col gap-6"
        >
          <Skeleton class="h-10 w-full" />
          <Skeleton class="h-10 w-full" />
          <Skeleton class="h-10 w-full" />
        </div>
        <Message
          v-else-if="regionStatus === 'blocked'"
          severity="warn"
          class="w-full"
        >
          {{ t('auth.signup.regionRestrictionChina') }}
        </Message>
        <SignUpForm
          v-else
          ref="signUpForm"
          :auth-error="authError"
          :field-class="CLOUD_AUTH_FIELD_CLASS"
          submit-variant="brand-solid"
          submit-size="brand"
          submit-class="mt-2 w-full"
          @submit="signUpWithEmail"
        />

        <button
          type="button"
          :class="CLOUD_AUTH_LINK_BUTTON_CLASS"
          @click="switchToSocialLogin"
        >
          {{ t('auth.login.backToSocialLogin') }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import SignUpForm from '@/components/dialog/content/signin/SignUpForm.vue'
import Message from '@/components/ui/message/Message.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useRegionGate } from '@/composables/auth/useRegionGate'
import CloudSocialAuthButtons from '@/platform/cloud/onboarding/components/CloudSocialAuthButtons.vue'
import { useCloudAuthPage } from '@/platform/cloud/onboarding/composables/useCloudAuthPage'
import { useFreeTierOnboarding } from '@/platform/cloud/onboarding/composables/useFreeTierOnboarding'
import {
  CLOUD_AUTH_FIELD_CLASS,
  CLOUD_AUTH_LINK_BUTTON_CLASS
} from '@/platform/cloud/onboarding/constants/authClasses'
import { useTelemetry } from '@/platform/telemetry'
import type { SignUpData } from '@/schemas/signInSchema'

const { t } = useI18n()
const route = useRoute()
const authActions = useAuthActions()
const telemetry = useTelemetry()

const { status: regionStatus } = useRegionGate()
const { isFreeTierEnabled } = useFreeTierOnboarding()

const {
  authError,
  showEmailForm,
  onAuthSuccess,
  isSecureContext,
  showGoogleSsoInAppBrowserNotice,
  switchToEmailForm,
  switchToSocialLogin,
  signInWithGoogle,
  signInWithGithub
} = useCloudAuthPage({
  isNewUser: true,
  successSummary: 'Sign up Completed',
  defaultRedirect: () => ({ path: '/', query: route.query })
})

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

onMounted(() => {
  telemetry?.trackSignupOpened()
})
</script>
