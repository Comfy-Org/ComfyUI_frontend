<script setup lang="ts">
import {
  AUTH_TOAST_SUMMARIES,
  severityForAuthError
} from '@comfyorg/account/firebaseAuthError'
import type { AuthErrorClassification } from '@comfyorg/account/firebaseAuthError'
import { onBeforeUnmount, ref, watch } from 'vue'

import SocialAuthButtons from '@comfyorg/account/SocialAuthButtons.vue'

import type {
  AuthSignInEvent,
  AuthSignInProvider,
  AuthSignInState
} from '../../config/auth-sign-in-state'
import {
  authSignInTransition,
  signInErrorMessage
} from '../../config/auth-sign-in-state'
import { addToast } from '../../config/auth-toast-state'
import { requestedReturnPath } from '../../config/workshop-return'
import type { WorkshopSessionUser } from '../../config/workshop-session-state'
import { useWorkshopSession } from '../../config/workshop-session-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useWorkshopAuthFlag } from '../../scripts/posthog'
import { AUTH_LINK_BUTTON_CLASS, AUTH_MESSAGE_ERROR_CLASS } from './authClasses'

const { mode = 'signIn', locale = 'en' } = defineProps<{
  /** Same flow either way for social providers; only the copy differs. */
  mode?: 'signIn' | 'signUp'
  locale?: Locale
}>()

const HOME = '/'

const enabled = useWorkshopAuthFlag()
const { user, session, ensureFresh } = useWorkshopSession()
const state = ref<AuthSignInState>({ step: 'idle' })
const hostname = typeof window === 'undefined' ? '' : window.location.hostname
const loadWorkshopFirebase = () => import('../../config/workshop-firebase')

function dispatch(event: AuthSignInEvent) {
  state.value = authSignInTransition(state.value, event)
}

/**
 * A signed-in visitor has no business on the sign-in page, same as the cloud
 * app's guard. `replace`, not `assign`: with the page left in history, Back
 * would land here again and be redirected straight back out.
 */
function leaveSignInPage(): void {
  window.location.replace(requestedReturnPath(window.location.search) ?? HOME)
}

function toastSignInFailure(classification: AuthErrorClassification) {
  const severity = severityForAuthError(classification)
  addToast({
    severity,
    summary: AUTH_TOAST_SUMMARIES[locale][severity],
    detail: signInErrorMessage(classification, locale, hostname)
  })
}

async function runMint(currentUser?: WorkshopSessionUser): Promise<void> {
  const result = currentUser
    ? await ensureFresh(currentUser)
    : await ensureFresh()
  if (state.value.step !== 'minting') return
  if (result?.status === 'ok') {
    dispatch({ type: 'mintSucceeded' })
    leaveSignInPage()
  } else {
    dispatch({ type: 'mintFailed' })
  }
}

async function signInWith(provider: AuthSignInProvider) {
  if (state.value.step === 'pending' || state.value.step === 'minting') return
  dispatch({ type: 'signInStarted', provider })
  let firebase: Awaited<ReturnType<typeof loadWorkshopFirebase>> | undefined
  try {
    firebase = await loadWorkshopFirebase()
    const credential =
      provider === 'google'
        ? await firebase.signInWorkshopWithGoogle()
        : await firebase.signInWorkshopWithGitHub()
    dispatch({
      type: 'popupSucceeded',
      email: credential.user.email ?? credential.user.displayName ?? ''
    })
    await runMint(credential.user)
  } catch (error) {
    if (firebase?.isWorkshopProvisioningError(error)) {
      dispatch({
        type: 'provisioningFailed',
        email: error.user.email ?? error.user.displayName ?? ''
      })
    } else {
      dispatch({ type: 'signInFailed', error })
      if (state.value.step === 'error') {
        toastSignInFailure(state.value.classification)
      }
    }
  }
}

async function retryMint(): Promise<void> {
  dispatch({ type: 'mintRetried' })
  await runMint()
}

const stopUserWatch = watch(
  user,
  (restored) => {
    if (!restored) {
      dispatch({ type: 'signedOut' })
      return
    }
    const before = state.value.step
    dispatch({
      type: 'userRestored',
      email: restored.email ?? restored.displayName ?? ''
    })
    if (before !== state.value.step && state.value.step === 'minting') {
      // No argument: `restored` is a readonly proxy, and the client already
      // holds the raw current user.
      void runMint()
    }
  },
  { immediate: true }
)
onBeforeUnmount(stopUserWatch)

// A focus refresh can mint successfully after a failed attempt; the banner
// and its Retry must not outlive the recovery.
const stopSessionWatch = watch(session, (active) => {
  if (active) dispatch({ type: 'mintSucceeded' })
})
onBeforeUnmount(stopSessionWatch)
</script>

<template>
  <section
    v-if="enabled"
    class="mx-auto w-full max-w-md rounded-2xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/4 p-8"
    :aria-busy="state.step === 'pending' || state.step === 'minting'"
  >
    <h1 class="text-2xl font-semibold text-primary-comfy-canvas">
      {{
        mode === 'signUp'
          ? t('auth.signUp.heading', locale)
          : t('auth.signIn.heading', locale)
      }}
    </h1>
    <p class="mt-3 text-sm text-primary-comfy-canvas/70">
      {{
        mode === 'signUp'
          ? t('auth.signUp.body', locale)
          : t('auth.signIn.body', locale)
      }}
    </p>

    <div class="mt-6 flex flex-col gap-3">
      <SocialAuthButtons
        :google-label="t('auth.signIn.google', locale)"
        :github-label="t('auth.signIn.github', locale)"
        button-class="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/5 text-sm font-semibold text-primary-comfy-canvas transition-colors hover:border-primary-comfy-yellow/60"
        @google="signInWith('google')"
        @github="signInWith('github')"
      />
    </div>

    <p
      v-if="state.step === 'pending' || state.step === 'minting'"
      aria-live="polite"
      class="mt-4 text-sm text-primary-comfy-canvas/55"
    >
      {{
        state.step === 'pending'
          ? t('auth.signIn.pending', locale)
          : t('auth.signIn.starting', locale)
      }}
    </p>

    <template v-if="state.step === 'signedIn' && state.messageKey">
      <div role="alert" :class="['mt-4', AUTH_MESSAGE_ERROR_CLASS]">
        {{ t(state.messageKey, locale) }}
      </div>
      <button
        v-if="state.messageKey === 'auth.signIn.error.session'"
        type="button"
        :class="['flex', AUTH_LINK_BUTTON_CLASS]"
        @click="retryMint"
      >
        {{ t('auth.signIn.retry', locale) }}
      </button>
    </template>

    <p class="mt-6 text-center text-sm text-primary-comfy-canvas/55">
      <template v-if="mode === 'signUp'">
        {{ t('auth.signUp.haveAccount', locale) }}
        <a href="/login/" class="text-primary-comfy-yellow hover:underline">
          {{ t('auth.signUp.signInLink', locale) }}
        </a>
      </template>
      <template v-else>
        {{ t('auth.signIn.newHere', locale) }}
        <a href="/signup/" class="text-primary-comfy-yellow hover:underline">
          {{ t('auth.signIn.signUpLink', locale) }}
        </a>
      </template>
    </p>
  </section>
</template>
