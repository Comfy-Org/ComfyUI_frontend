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
import {
  billingWebSessionClient,
  useBillingWebSession
} from '@/session/billingWebSession'

const AUTH_ERROR_COPY: AuthErrorCopy = en.auth.errors

export function useSignInController(onSignedIn: () => void) {
  const { user } = useBillingWebSession()
  const state = ref<SignInState>({ step: 'idle' })
  // Resolved once, asynchronously: the runtime config wins when the bounded
  // fetch beats this page's first sign-in click, the build-time fallback
  // otherwise. Never awaited here, so it can't block first paint.
  const identity = ref<FirebaseIdentity>()
  void resolveBillingWebIdentity().then((resolved) => {
    identity.value = resolved
  })

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

  async function mint(requestedUser?: User): Promise<void> {
    const result = await billingWebSessionClient().ensureFresh(requestedUser)
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
    available: computed(() => identity.value !== undefined),
    signInWith,
    submitEmail,
    retryMint
  }
}
