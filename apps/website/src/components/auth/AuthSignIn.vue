<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'

import SocialAuthButtons from '@comfyorg/auth-core/SocialAuthButtons.vue'

import type {
  AuthSignInEvent,
  AuthSignInProvider,
  AuthSignInState
} from '../../config/auth-sign-in-state'
import { authSignInTransition } from '../../config/auth-sign-in-state'
import { requestedReturnPath } from '../../config/workshop-return'
import type { WorkshopSessionUser } from '../../config/workshop-session'
import { useWorkshopSession } from '../../config/workshop-session-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useWorkshopAuthFlag } from '../../scripts/posthog'
import AuthEmailForm from './AuthEmailForm.vue'

const { mode = 'signIn', locale = 'en' } = defineProps<{
  /** Same flow either way for social providers; only the copy differs. */
  mode?: 'signIn' | 'signUp'
  locale?: Locale
}>()

const enabled = useWorkshopAuthFlag()
const {
  user,
  ensureFresh,
  signOut: signOutWorkshopSession
} = useWorkshopSession()
const state = ref<AuthSignInState>({ step: 'idle' })
const loadWorkshopFirebase = () => import('../../config/workshop-firebase')
type WorkshopFirebase = Awaited<ReturnType<typeof loadWorkshopFirebase>>
type AuthenticatedUser = WorkshopSessionUser & {
  readonly email: string | null
  readonly displayName: string | null
}
const emailForm =
  useTemplateRef<InstanceType<typeof AuthEmailForm>>('emailForm')
const forgotPasswordHref = ref('/forgot-password/')
const signInHref = ref('/login/')
const signUpHref = ref('/signup/')

function dispatch(event: AuthSignInEvent) {
  state.value = authSignInTransition(state.value, event)
}

function navigateBackIfRequested(): void {
  const destination = requestedReturnPath(window.location.search)
  if (!destination) return
  window.location.assign(destination)
}

async function runMint(currentUser?: WorkshopSessionUser): Promise<void> {
  const result = await ensureFresh(currentUser)
  if (state.value.step !== 'minting') return
  if (result?.status === 'ok') {
    dispatch({ type: 'mintSucceeded' })
    navigateBackIfRequested()
  } else {
    dispatch({ type: 'mintFailed' })
  }
}

async function completeSignIn(
  provider: AuthSignInProvider,
  authenticate: (
    firebase: WorkshopFirebase
  ) => Promise<{ user: AuthenticatedUser }>
) {
  if (state.value.step === 'pending' || state.value.step === 'minting') return
  dispatch({ type: 'signInStarted', provider })
  let firebase: Awaited<ReturnType<typeof loadWorkshopFirebase>> | undefined
  try {
    firebase = await loadWorkshopFirebase()
    const credential = await authenticate(firebase)
    dispatch({
      type: 'credentialSucceeded',
      email: credential.user.email ?? credential.user.displayName ?? ''
    })
    await runMint(credential.user)
  } catch (error) {
    if (provider === 'email' && mode === 'signUp') {
      // Turnstile tokens are single-use. Any failed attempt consumes this
      // token, so require a fresh challenge before another submission.
      emailForm.value?.resetTurnstile()
    }
    if (firebase?.isWorkshopProvisioningError(error)) {
      dispatch({
        type: 'provisioningFailed',
        email: error.user.email ?? error.user.displayName ?? ''
      })
    } else {
      dispatch({ type: 'signInFailed', error })
    }
  }
}

function signInWith(provider: 'google' | 'github') {
  return completeSignIn(provider, (firebase) =>
    provider === 'google'
      ? firebase.signInWorkshopWithGoogle()
      : firebase.signInWorkshopWithGitHub()
  )
}

function submitEmail(credentials: {
  email: string
  password: string
  turnstileToken?: string
}) {
  return completeSignIn('email', (firebase) =>
    mode === 'signUp'
      ? firebase.signUpWorkshopWithEmail(
          credentials.email,
          credentials.password,
          credentials.turnstileToken
        )
      : firebase.signInWorkshopWithEmail(
          credentials.email,
          credentials.password
        )
  )
}

async function retryMint(): Promise<void> {
  dispatch({ type: 'mintRetried' })
  await runMint()
}

async function signOut() {
  // A failed sign-out leaves the user signed in; the auth-state listener
  // drives the transition when it actually clears. Routing it to a sign-in
  // error would strand a signed-in user on an error screen.
  try {
    await signOutWorkshopSession()
  } catch (error) {
    console.error('Workshop sign-out failed', error)
  }
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
      void runMint(restored)
    }
  },
  { immediate: true }
)
onBeforeUnmount(stopUserWatch)

onMounted(() => {
  const destination = requestedReturnPath(window.location.search)
  if (!destination) return
  const query = `?returnTo=${encodeURIComponent(destination)}`
  forgotPasswordHref.value = `/forgot-password/${query}`
  signInHref.value = `/login/${query}`
  signUpHref.value = `/signup/${query}`
})
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
      <p
        v-if="state.messageKey"
        role="alert"
        class="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-primary-comfy-canvas"
      >
        {{ t(state.messageKey, locale) }}
      </p>
      <button
        v-if="state.messageKey === 'auth.signIn.error.session'"
        type="button"
        class="hover:bg-primary-comfy-yellow/90 bg-primary-comfy-yellow mt-4 flex h-12 w-full items-center justify-center rounded-xl font-semibold text-primary-comfy-ink transition-colors"
        @click="retryMint"
      >
        {{ t('auth.signIn.retry', locale) }}
      </button>
      <a
        href="/workshop/"
        class="hover:bg-primary-comfy-yellow/90 bg-primary-comfy-yellow mt-6 flex h-12 w-full items-center justify-center rounded-xl font-semibold text-primary-comfy-ink transition-colors"
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
        ref="emailForm"
        :mode="mode"
        :locale="locale"
        :disabled="state.step === 'pending' || state.step === 'minting'"
        :forgot-password-href="forgotPasswordHref"
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
          <a
            :href="signInHref"
            class="text-primary-comfy-yellow hover:underline"
          >
            {{ t('auth.signUp.signInLink', locale) }}
          </a>
        </template>
        <template v-else>
          {{ t('auth.signIn.newHere', locale) }}
          <a
            :href="signUpHref"
            class="text-primary-comfy-yellow hover:underline"
          >
            {{ t('auth.signIn.signUpLink', locale) }}
          </a>
        </template>
      </p>
    </template>
  </section>
</template>
