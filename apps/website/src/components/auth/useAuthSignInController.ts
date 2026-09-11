/**
 * The whole sign-in flow in one owner: the reducer for the mint phases plus
 * the flag/identity/timeout/secure-context/region state that used to live as
 * loose refs and watchers beside it. The panel component reads the returned
 * state and calls the returned commands; it holds no flow logic of its own.
 */
import {
  AUTH_TOAST_SUMMARIES,
  isFirebaseAuthErrorLike,
  severityForAuthError
} from '@comfyorg/account/firebaseAuthError'
import type { AuthErrorClassification } from '@comfyorg/account/firebaseAuthError'
import { until } from '@vueuse/core'
import type { UserCredential } from 'firebase/auth'
import { computed, onBeforeUnmount, onMounted, readonly, ref, watch } from 'vue'

import type { RegionGateStatus } from '@comfyorg/account/vue'
import { useRegionGate } from '@comfyorg/account/vue'
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
import {
  captureAuthCompleted,
  captureAuthFailed,
  captureSignupOpened,
  useWorkshopAuthFlag,
  useWorkshopAuthFlagSettled
} from '../../scripts/posthog'
import type { AuthMode } from './AuthSignInPanel.vue'

const HOME = '/'
/** The cloud app's router gives auth this long to initialize before its timeout view. */
const AUTH_INIT_TIMEOUT_MS = 16_000

/** Absent in some runtimes and in tests, where only an explicit false is insecure. */
function currentSecureContext(): boolean | undefined {
  return window.isSecureContext
}

interface AuthSignInControllerOptions {
  mode: AuthMode
  locale: Locale
  /** Bound to the email form's template ref by the panel. */
  resetTurnstile: () => void
  /** Emitted by the panel to its shell so the mode swaps in place. */
  onSwitchMode: (mode: AuthMode) => void
}

export function useAuthSignInController(options: AuthSignInControllerOptions) {
  const { mode, locale, resetTurnstile, onSwitchMode } = options

  const loadWorkshopFirebase = () => import('../../config/workshop-firebase')
  type WorkshopFirebase = Awaited<ReturnType<typeof loadWorkshopFirebase>>

  const enabled = useWorkshopAuthFlag()
  const flagSettled = useWorkshopAuthFlagSettled()
  const authTimedOut = ref(false)
  const {
    user,
    session,
    settled: identitySettled,
    ensureFresh
  } = useWorkshopSession()
  const state = ref<AuthSignInState>({ step: 'idle' })
  // A returning signed-in visitor leaves without ever seeing the form, as on
  // cloud where the router holds the route until auth has initialized: the
  // restored-origin mint stays hidden through its successful sign-in.
  const leaving = computed(() => {
    const current = state.value
    if (current.step === 'minting') return current.origin === 'restored'
    if (current.step === 'signedIn')
      return current.origin === 'restored' && !current.messageKey
    return false
  })
  const showEmailForm = ref(false)
  const isSecureContext = ref(true)
  // Cloud's signup view mounts behind its router, so it probes only when the
  // form can show; the login page never probes.
  const formVisible = computed(
    () => enabled.value && identitySettled.value && !leaving.value
  )
  const { status: regionStatus } =
    mode === 'signUp'
      ? useRegionGate(formVisible)
      : { status: ref<RegionGateStatus>('allowed') }
  // Decided after mount: the server has no user agent, and a mismatch here
  // would break hydration.
  const inAppBrowser = ref(false)
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname

  // Any rollout-flag transition invalidates an in-flight attempt, so a disable
  // (or an off->on flicker) mid-popup cannot still provision, publish, or mint.
  // Sync so even a same-tick flicker is counted, not collapsed to no-change.
  let signInGeneration = 0
  watch(
    enabled,
    () => {
      signInGeneration += 1
    },
    { flush: 'sync' }
  )

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

  /** The other mode is the same page: the shell swaps it in place, as cloud's router does. */
  function switchMode(next: AuthMode, event: MouseEvent): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
      return
    event.preventDefault()
    // A remount mid-attempt would leave the abandoned attempt free to finish
    // the sign-in and redirect, so the links hold still like the buttons do.
    if (busy.value) return
    onSwitchMode(next)
  }

  const busy = computed(
    () => state.value.step === 'pending' || state.value.step === 'minting'
  )

  const progressKey = computed(() => {
    if (state.value.step === 'pending' && state.value.provider !== 'email')
      return 'auth.signIn.pending'
    return mode === 'signUp' ? 'auth.signUp.creating' : 'auth.signIn.signingIn'
  })

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
      dispatch({ type: 'mintFailed' })
    }
  }

  async function completeSignIn(
    provider: AuthSignInProvider,
    authenticate: (firebase: WorkshopFirebase) => Promise<UserCredential>
  ) {
    if (state.value.step === 'pending' || state.value.step === 'minting') return
    dispatch({ type: 'signInStarted', provider })
    const attempt = signInGeneration
    const live = () => attempt === signInGeneration && enabled.value
    // Flag flip mid-attempt: drop the attempt so the reducer leaves `pending`.
    const abandon = () => dispatch({ type: 'signInAbandoned' })
    let firebase: Awaited<ReturnType<typeof loadWorkshopFirebase>> | undefined
    try {
      firebase = await loadWorkshopFirebase()
      // The rollout flag turning off (or flickering) mid-flight must halt the
      // in-flight auth, not merely hide the UI: no sign-in, provisioning,
      // telemetry, or session.
      if (!live()) {
        abandon()
        return
      }
      const credential = await authenticate(firebase)
      if (!live()) {
        abandon()
        return
      }
      // Email sign-up provisions atomically inside (its rollback needs it);
      // every other path provisions here so a disable during the popup stops it.
      if (!(provider === 'email' && mode === 'signUp')) {
        await firebase.provisionWorkshopCustomer(credential)
        if (!live()) {
          abandon()
          return
        }
      }
      captureAuthCompleted({
        method: provider,
        is_new_user:
          mode === 'signUp' ||
          (provider !== 'email' && firebase.isNewWorkshopUser(credential)),
        user_id: credential.user.uid
      })
      dispatch({
        type: 'credentialSucceeded',
        email: credential.user.email ?? credential.user.displayName ?? ''
      })
      await runMint(credential.user)
    } catch (error) {
      // Single-use token: any attempt consumes it, so refresh before the next.
      if (provider === 'email' && mode === 'signUp') {
        resetTurnstile()
      }
      // An invalidated attempt's rejection is not this attempt's failure.
      if (!live()) {
        abandon()
        return
      }
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
    isSecureContext.value = currentSecureContext() ?? true
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

  return {
    state: readonly(state),
    enabled,
    formVisible,
    authTimedOut,
    busy,
    progressKey,
    regionStatus,
    isSecureContext,
    inAppBrowser,
    showEmailForm: readonly(showEmailForm),
    showEmail: () => {
      showEmailForm.value = true
    },
    hideEmail: () => {
      showEmailForm.value = false
    },
    goTo,
    switchMode,
    signInWith,
    submitEmail,
    retryMint
  }
}
