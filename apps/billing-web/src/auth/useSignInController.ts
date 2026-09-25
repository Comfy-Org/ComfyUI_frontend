/**
 * The sign-in flow in one owner: the reducer for the credential and mint
 * phases, the identity restore listener, and the commands the view calls. The
 * view reads the returned state and holds no flow logic of its own.
 */
import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import { authErrorMessage } from '@comfyorg/account-core/firebaseAuthError'
import type { AuthErrorCopy } from '@comfyorg/account-core/firebaseAuthError'
import type { User, UserCredential } from 'firebase/auth'
import { computed, ref, watch } from 'vue'

import type {
  SignInEvent,
  SignInProvider,
  SignInState
} from '@/auth/signInState'
import { signInTransition } from '@/auth/signInState'
import en from '@/locales/en/main.json' with { type: 'json' }
import { resolveBillingWebIdentity } from '@/config/firebase'
import { boundWorkspaceId } from '@/entry/workspaceBinding'
import {
  billingWebSessionClient,
  useBillingWebSession
} from '@/session/billingWebSession'

const AUTH_ERROR_COPY: AuthErrorCopy = en.auth.errors

export function useSignInController(onSignedIn: () => void) {
  const { user, failure } = useBillingWebSession()
  const state = ref<SignInState>({ step: 'idle' })
  // Resolved asynchronously so it can't block first paint. A failed fetch no
  // longer sticks in account-core's cache, so calling this again (from
  // `retryAvailability`) genuinely re-fetches instead of replaying `undefined`.
  const identity = ref<FirebaseIdentity>()
  async function loadIdentity(): Promise<void> {
    identity.value = await resolveBillingWebIdentity()
  }
  void loadIdentity()

  const busy = computed(
    () => state.value.step === 'pending' || state.value.step === 'minting'
  )
  /**
   * A returning visitor leaves without ever seeing the form: the
   * restored-origin mint stays hidden through its successful sign-in.
   */
  const leaving = computed(() => {
    const current = state.value
    if (current.step === 'minting') return current.origin === 'restored'
    if (current.step === 'signedIn')
      return current.origin === 'restored' && !current.mintFailed
    return false
  })
  const errorMessage = computed(() =>
    state.value.step === 'error'
      ? authErrorMessage(state.value.classification, AUTH_ERROR_COPY)
      : ''
  )

  function dispatch(event: SignInEvent): SignInState {
    const before = state.value
    const next = signInTransition(before, event)
    state.value = next
    // The session client publishes the credential before the mint promise
    // resolves, so the transition, not the caller, is what leaves the page.
    if (
      before.step === 'minting' &&
      next.step === 'signedIn' &&
      !next.mintFailed
    )
      onSignedIn()
    return next
  }

  /**
   * The client no longer auto-mints (see `billingWebSession.ts`), so every
   * mint this app issues goes through here — the one place that reads the
   * entry binding at the moment it actually mints, not at construction, so a
   * rebind that lands while the tab is signed out is not lost to a stale
   * default.
   */
  async function mint(requestedUser?: User): Promise<void> {
    const result = await billingWebSessionClient().ensureFresh(requestedUser, {
      workspaceId: boundWorkspaceId()
    })
    dispatch(
      result?.status === 'ok'
        ? { type: 'mintSucceeded' }
        : { type: 'mintFailed' }
    )
  }

  async function completeSignIn(
    provider: SignInProvider,
    authenticate: (identity: FirebaseIdentity) => Promise<UserCredential>
  ): Promise<void> {
    if (!identity.value || busy.value) return
    dispatch({ type: 'signInStarted', provider })
    let credential: UserCredential
    try {
      credential = await authenticate(identity.value)
    } catch (error) {
      dispatch({ type: 'signInFailed', error })
      return
    }
    dispatch({ type: 'credentialSucceeded' })
    await mint(credential.user)
  }

  function signInWith(provider: 'google' | 'github'): Promise<void> {
    return completeSignIn(provider, (identity) =>
      provider === 'google'
        ? identity.signInWithGoogle()
        : identity.signInWithGitHub()
    )
  }

  function submitEmail(credentials: {
    email: string
    password: string
  }): Promise<void> {
    return completeSignIn('email', (identity) =>
      identity.signInWithEmail(credentials.email, credentials.password)
    )
  }

  async function retryMint(): Promise<void> {
    dispatch({ type: 'mintRetried' })
    await mint()
  }

  /** For the "sign-in unavailable" notice: re-fetches instead of leaving the page dead. */
  async function retryAvailability(): Promise<void> {
    await loadIdentity()
  }

  watch(
    user,
    (restored) => {
      if (!restored) {
        dispatch({ type: 'signedOut' })
        return
      }
      const wasIdle = state.value.step !== 'minting'
      const restoring = dispatch({ type: 'userRestored' })
      // No user argument: `restored` is a readonly proxy, and the client
      // already holds the raw current user.
      if (wasIdle && restoring.step === 'minting') void mint()
    },
    { immediate: true }
  )

  return {
    state,
    busy,
    leaving,
    errorMessage,
    /** The mint's own refusal, e.g. naming a workspace this account is not in. */
    sessionFailureCode: computed(() => failure.value?.code),
    available: computed(() => identity.value !== undefined),
    signInWith,
    submitEmail,
    retryMint,
    retryAvailability
  }
}
