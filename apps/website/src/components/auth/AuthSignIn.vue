<script setup lang="ts">
import { until } from '@vueuse/core'
import {
  AUTH_TOAST_SUMMARIES,
  isFirebaseAuthErrorLike,
  severityForAuthError
} from '@comfyorg/account/firebaseAuthError'
import type { AuthErrorClassification } from '@comfyorg/account/firebaseAuthError'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { SocialAuthButtons } from '@comfyorg/account/vue'
import { cn } from '@comfyorg/tailwind-utils'
import { isEmbeddedWebView } from '@comfyorg/account/webviewDetection'

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
import {
  isSwitchingAccount,
  requestedReturnPath
} from '../../config/workshop-return'
import type { WorkshopSessionUser } from '../../config/workshop-session-state'
import { useWorkshopSession } from '../../config/workshop-session-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import {
  captureAuthCompleted,
  captureAuthFailed,
  captureSignupOpened,
  useWorkshopAuthFlag,
  useWorkshopAuthFlagSettled
} from '../../scripts/posthog'
import { AUTH_LINK_BUTTON_CLASS, AUTH_MESSAGE_ERROR_CLASS } from './authClasses'
import AuthFlagTimeout from './AuthFlagTimeout.vue'

const { mode = 'signIn', locale = 'en' } = defineProps<{
  /** Same flow either way for social providers; only the copy differs. */
  mode?: 'signIn' | 'signUp'
  locale?: Locale
}>()

const HOME = '/'
/** The cloud app's router gives auth this long to initialize before its timeout view. */
const AUTH_INIT_TIMEOUT_MS = 16_000

const enabled = useWorkshopAuthFlag()
const flagSettled = useWorkshopAuthFlagSettled()
const authTimedOut = ref(false)
const {
  user,
  session,
  settled: identitySettled,
  ensureFresh
} = useWorkshopSession()
// A returning signed-in visitor leaves without ever seeing the form, as on
// cloud where the router holds the route until auth has initialized.
const leaving = ref(false)
const state = ref<AuthSignInState>({ step: 'idle' })
const hostname = typeof window === 'undefined' ? '' : window.location.hostname
const loadWorkshopFirebase = () => import('../../config/workshop-firebase')
// Decided after mount: the server has no user agent, and a mismatch here
// would break hydration.
const inAppBrowser = ref(false)

function dispatch(event: AuthSignInEvent) {
  const before = state.value
  state.value = authSignInTransition(before, event)
  // The session client publishes the credential before the mint promise
  // resolves, so the transition, not the caller, is what leaves the page.
  if (
    before.step === 'minting' &&
    state.value.step === 'signedIn' &&
    !state.value.messageKey
  ) {
    leaveSignInPage()
  }
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
  } else {
    leaving.value = false
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
    captureAuthCompleted({
      method: provider,
      is_new_user: mode === 'signUp' || firebase.isNewWorkshopUser(credential),
      user_id: credential.user.uid,
      email: credential.user.email ?? undefined
    })
    dispatch({
      type: 'popupSucceeded',
      email: credential.user.email ?? credential.user.displayName ?? ''
    })
    await runMint(credential.user)
  } catch (error) {
    captureAuthFailed({
      error_code: isFirebaseAuthErrorLike(error) ? error.code : 'unknown',
      auth_action: `${provider}_${mode === 'signUp' ? 'sign_up' : 'sign_in'}`
    })
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
    if (isSwitchingAccount(window.location.search)) return
    const before = state.value.step
    dispatch({
      type: 'userRestored',
      email: restored.email ?? restored.displayName ?? ''
    })
    if (before !== state.value.step && state.value.step === 'minting') {
      leaving.value = true
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

let initTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(initTimer))

onMounted(() => {
  inAppBrowser.value = isEmbeddedWebView()
  // Cloud reports the open when its sign-up page renders; here that is the
  // moment the flag lets the page show.
  if (mode === 'signUp')
    void until(enabled).toBe(true).then(captureSignupOpened)
  initTimer = setTimeout(() => {
    authTimedOut.value = initPending.value
  }, AUTH_INIT_TIMEOUT_MS)
})

/** Still waiting on PostHog, or on Firebase once the flag is on. */
const initPending = computed(
  () => !flagSettled.value || (enabled.value && !identitySettled.value)
)
// A late answer, whichever way it goes, ends the timeout screen.
watch(initPending, (pending) => {
  if (!pending) authTimedOut.value = false
})
</script>

<template>
  <section
    v-if="enabled && identitySettled && !leaving"
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
      <p
        v-if="inAppBrowser"
        class="my-0 text-xs/5 text-primary-comfy-canvas/60"
        data-testid="google-sso-in-app-browser-notice"
      >
        {{ t('auth.signIn.googleSsoInAppBrowserNotice', locale) }}
      </p>
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
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        :class="cn('mt-4', AUTH_MESSAGE_ERROR_CLASS)"
      >
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
  <AuthFlagTimeout v-else-if="authTimedOut" :locale="locale" />
  <div
    v-else-if="enabled"
    data-testid="auth-initializing"
    aria-busy="true"
    class="mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-primary-comfy-canvas/15 bg-primary-comfy-canvas/4 p-8"
  >
    <div
      v-for="n in 3"
      :key="n"
      class="h-10 w-full animate-pulse rounded-md bg-primary-comfy-canvas/10"
    />
  </div>
</template>
