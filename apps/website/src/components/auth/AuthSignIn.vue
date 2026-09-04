<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import SocialAuthButtons from '@comfyorg/auth-core/SocialAuthButtons.vue'

import type {
  AuthSignInEvent,
  AuthSignInProvider,
  AuthSignInState
} from '../../config/auth-sign-in-state'
import { authSignInTransition } from '../../config/auth-sign-in-state'
import {
  signInWorkshopWithEmail,
  signInWorkshopWithGitHub,
  signInWorkshopWithGoogle,
  signUpWorkshopWithEmail,
  warmWorkshopAuth
} from '../../config/workshop-firebase'
import AuthEmailForm from './AuthEmailForm.vue'
import { safeReturnPath } from '../../config/workshop-return'
import { useWorkshopSession } from '../../config/workshop-session-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useWorkshopAuthFlag } from '../../scripts/posthog'

const { mode = 'signIn', locale = 'en' } = defineProps<{
  /** Same flow either way for social providers; only the copy differs. */
  mode?: 'signIn' | 'signUp'
  locale?: Locale
}>()

const enabled = useWorkshopAuthFlag()
const { user, ensureFresh, signOut } = useWorkshopSession()
const state = ref<AuthSignInState>({ step: 'idle' })

function dispatch(event: AuthSignInEvent) {
  state.value = authSignInTransition(state.value, event)
}

/**
 * The whole page exists to send the visitor back where they came from; a
 * missing or unsafe returnTo lands on the Workshop home.
 */
function navigateBack() {
  window.location.assign(
    safeReturnPath(new URLSearchParams(window.location.search).get('returnTo'))
  )
}

async function runMint() {
  const result = await ensureFresh()
  if (state.value.step !== 'minting') return
  if (result?.status === 'ok') {
    dispatch({ type: 'mintSucceeded' })
    navigateBack()
  } else {
    dispatch({ type: 'mintFailed' })
  }
}

async function completeSignIn(
  provider: AuthSignInProvider,
  authenticate: () => Promise<{
    user: { email: string | null; displayName: string | null }
  }>
) {
  if (state.value.step === 'pending' || state.value.step === 'minting') return
  dispatch({ type: 'signInStarted', provider })
  try {
    const credential = await authenticate()
    dispatch({
      type: 'credentialSucceeded',
      email: credential.user.email ?? credential.user.displayName ?? ''
    })
    await runMint()
  } catch (error) {
    dispatch({ type: 'signInFailed', error })
  }
}

function signInWith(provider: 'google' | 'github') {
  return completeSignIn(provider, () =>
    provider === 'google'
      ? signInWorkshopWithGoogle()
      : signInWorkshopWithGitHub()
  )
}

function submitEmail(credentials: {
  email: string
  password: string
  turnstileToken?: string
}) {
  return completeSignIn('email', () =>
    mode === 'signUp'
      ? signUpWorkshopWithEmail(
          credentials.email,
          credentials.password,
          credentials.turnstileToken
        )
      : signInWorkshopWithEmail(credentials.email, credentials.password)
  )
}

async function retryMint() {
  dispatch({ type: 'mintRetried' })
  await runMint()
}

/**
 * Sign-out only transitions on success: a failed sign-out leaves the user
 * signed in, and the session listener drives the state when it clears.
 */
async function signOutHere() {
  try {
    await signOut()
  } catch (error) {
    console.error('Workshop sign-out failed', error)
    return
  }
  dispatch({ type: 'signedOut' })
}

// The session state module owns the Firebase listener; this watch turns a
// restored user into this page's minting step.
function watchUser() {
  return watch(
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
        void runMint()
      }
    },
    { immediate: true }
  )
}

let stopUserWatch: (() => void) | undefined
onMounted(() => {
  void warmWorkshopAuth()
  stopUserWatch = watchUser()
})
onBeforeUnmount(() => stopUserWatch?.())
</script>

<template>
  <section
    v-if="enabled"
    class="mx-auto w-full max-w-md rounded-2xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/4 p-8"
    :aria-busy="state.step === 'pending' || state.step === 'minting'"
  >
    <template v-if="state.step === 'signedIn'">
      <h1 class="text-2xl font-semibold text-primary-comfy-canvas">
        {{ t('auth.signIn.signedInHeading', locale) }}
      </h1>
      <p class="mt-3 text-sm break-all text-primary-comfy-canvas/70">
        {{ t('auth.signIn.signedInAs', locale) }} {{ state.email }}
      </p>
      <a
        href="/workshop/"
        class="hover:bg-primary-comfy-yellow/90 bg-primary-comfy-yellow mt-6 flex h-12 w-full items-center justify-center rounded-xl font-semibold text-primary-comfy-ink transition-colors"
      >
        {{ t('auth.signIn.backToWorkshop', locale) }}
      </a>
    </template>

    <template v-else-if="state.step === 'sessionError'">
      <h1 class="text-2xl font-semibold text-primary-comfy-canvas">
        {{ t('auth.signIn.heading', locale) }}
      </h1>
      <p
        role="alert"
        class="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-primary-comfy-canvas"
      >
        {{ t('auth.signIn.error.session', locale) }}
      </p>
      <button
        type="button"
        class="hover:bg-primary-comfy-yellow/90 bg-primary-comfy-yellow mt-4 flex h-12 w-full items-center justify-center rounded-xl font-semibold text-primary-comfy-ink transition-colors"
        @click="retryMint"
      >
        {{ t('auth.signIn.retry', locale) }}
      </button>
      <button
        type="button"
        class="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-primary-comfy-canvas/25 text-sm text-primary-comfy-canvas transition-colors hover:border-primary-comfy-canvas/40"
        @click="signOutHere"
      >
        {{ t('auth.signIn.signOut', locale) }}
      </button>
    </template>

    <template v-else>
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
          :disabled="state.step === 'pending' || state.step === 'minting'"
          button-class="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/5 text-sm font-semibold text-primary-comfy-canvas transition-colors hover:border-primary-comfy-yellow/60 disabled:cursor-not-allowed disabled:opacity-40"
          @google="signInWith('google')"
          @github="signInWith('github')"
        />
      </div>

      <div
        class="my-6 flex items-center gap-3 text-xs text-primary-comfy-canvas/45 uppercase"
        aria-hidden="true"
      >
        <span class="h-px flex-1 bg-primary-comfy-canvas/15"></span>
        {{ t('auth.signIn.or', locale) }}
        <span class="h-px flex-1 bg-primary-comfy-canvas/15"></span>
      </div>

      <AuthEmailForm
        :mode="mode"
        :locale="locale"
        :disabled="state.step === 'pending' || state.step === 'minting'"
        @submit="submitEmail"
      />

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

      <p
        v-if="state.step === 'error'"
        role="alert"
        class="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-primary-comfy-canvas"
      >
        {{ t(state.messageKey, locale) }}
      </p>

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
    </template>
  </section>
</template>
