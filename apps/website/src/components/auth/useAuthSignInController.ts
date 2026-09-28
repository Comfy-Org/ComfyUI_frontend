/**
 * The whole sign-in flow in one owner: the reducer for the mint phases plus
 * the flag/identity/timeout/secure-context/region state that used to live as
 * loose refs and watchers beside it. The panel component reads the returned
 * state and calls the returned commands; it holds no flow logic of its own.
 */
import {
  classifyAuthError,
  isFirebaseAuthErrorLike,
  severityForAuthError
} from '@comfyorg/account-core/firebaseAuthError'
import type { AuthErrorClassification } from '@comfyorg/account-core/firebaseAuthError'
import { until } from '@vueuse/core'
import type { UserCredential } from 'firebase/auth'
import { computed, onBeforeUnmount, onMounted, readonly, ref, watch } from 'vue'

import type { OperationHandle } from '@comfyorg/account-core/boundedOperation'
import { useGenerationGuard } from '@comfyorg/account-ui/auth/useGenerationGuard'
import type { RegionGateStatus } from '@comfyorg/account-ui/auth/regionGate'
import { useRegionGate } from '@comfyorg/account-ui/auth/regionGate'
import { isEmbeddedWebView } from '@comfyorg/account-core/webviewDetection'

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
  useWorkshopAuthFlag
} from '../../scripts/posthog'
import type { AuthMode } from './AuthSignInPanel.vue'

const HOME = '/'
/** The cloud app's router gives auth this long to initialize before its timeout view. */
const AUTH_INIT_TIMEOUT_MS = 16_000
/** Ceiling on each non-interactive step (chunk load, provisioning, mint) so a
 *  hung provider cannot pin the controls; the user-driven popup wait is left
 *  unbounded and cancellable, never timed out. */
const OPERATION_TIMEOUT_MS = 16_000
const OPERATION_TIMED_OUT = Symbol('operation-timed-out')
const POPUP_CLOSED = Symbol('popup-closed')

/** Race a non-interactive step against its deadline; a late resolve of the
 *  loser is discarded, so the continuation is suppressed. */
