<script setup lang="ts">
import {
  AUTH_TOAST_SUMMARIES,
  isFirebaseAuthErrorLike,
  severityForAuthError
} from '@comfyorg/account/firebaseAuthError'
import type { AuthErrorClassification } from '@comfyorg/account/firebaseAuthError'
import { until } from '@vueuse/core'
import type { UserCredential } from 'firebase/auth'
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'

import { useRegionGate } from '@comfyorg/account/regionGate'
import type { RegionGateStatus } from '@comfyorg/account/regionGate'
import SocialAuthButtons from '@comfyorg/account/SocialAuthButtons.vue'
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
import AuthEmailForm from './AuthEmailForm.vue'
import AuthFlagTimeout from './AuthFlagTimeout.vue'
import {
  AUTH_BRAND_GHOST_BUTTON_CLASS,
  AUTH_LINK_BUTTON_CLASS,
  AUTH_MESSAGE_ERROR_CLASS,
  AUTH_MESSAGE_WARN_CLASS
} from './authClasses'

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
const showEmailForm = ref(false)
const isSecureContext = ref(true)
// Sign-up only: the cloud app gates email registration on the region and
// never decides before detection answers; the login page never probes.
const { status: regionStatus } =
  mode === 'signUp'
    ? useRegionGate()
    : { status: ref<RegionGateStatus>('allowed') }
// Decided after mount: the server has no user agent, and a mismatch here
// would break hydration.
const inAppBrowser = ref(false)
const hostname = typeof window === 'undefined' ? '' : window.location.hostname
const loadWorkshopFirebase = () => import('../../config/workshop-firebase')
type WorkshopFirebase = Awaited<ReturnType<typeof loadWorkshopFirebase>>
const emailForm =
  useTemplateRef<InstanceType<typeof AuthEmailForm>>('emailForm')

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

/**
 * The return destination is only known in the browser, and hydration never
 * repairs a server-rendered href, so the links stay plain in markup and the
 * destination is carried over when the visitor actually clicks. Modified
 * clicks keep their native open-in-new-tab behaviour.
 */
function goTo(path: string, event: MouseEvent): void {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
    return
  event.preventDefault()
  const destination = requestedReturnPath(window.location.search)
  window.location.assign(
    destination ? `${path}?returnTo=${encodeURIComponent(destination)}` : path
  )
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
    leaving.value = false
    dispatch({ type: 'mintFailed' })
  }
}

async function completeSignIn(
  provider: AuthSignInProvider,
  authenticate: (firebase: WorkshopFirebase) => Promise<UserCredential>
) {
  if (state.value.step === 'pending' || state.value.step === 'minting') return
  dispatch({ type: 'signInStarted', provider })
  let firebase: Awaited<ReturnType<typeof loadWorkshopFirebase>> | undefined
  try {
    firebase = await loadWorkshopFirebase()
    const credential = await authenticate(firebase)
    captureAuthCompleted({
      method: provider,
      is_new_user:
        mode === 'signUp' ||
        (provider !== 'email' && firebase.isNewWorkshopUser(credential)),
      user_id: credential.user.uid,
      email: credential.user.email ?? undefined
    })
    dispatch({
      type: 'credentialSucceeded',
      email: credential.user.email ?? credential.user.displayName ?? ''
    })
    await runMint(credential.user)
  } catch (error) {
    captureAuthFailed({
      error_code: isFirebaseAuthErrorLike(error) ? error.code : 'unknown',
      auth_action: `${provider}_${mode === 'signUp' ? 'sign_up' : 'sign_in'}`
    })
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
      if (state.value.step === 'error') {
        toastSignInFailure(state.value.classification)
      }
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
  isSecureContext.value = window.isSecureContext !== false
  inAppBrowser.value = isEmbeddedWebView()
  // Cloud reports the open when its sign-up page renders; here that is the
  // moment the flag lets the page show.
  if (mode === 'signUp')
    void until(enabled).toBe(true).then(captureSignupOpened)
  initTimer = setTimeout(() => {
    authTimedOut.value =
      !flagSettled.value || (enabled.value && !identitySettled.value)
  }, AUTH_INIT_TIMEOUT_MS)
})
</script>

<template>
  <section
    v-if="enabled && identitySettled && !leaving"
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
          class="text-brand-yellow no-underline transition-all duration-300 hover:underline"
          @click="goTo('/login/', $event)"
        >
          {{ t('auth.signUp.signInLink', locale) }}
        </a>
      </template>
      <template v-else>
        {{ t('auth.signIn.newHere', locale) }}
        <a
          href="/signup/"
          class="text-brand-yellow no-underline transition-all duration-300 hover:underline"
          @click="goTo('/signup/', $event)"
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
          @click="showEmailForm = true"
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
          @click="showEmailForm = false"
        >
          {{ t('auth.signIn.backToSocialLogin', locale) }}
        </button>
      </template>

      <p
        v-if="state.step === 'pending' || state.step === 'minting'"
        aria-live="polite"
        class="sr-only"
      >
        {{
          state.step === 'pending'
            ? t(
                state.provider === 'email'
                  ? 'auth.signIn.pendingEmail'
                  : 'auth.signIn.pending',
                locale
              )
            : t('auth.signIn.starting', locale)
        }}
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
