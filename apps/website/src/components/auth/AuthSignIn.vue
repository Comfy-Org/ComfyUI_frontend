<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import SocialAuthButtons from '@comfyorg/auth-core/SocialAuthButtons.vue'

import type {
  AuthSignInEvent,
  AuthSignInProvider,
  AuthSignInState
} from '../../config/auth-sign-in-state'
import { authSignInTransition } from '../../config/auth-sign-in-state'
import {
  onWorkshopUserChanged,
  signInWorkshopWithGitHub,
  signInWorkshopWithGoogle,
  signOutWorkshop
} from '../../config/workshop-firebase'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useWorkshopAuthFlag } from '../../scripts/posthog'

const { mode = 'signIn', locale = 'en' } = defineProps<{
  /** Same flow either way for social providers; only the copy differs. */
  mode?: 'signIn' | 'signUp'
  locale?: Locale
}>()

const enabled = useWorkshopAuthFlag()
const state = ref<AuthSignInState>({ step: 'idle' })

function dispatch(event: AuthSignInEvent) {
  state.value = authSignInTransition(state.value, event)
}

async function signInWith(provider: AuthSignInProvider) {
  if (state.value.step === 'pending') return
  dispatch({ type: 'signInStarted', provider })
  try {
    const credential =
      provider === 'google'
        ? await signInWorkshopWithGoogle()
        : await signInWorkshopWithGitHub()
    dispatch({
      type: 'signInSucceeded',
      email: credential.user.email ?? credential.user.displayName ?? ''
    })
  } catch (error) {
    dispatch({ type: 'signInFailed', error })
  }
}

async function signOut() {
  try {
    await signOutWorkshop()
  } catch (error) {
    dispatch({ type: 'signInFailed', error })
  }
}

let stopUserListener: (() => void) | undefined
onMounted(() => {
  stopUserListener = onWorkshopUserChanged((user) => {
    dispatch(
      user
        ? {
            type: 'userRestored',
            email: user.email ?? user.displayName ?? ''
          }
        : { type: 'signedOut' }
    )
  })
})
onBeforeUnmount(() => stopUserListener?.())
</script>

<template>
  <section
    v-if="enabled"
    class="mx-auto w-full max-w-md rounded-2xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/4 p-8"
    :aria-busy="state.step === 'pending'"
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
        class="hover:bg-primary-comfy-yellow/90 mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-primary-comfy-yellow font-semibold text-primary-comfy-ink transition-colors"
      >
        {{ t('auth.signIn.backToWorkshop', locale) }}
      </a>
      <button
        type="button"
        class="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-primary-comfy-canvas/25 text-sm text-primary-comfy-canvas transition-colors hover:border-primary-comfy-canvas/40"
        @click="signOut"
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
          :disabled="state.step === 'pending'"
          button-class="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/5 text-sm font-semibold text-primary-comfy-canvas transition-colors hover:border-primary-comfy-yellow/60 disabled:cursor-not-allowed disabled:opacity-40"
          @google="signInWith('google')"
          @github="signInWith('github')"
        />
      </div>

      <p
        v-if="state.step === 'pending'"
        aria-live="polite"
        class="mt-4 text-sm text-primary-comfy-canvas/55"
      >
        {{ t('auth.signIn.pending', locale) }}
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