async function withinOperationDeadline<T>(
  operation: Promise<T>
): Promise<T | typeof OPERATION_TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<typeof OPERATION_TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(OPERATION_TIMED_OUT), OPERATION_TIMEOUT_MS)
  })
  try {
    return await Promise.race([operation, deadline])
  } finally {
    clearTimeout(timer)
  }
}

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
  // The guard also abandons on scope disposal, so teardown stops auth,
  // provisioning, and minting too.
  const signIn = useGenerationGuard()
  watch(enabled, signIn.abandon, { flush: 'sync' })

  const liveWhile = (attempt: OperationHandle) => () =>
    attempt.live() && enabled.value
  const abandonAttempt = () => dispatch({ type: 'signInAbandoned' })

  // Held from a successful provisioning until the mint actually commits, so an
  // attempt abandoned mid-mint reports no completion. Fired at the same
  // minting -> signedIn choke as the redirect, before navigation begins.
  let reportAuthCompleted: (() => void) | undefined
  // A rollback sign-out that outran its deadline is still clearing the global
  // identity after the controls recover; the next attempt waits on this before
  // authenticating so the stale sign-out cannot clear the newer identity.
  let pendingRollback: Promise<unknown> | undefined
  // A detached attempt keeps running after it has handed the controls back,
  // and Firebase can neither cancel it nor hold more than one `currentUser`.
  // Authentications are therefore serialized on this: the controls come back
  // immediately, but the next attempt still waits for its predecessor to
  // settle (and to roll back) before it authenticates, so two credentials can
  // never race for the one identity the whole page reads.
  let pendingAuthentication: Promise<unknown> | undefined
  // Counts attempts started, so a detached one can tell a successor taking
  // over from the rollout flag merely invalidating it. Folding both into
  // `live()` would leave a flag-invalidated detach with no way back to idle.
  let startedAttempts = 0
  let lastAuthenticatedAttempt = 0
  let attemptsInFlight = 0
  // A cancelled attempt's identity can land well after the attempt itself has
  // gone, so the watch below outlives it. Bounded: an unclaimed record left
  // armed would eventually sign out an identity from somewhere else entirely.
  const strayWatch = ref<
    | {
        readonly before?: string
        readonly attempt: number
        readonly holdsModeLinks: boolean
      }
    | undefined
  >()
  let strayTimer: ReturnType<typeof setTimeout> | undefined

  /**
   * Starts clearing an identity that a cancelled attempt's in-flight exchange
   * published after the attempt had already given up on it, and reports
   * whether it did. Deliberately inert while any attempt is still running: a
   * live one owns the identity question, and its own credential reaches
   * `currentUser` before it can claim it here.
   *
   * The restore path calls this before it acts, rather than a watcher of its
   * own racing it: the sign-out is a round trip, and a restore that ran first
   * would mint a session for the account this is in the middle of discarding.
   */
  function clearStrayIdentity(): boolean {
    const watching = strayWatch.value
    if (!watching || !firebaseForRollback) return false
    if (lastAuthenticatedAttempt >= watching.attempt) {
      strayWatch.value = undefined
      return false
    }
    if (attemptsInFlight > 0) return false
    const current = user.value
    if (!current || current.uid === watching.before) return false
    strayWatch.value = undefined
    const rollback = firebaseForRollback.signOutWorkshop().catch(() => {})
    pendingRollback = rollback
    void rollback.finally(() => {
      if (pendingRollback === rollback) pendingRollback = undefined
    })
    return true
  }

  let firebaseForRollback: WorkshopFirebase | undefined
  onBeforeUnmount(() => {
    clearTimeout(strayTimer)
    strayWatch.value = undefined
  })

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
      reportAuthCompleted?.()
      reportAuthCompleted = undefined
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
    // The links hold still while the buttons do, and through a detached
    // attempt too: `signIn.abandon()` only bumps a generation, so a remount
    // leaves the old attempt running against a fresh controller that is back
    // at `idle` and would mint its credential through the restore listener,
    // skipping the provisioning `detached` exists to protect.
    if (modeLocked.value) return
    onSwitchMode(next)
  }

  const busy = computed(
    () => state.value.step === 'pending' || state.value.step === 'minting'
  )

  // The sign-in controls come back on a detached attempt, but the mode links
  // cannot: switching remounts the panel, and the replacement controller would
  // mint the old attempt's credential without provisioning it. That holds until
  // the identity can no longer arrive, not just while the attempt is detached —
  // a successor failing leaves the page in `error` with the watch still armed,
  // and the remount would discard the only thing waiting to clear it.
  const modeLocked = computed(
    () =>
      busy.value ||
      state.value.step === 'detached' ||
      strayWatch.value?.holdsModeLinks === true
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
      summary: t(severity === 'warn' ? 'g.warning' : 'g.error', locale),
      detail: signInErrorMessage(classification, locale, hostname)
    })
  }

  async function runMint(
    currentUser: WorkshopSessionUser | undefined,
    live: () => boolean,
    onAbandon: () => void | Promise<void>
  ): Promise<void> {
    const result = await withinOperationDeadline(
      currentUser ? ensureFresh(currentUser) : ensureFresh()
    )
    if (state.value.step !== 'minting') return
    // A flag flip or teardown during the mint must not redirect or persist a
    // session for an attempt that is no longer live.
    if (!live()) {
      await onAbandon()
      return
    }
    if (result === OPERATION_TIMED_OUT || result?.status !== 'ok') {
      dispatch({ type: 'mintFailed' })
      return
    }
    dispatch({ type: 'mintSucceeded' })
  }

  async function completeSignIn(
    provider: AuthSignInProvider,
    authenticate: (
      firebase: WorkshopFirebase,
      onPopupClosed: () => void
    ) => Promise<UserCredential>
  ) {
    if (state.value.step === 'pending' || state.value.step === 'minting') return
    // A detached predecessor still owns the identity until it settles, so
    // starting here supersedes it for the page while the gate below keeps the
    // two from authenticating at once.
    signIn.abandon()
    dispatch({ type: 'signInStarted', provider })
    const live = liveWhile(signIn.capture())
    let firebase: WorkshopFirebase | undefined
    let authenticated = false
    let authenticatedUid: string | undefined
    let detached = false
    let finishAttempt: (() => void) | undefined
    let identityBefore: string | undefined
    let cancelledBySuccessor = false
    const attemptNumber = ++startedAttempts
    attemptsInFlight += 1
    // Detaching hands the controls to the visitor; from then on this attempt
    // idles the page only while no successor has taken the controls over.
    const ownsControls = () => !detached || startedAttempts === attemptNumber
    // Roll a persisted identity back before the reducer leaves `pending`, so no
    // retry can start while the sign-out is still in flight: `signOutWorkshop`
    // is global, and an unawaited one from an abandoned attempt would clear the
    // identity a newer attempt just accepted. Bounded so a hung sign-out still
    // frees the controls, and best-effort so a rejection stays handled.
    const abandon = async () => {
      reportAuthCompleted = undefined
      // `signOutWorkshop` is global. A different identity on `currentUser` got
      // there after this attempt lost the controls and is not this attempt's
      // to drop; an unpublished one still rolls back, since a credential that
      // never reached the listener is this attempt's own to clear.
      const identityIsAnothersNow =
        !!user.value && user.value.uid !== authenticatedUid
      if (authenticated && !identityIsAnothersNow) {
        const rollback = firebase!.signOutWorkshop().catch(() => {})
        pendingRollback = rollback
        void rollback.finally(() => {
          if (pendingRollback === rollback) pendingRollback = undefined
        })
        await withinOperationDeadline(rollback)
      }
      if (ownsControls()) abandonAttempt()
    }
    // A non-interactive step that outran its deadline resets to idle like a
    // silent abandonment, but the user clicked, so surface the generic failure
    // copy the failure paths show rather than leave the controls silently live.
    const recoverFromTimeout = async () => {
      await abandon()
      toastSignInFailure({ kind: 'unknown' })
    }
    try {
      // Wait out a prior rollback before authenticating, or its global sign-out
      // could clear this credential; bounded so a never-settling sign-out can't
      // pin the controls (on expiry, recover with a message and keep guarding).
      if (pendingRollback) {
        const rolledBack = await withinOperationDeadline(pendingRollback)
        if (rolledBack === OPERATION_TIMED_OUT) {
          if (!live()) await abandon()
          else await recoverFromTimeout()
          return
        }
      }
      const loaded = await withinOperationDeadline(loadWorkshopFirebase())
      // The rollout flag turning off (or flickering) mid-flight must halt the
      // in-flight auth, not merely hide the UI: no sign-in, provisioning,
      // telemetry, or session. A live step that outran its deadline instead
      // recovers with a message.
      if (loaded === OPERATION_TIMED_OUT) {
        if (!live()) await abandon()
        else await recoverFromTimeout()
        return
      }
      if (!live()) {
        await abandon()
        return
      }
      firebase = loaded
      // A detached predecessor may still publish an identity, so an email
      // attempt waits it out rather than adding a second credential to the one
      // `currentUser` both would write.
      //
      // A popup attempt does not wait, because waiting would spend the click
      // activation it needs and leave the retry pop-up blocked. Firebase's new
      // `PopupOperation` does cancel `currentPopupAction`, but only by
      // rejecting its promise: a token exchange already in flight still runs
      // to completion and still writes `currentUser`. The identity that leaves
      // behind is cleared in this function's `finally`, which is what lets the
      // popup path skip the wait rather than merely accept the race.
      if (provider === 'email' && pendingAuthentication) {
        const settledFirst = await withinOperationDeadline(
          pendingAuthentication
        )
        if (!live()) {
          await abandon()
          return
        }
        if (settledFirst === OPERATION_TIMED_OUT) {
          await recoverFromTimeout()
          return
        }
      }
      if (provider === 'email' && pendingRollback) {
        const rolledBack = await withinOperationDeadline(pendingRollback)
        if (!live()) {
          await abandon()
          return
        }
        if (rolledBack === OPERATION_TIMED_OUT) {
          await recoverFromTimeout()
          return
        }
      }
      // The user-driven popup is still never timed out or cut short: closing
      // the window only detaches it from the controls, and the same promise
      // still decides the outcome. Email is a non-interactive round-trip, so
      // it stays bounded like the other steps.
      let notifyPopupClosed = () => {}
      identityBefore = user.value?.uid
      const attempt = authenticate(firebase, () => notifyPopupClosed())
      if (provider !== 'email') {
        const popupClosed = new Promise<typeof POPUP_CLOSED>((resolve) => {
          notifyPopupClosed = () => resolve(POPUP_CLOSED)
        })
        const settled = await Promise.race([attempt, popupClosed])
        // An identity published since this attempt began means the window
        // closed on a sign-in that is completing, not on an abandonment, so
        // there is nothing to hand back. A flag flip has hidden the form
        // already, and detaching would strand it there.
        if (
          settled === POPUP_CLOSED &&
          live() &&
          user.value?.uid === identityBefore
        ) {
          detached = true
          // Published for the next attempt to wait on, and settled in this
          // one's `finally` rather than with the popup promise: the rollback
          // runs after that promise resolves, and the waiter has to clear it
          // too before it may authenticate.
          const settling = new Promise<void>((resolve) => {
            finishAttempt = resolve
          })
          pendingAuthentication = settling
          void settling.finally(() => {
            if (pendingAuthentication === settling) {
              pendingAuthentication = undefined
            }
          })
          dispatch({ type: 'signInDetached' })
        }
      }
      const authResult =
        provider === 'email'
          ? await withinOperationDeadline(attempt)
          : await attempt
      // No identity is persisted when the email round-trip outran its deadline.
      if (authResult === OPERATION_TIMED_OUT) {
        if (!live()) await abandon()
        else await recoverFromTimeout()
        return
      }
      const credential = authResult
      // The identity is persisted the moment the credential resolves, so an
      // abandon from here on must roll it back even if the flag has since flipped.
      authenticated = true
      authenticatedUid = credential.user.uid
      lastAuthenticatedAttempt = attemptNumber
      if (!live()) {
        await abandon()
        return
      }
      // Email sign-up provisions atomically inside (its rollback needs it);
      // every other path provisions here so a disable during the popup stops it.
      if (!(provider === 'email' && mode === 'signUp')) {
        const provisioned = await withinOperationDeadline(
          firebase.provisionWorkshopCustomer(credential)
        )
        if (!live()) {
          await abandon()
          return
        }
        // A slow-but-valid provider is kept signed in with a retry, the same as
        // a provisioning error: a timeout must not be more destructive than a
        // hard failure and tear the fresh identity down.
        if (provisioned === OPERATION_TIMED_OUT) {
          dispatch({
            type: 'provisioningFailed',
            email: credential.user.email ?? credential.user.displayName ?? ''
          })
          return
        }
      }
      reportAuthCompleted = () =>
        captureAuthCompleted({
          method: provider,
          is_new_user:
            mode === 'signUp' ||
            (provider !== 'email' && firebase!.isNewWorkshopUser(credential)),
          user_id: credential.user.uid
        })
      dispatch({
        type: 'credentialSucceeded',
        email: credential.user.email ?? credential.user.displayName ?? ''
      })
      await runMint(credential.user, live, abandon)
    } catch (error) {
      // Recorded before the liveness check below returns: a superseded attempt
      // is exactly the one whose exchange can still publish an identity.
      cancelledBySuccessor =
        isFirebaseAuthErrorLike(error) &&
        error.code === 'auth/cancelled-popup-request'
      // Single-use token: any attempt consumes it, so refresh before the next.
      if (provider === 'email' && mode === 'signUp') {
        resetTurnstile()
      }
      // An invalidated attempt's rejection is not this attempt's failure.
      if (!live()) {
        await abandon()
        return
      }
      captureAuthFailed({
        error_code: isFirebaseAuthErrorLike(error) ? error.code : 'unknown',
        auth_action: `${provider}_${mode === 'signUp' ? 'sign_up' : 'sign_in'}`
      })
      // Only the dismissal the visitor performed goes untoasted, and only once
      // they have already seen the page recover from it. Every other failure
      // still has something to say, whenever it arrives.
      if (detached && classifyAuthError(error).kind === 'popup-dismissed') {
        abandonAttempt()
        return
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
    } finally {
      attemptsInFlight -= 1
      // Firebase cancels a superseded pop-up by rejecting its promise, but an
      // exchange already in flight still finishes and still writes
      // `currentUser` — usually after this point, since the rejection is
      // synchronous and the exchange is a network call. Arm the watch rather
      // than reading `user` once, and evaluate now too for the rare identity
      // that has already landed.
      //
      // Armed for a dismissal too, not just a cancellation: Firebase's grace is
      // 8s against blocking functions documented at up to 7s, and this project
      // runs one, so `popup-closed-by-user` can be thrown with the exchange
      // still running (firebase-js-sdk#6956). Only a cancellation holds the
      // mode links, though — a remount is what makes that case unrecoverable,
      // and holding them on every ordinary dismissal would tax the very case
      // this change exists to speed up.
      if (detached && !authenticated && firebase) {
        firebaseForRollback = firebase
        strayWatch.value = {
          before: identityBefore,
          attempt: attemptNumber,
          holdsModeLinks: cancelledBySuccessor
        }
        clearTimeout(strayTimer)
        strayTimer = setTimeout(() => {
          strayWatch.value = undefined
        }, OPERATION_TIMEOUT_MS)
      }
      clearStrayIdentity()
      finishAttempt?.()
    }
  }

  function signInWith(provider: 'google' | 'github') {
    return completeSignIn(provider, (firebase, onPopupClosed) =>
      provider === 'google'
        ? firebase.signInWorkshopWithGoogle({ onPopupClosed })
        : firebase.signInWorkshopWithGitHub({ onPopupClosed })
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
    await runMint(undefined, liveWhile(signIn.capture()), abandonAttempt)
  }

  const stopUserWatch = watch(
    user,
    (restored) => {
      if (!restored) {
        dispatch({ type: 'signedOut' })
        return
      }
      if (clearStrayIdentity()) return
      if (isSwitchingAccount(window.location.search)) return
      const before = state.value.step
      dispatch({
        type: 'userRestored',
        email: restored.email ?? restored.displayName ?? ''
      })
      if (before !== state.value.step && state.value.step === 'minting') {
        // No user argument: `restored` is a readonly proxy, and the client
        // already holds the raw current user.
        void runMint(undefined, liveWhile(signIn.capture()), abandonAttempt)
      }
    },
    { immediate: true }
  )
  onBeforeUnmount(stopUserWatch)

  // A focus refresh can mint successfully after a failed attempt; the banner
  // and its Retry must not outlive the recovery. Gated on the flag: a disable
  // mid-mint has abandoned the attempt, and the published credential must not
  // redirect it past the mint-promise guard at this watch layer.
  const stopSessionWatch = watch(session, (active) => {
    if (active && enabled.value) dispatch({ type: 'mintSucceeded' })
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

  const initPending = computed(() => enabled.value && !identitySettled.value)
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
    modeLocked,
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
