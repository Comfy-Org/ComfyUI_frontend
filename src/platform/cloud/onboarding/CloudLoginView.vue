<template>
  <div class="flex w-full flex-col">
    <h1
      class="mt-8 mb-0 text-2xl/snug font-light tracking-tighter text-primary-comfy-canvas sm:text-3xl/snug lg:text-4xl/snug xl:text-5xl/snug 2xl:text-6xl/snug"
    >
      {{ t('auth.login.title') }}
    </h1>

    <p
      class="mt-8 mb-0 text-base/snug font-medium text-primary-comfy-canvas xl:text-lg/snug"
    >
      {{ t('auth.login.cloudNewUser') }}
      <RouterLink
        :to="{ name: 'cloud-signup', query: route.query }"
        class="text-brand-yellow no-underline transition-all duration-300 hover:underline"
      >
        {{ t('auth.login.cloudSignUp') }}
      </RouterLink>
      <span>
        {{ ' ' + t('auth.login.freeRunsSuffix', { count: 5 }) }}
      </span>
    </p>

    <Message v-if="!isSecureContext" severity="warn" class="mt-4 w-full">
      {{ t('auth.login.insecureContextWarning') }}
    </Message>

    <div class="mt-12 flex flex-col gap-4 xl:gap-6">
      <template v-if="!showEmailForm">
        <CloudSocialAuthButtons
          :google-label="t('auth.login.loginWithGoogle')"
          :github-label="t('auth.login.loginWithGithub')"
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
        <CloudSignInForm :auth-error="authError" @submit="signInWithEmail" />

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
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import Message from '@/components/ui/message/Message.vue'
import CloudSignInForm from '@/platform/cloud/onboarding/components/CloudSignInForm.vue'
import CloudSocialAuthButtons from '@/platform/cloud/onboarding/components/CloudSocialAuthButtons.vue'
import { useCloudAuthPage } from '@/platform/cloud/onboarding/composables/useCloudAuthPage'
import { CLOUD_AUTH_LINK_BUTTON_CLASS } from '@/platform/cloud/onboarding/constants/authClasses'
import type { SignInData } from '@/schemas/signInSchema'

const { t } = useI18n()
const route = useRoute()
const authActions = useAuthActions()

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
  successSummary: 'Login Completed',
  defaultRedirect: () => ({ name: 'cloud-user-check' })
})

const signInWithEmail = async (values: SignInData) => {
  authError.value = ''
  if (await authActions.signInWithEmail(values.email, values.password)) {
    await onAuthSuccess()
  }
}
</script>
