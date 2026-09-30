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

    <Message v-if="!isSecureContext" severity="warning" class="mt-4 w-full">
      {{ t('auth.login.insecureContextWarning') }}
    </Message>

    <Message v-if="ssoError" severity="error" class="mt-4 w-full">
      {{ t(ssoErrorMessageKey(ssoError)) }}
      <button
        type="button"
        class="ml-1 cursor-pointer border-none bg-transparent p-0 font-[inherit] text-current underline"
        @click="retrySso"
      >
        {{ t('auth.sso.tryAgain') }}
      </button>
    </Message>

    <div class="mt-12 flex flex-col gap-4 xl:gap-6">
      <CloudSsoSignIn
        v-if="mode === 'sso'"
        :key="ssoPrompt?.email"
        :default-email="ssoPrompt?.email"
        :notice="ssoPrompt ? t('auth.errors.ssoRequired') : undefined"
      />

      <template v-if="mode !== 'email'">
        <CloudSocialAuthButtons
          :google-label="t('auth.login.loginWithGoogle')"
          :github-label="t('auth.login.loginWithGithub')"
          :show-in-app-browser-notice="showGoogleSsoInAppBrowserNotice"
          @google="signInWithGoogle"
          @github="signInWithGithub"
        />

        <Button
          v-if="mode === 'social'"
          type="button"
          variant="brand-ghost"
          size="brand"
          class="w-full gap-3"
          @click="switchToSsoForm"
        >
          <i class="icon-[lucide--building-2] size-5" aria-hidden="true" />
          {{ t('auth.sso.continueWithSso') }}
        </Button>

        <button
          type="button"
          :class="CLOUD_AUTH_LINK_BUTTON_CLASS"
          @click="openEmailForm"
        >
          {{ t('auth.login.useEmailInstead') }}
        </button>
      </template>

      <template v-else>
        <CloudSignInForm :auth-error="authError" @submit="signInWithEmail" />

        <button
          type="button"
          :class="CLOUD_AUTH_LINK_BUTTON_CLASS"
          @click="openSocialLogin"
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
import { RouterLink, useRoute, useRouter } from 'vue-router'

import Button from '@/components/ui/button/Button.vue'
import Message from '@/components/ui/message/Message.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useSsoPromptStore } from '@/platform/auth/sso/ssoPromptStore'
import CloudSignInForm from '@/platform/cloud/onboarding/components/CloudSignInForm.vue'
import CloudSocialAuthButtons from '@/platform/cloud/onboarding/components/CloudSocialAuthButtons.vue'
import CloudSsoSignIn from '@/platform/cloud/onboarding/components/CloudSsoSignIn.vue'
import { useCloudAuthPage } from '@/platform/cloud/onboarding/composables/useCloudAuthPage'
import { useSsoSignIn } from '@/platform/cloud/onboarding/composables/useSsoSignIn'
import { CLOUD_AUTH_LINK_BUTTON_CLASS } from '@/platform/cloud/onboarding/constants/authClasses'
import { ssoErrorMessageKey } from '@/platform/cloud/onboarding/sso/ssoErrorMessages'
import type { SignInData } from '@/schemas/signInSchema'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authActions = useAuthActions()
const ssoPromptStore = useSsoPromptStore()
const { ssoError, redirectIfSso } = useSsoSignIn()

const {
  authError,
  authMode,
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

const ssoPrompt = computed(() => ssoPromptStore.prompt)
const mode = computed(() => (ssoPrompt.value ? 'sso' : authMode.value))

const openEmailForm = () => {
  ssoPromptStore.dismiss()
  switchToEmailForm()
}
const openSocialLogin = () => {
  ssoPromptStore.dismiss()
  switchToSocialLogin()
}

const retrySso = async () => {
  const { sso_error: _dropped, ...query } = route.query
  await router.replace({ query })
  switchToSsoForm()
}

const signInWithEmail = async (values: SignInData) => {
  authError.value = ''
  if (await redirectIfSso(values.email)) return
  if (await authActions.signInWithEmail(values.email, values.password)) {
    await onAuthSuccess()
  }
}
</script>
