<script setup lang="ts">
import { useTemplateRef } from 'vue'

import { SocialAuthButtons } from '@comfyorg/account/vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import AuthEmailForm from './AuthEmailForm.vue'
import AuthFlagTimeout from './AuthFlagTimeout.vue'
import AuthSpinnerIcon from './AuthSpinnerIcon.vue'
import {
  AUTH_BRAND_GHOST_BUTTON_CLASS,
  AUTH_LINK_BUTTON_CLASS,
  AUTH_MESSAGE_ERROR_CLASS,
  AUTH_MESSAGE_WARN_CLASS
} from './authClasses'
import { useAuthSignInController } from './useAuthSignInController'

export type AuthMode = 'signIn' | 'signUp'

const { mode = 'signIn', locale = 'en' } = defineProps<{
  /** Same flow either way for social providers; only the copy differs. */
  mode?: AuthMode
  locale?: Locale
}>()

const emit = defineEmits<{ switchMode: [mode: AuthMode] }>()

const emailForm =
  useTemplateRef<InstanceType<typeof AuthEmailForm>>('emailForm')

const {
  state,
  enabled,
  formVisible,
  authTimedOut,
  busy,
  progressKey,
  regionStatus,
  isSecureContext,
  inAppBrowser,
  showEmailForm,
  showEmail,
  hideEmail,
  goTo,
  switchMode,
  signInWith,
  submitEmail,
  retryMint
} = useAuthSignInController({
  mode,
  locale,
  resetTurnstile: () => emailForm.value?.resetTurnstile(),
  onSwitchMode: (next) => emit('switchMode', next)
})
</script>

<template>
  <section
    v-if="formVisible"
    class="flex w-full flex-col"
    :aria-busy="state.step === 'pending' || state.step === 'minting'"
  >
    <h1
      class="mt-8 mb-0 text-2xl/snug font-light tracking-tighter text-primary-comfy-canvas sm:text-3xl/snug lg:text-4xl/snug xl:text-5xl/snug 2xl:text-6xl/snug"
    >
      {{
        mode === 'signUp'
          ? t('auth.signUp.heading', locale)
          : t('auth.signIn.heading', locale)
      }}
    </h1>

    <p
      class="mt-8 mb-0 text-base/snug font-medium text-primary-comfy-canvas xl:text-lg/snug"
    >
      <template v-if="mode === 'signUp'">
        {{ t('auth.signUp.haveAccount', locale) }}
        <a
          href="/login/"
          :class="
            cn(
              'text-brand-yellow no-underline transition-all duration-300 hover:underline',
              busy && 'pointer-events-none opacity-50'
            )
          "
          :aria-disabled="busy || undefined"
          @click="switchMode('signIn', $event)"
        >
          {{ t('auth.signUp.signInLink', locale) }}
        </a>
      </template>
      <template v-else>
        {{ t('auth.signIn.newHere', locale) }}
        <a
          href="/signup/"
          :class="
            cn(
              'text-brand-yellow no-underline transition-all duration-300 hover:underline',
              busy && 'pointer-events-none opacity-50'
            )
          "
          :aria-disabled="busy || undefined"
          @click="switchMode('signUp', $event)"
        >
          {{ t('auth.signIn.signUpLink', locale) }}
        </a>
        <span>{{ ' ' + t('auth.signIn.freeRunsSuffix', locale) }}</span>
      </template>
    </p>

    <div
      v-if="!isSecureContext"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      :class="cn('mt-4 w-full', AUTH_MESSAGE_WARN_CLASS)"
    >
      {{ t('auth.signIn.insecureContextWarning', locale) }}
    </div>

    <div class="mt-12 flex flex-col gap-4 xl:gap-6">
      <template v-if="!showEmailForm">
        <SocialAuthButtons
          :google-label="
            t(
              mode === 'signUp' ? 'auth.signUp.google' : 'auth.signIn.google',
              locale
            )
          "
          :github-label="
            t(
              mode === 'signUp' ? 'auth.signUp.github' : 'auth.signIn.github',
              locale
            )
          "
          :button-class="`${AUTH_BRAND_GHOST_BUTTON_CLASS} w-full gap-3`"
          label-class="relative top-[0.15em] inline-block"
          :disabled="busy"
          @google="signInWith('google')"
          @github="signInWith('github')"
        />
        <p
          v-if="inAppBrowser"
          class="my-0 text-xs/5 text-primary-comfy-canvas/60"
          data-testid="google-sso-in-app-browser-notice"
        >
          {{ t('auth.signIn.googleSsoInAppBrowserNotice', locale) }}
        </p>

        <button
          type="button"
          :class="AUTH_LINK_BUTTON_CLASS"
          :disabled="busy"
          @click="showEmail()"
        >
          {{ t('auth.signIn.useEmailInstead', locale) }}
        </button>
      </template>

      <template v-else>
        <div
          v-if="mode === 'signUp' && regionStatus === 'pending'"
          data-testid="region-check-pending"
          aria-busy="true"
          class="flex flex-col gap-6"
        >
          <div
            v-for="n in 3"
            :key="n"
            class="h-10 w-full animate-pulse rounded-md bg-primary-comfy-canvas/10"
          />
        </div>
        <div
          v-else-if="mode === 'signUp' && regionStatus === 'blocked'"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          :class="cn('w-full', AUTH_MESSAGE_WARN_CLASS)"
        >
          {{ t('auth.signUp.regionRestrictionChina', locale) }}
        </div>
        <AuthEmailForm
          v-else
          ref="emailForm"
          :mode="mode"
          :locale="locale"
          :loading="state.step === 'pending' || state.step === 'minting'"
          @forgot-password="goTo('/forgot-password/', $event)"
          @submit="submitEmail"
        />

        <button
          type="button"
          :class="AUTH_LINK_BUTTON_CLASS"
          :disabled="busy"
          @click="hideEmail()"
        >
          {{
            t(
              mode === 'signUp'
                ? 'auth.signIn.backToSocialLogin'
                : 'auth.signIn.backToSocialSignIn',
              locale
            )
          }}
        </button>
      </template>

      <p
        v-if="busy"
        aria-live="polite"
        class="my-0 flex items-center gap-2 text-sm text-primary-comfy-canvas/70"
      >
        <AuthSpinnerIcon />
        <span>{{ t(progressKey, locale) }}</span>
      </p>

      <template v-if="state.step === 'signedIn' && state.messageKey">
        <div
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          :class="AUTH_MESSAGE_ERROR_CLASS"
        >
          {{ t(state.messageKey, locale) }}
        </div>
        <button
          v-if="state.messageKey === 'auth.signIn.error.session'"
          type="button"
          :class="AUTH_LINK_BUTTON_CLASS"
          @click="retryMint"
        >
          {{ t('auth.signIn.retry', locale) }}
        </button>
      </template>
    </div>
  </section>
  <AuthFlagTimeout v-else-if="authTimedOut" :locale="locale" />
  <div
    v-else-if="enabled"
    data-testid="auth-initializing"
    aria-busy="true"
    class="mt-12 flex w-full flex-col gap-6"
  >
    <div
      v-for="n in 3"
      :key="n"
      class="h-10 w-full animate-pulse rounded-md bg-primary-comfy-canvas/10"
    />
  </div>
</template>
