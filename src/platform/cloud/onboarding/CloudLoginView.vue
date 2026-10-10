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
      <span v-if="freeRunsSuffix">{{ ' ' + freeRunsSuffix }}</span>
    </p>

    <Message v-if="!isSecureContext" severity="warning" class="mt-4 w-full">
      {{ t('auth.login.insecureContextWarning') }}
    </Message>

    <Message v-if="ssoErrorKey" severity="error" class="mt-4 w-full">
      {{ t(ssoErrorKey) }}
    </Message>

    <CloudSsoRequiredNotice
      v-if="ssoRequiredNotice"
      v-bind="ssoRequiredNotice"
      class="mt-4"
    />

    <div class="mt-12 flex flex-col gap-4 xl:gap-6">
      <template v-if="authMode !== 'email'">
        <CloudSocialAuthButtons
          :google-label="t('auth.login.loginWithGoogle')"
          :github-label="t('auth.login.loginWithGithub')"
          :show-in-app-browser-notice="showGoogleSsoInAppBrowserNotice"
          @google="signInWithGoogle"
          @github="signInWithGithub"
        />

        <template v-if="flags.ssoEnabled && !ssoRequiredNotice">
          <CloudSsoSignIn
            v-if="authMode === 'sso'"
            :state="ssoState"
            @submit="trySso"
          />
          <Button
            v-else
            type="button"
            variant="brand-ghost"
            size="brand"
            class="w-full gap-3"
            @click="switchToSsoForm"
          >
            <i class="icon-[lucide--building-2] size-5" aria-hidden="true" />
            {{ t('auth.sso.continueWithSso') }}
          </Button>
        </template>

        <button
          type="button"
          :class="CLOUD_AUTH_LINK_BUTTON_CLASS"
          @click="switchToEmailForm"
        >
          {{ t('auth.login.useEmailInstead') }}
        </button>
      </template>

      <template v-else>
        <CloudSignInForm
          :auth-error="authError"
          :busy="ssoBusy"
          @submit="signInWithEmail"
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { readSsoError } from '@comfyorg/account-core/sso'

import Button from '@/components/ui/button/Button.vue'
import Message from '@/components/ui/message/Message.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import CloudSignInForm from '@/platform/cloud/onboarding/components/CloudSignInForm.vue'
import CloudSocialAuthButtons from '@/platform/cloud/onboarding/components/CloudSocialAuthButtons.vue'
import CloudSsoRequiredNotice from '@/platform/cloud/onboarding/components/CloudSsoRequiredNotice.vue'
import CloudSsoSignIn from '@/platform/cloud/onboarding/components/CloudSsoSignIn.vue'
import { useCloudAuthPage } from '@/platform/cloud/onboarding/composables/useCloudAuthPage'
import { useSsoSignIn } from '@/platform/cloud/onboarding/composables/useSsoSignIn'
import { CLOUD_AUTH_LINK_BUTTON_CLASS } from '@/platform/cloud/onboarding/constants/authClasses'
import { SSO_ERROR_MESSAGE_KEY } from '@/platform/cloud/onboarding/sso/ssoErrorMessages'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import type { SignInData } from '@/schemas/signInSchema'

const { t } = useI18n()
const route = useRoute()
const authActions = useAuthActions()
const { flags } = useFeatureFlags()
const { state: ssoState, busy: ssoBusy, trySso } = useSsoSignIn()

const freeRunsSuffix = computed(() => {
  const offer = remoteConfig.value.free_tier_offer
  if (!offer) return null
  const key = offer.requires_google_sign_in
    ? 'auth.login.freeRunsSuffixGoogle'
    : 'auth.login.freeRunsSuffix'
  return t(key, { count: offer.job_allowance })
})

const {
  authError,
  authMode,
  ssoRequiredNotice,
  onAuthSuccess,
  isSecureContext,
  showGoogleSsoInAppBrowserNotice,
  switchToEmailForm,
  switchToSsoForm,
  switchToSocialLogin,
  signInWithGoogle,
  signInWithGithub
} = useCloudAuthPage({
  successSummary: 'Login Completed',
  defaultRedirect: () => ({ name: 'cloud-user-check' })
})

const ssoErrorKey = computed(() => {
  if (!flags.ssoEnabled) return undefined
  const code = readSsoError(route.query.sso_error)
  return code && SSO_ERROR_MESSAGE_KEY[code]
})

const signInWithEmail = async (values: SignInData) => {
  authError.value = ''
  if (flags.ssoEnabled && (await trySso(values.email))) return
  if (await authActions.signInWithEmail(values.email, values.password)) {
    await onAuthSuccess()
  }
}
</script>
