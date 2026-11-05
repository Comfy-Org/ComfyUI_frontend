/**
 * The sign-in page's state, as one union and a pure transition, so the
 * orderings that matter — a popup resolving while Firebase's restore listener
 * also fires, a mint failing after the credential succeeded — are decided in
 * one tested place instead of by handler timing.
 */
import type { AuthErrorClassification } from '@comfyorg/account-core/firebaseAuthError'
import { classifyAuthError } from '@comfyorg/account-core/firebaseAuthError'

export type SignInProvider = 'google' | 'github' | 'email'

/** Where the attempt came from; a restored one never shows the form. */
type SignInOrigin = 'interactive' | 'restored'

export type SignInState =
  | { readonly step: 'idle' }
  | { readonly step: 'pending'; readonly provider: SignInProvider }
  | { readonly step: 'minting'; readonly origin: SignInOrigin }
  | { readonly step: 'error'; readonly classification: AuthErrorClassification }
  | {
      readonly step: 'signedIn'
      readonly origin: SignInOrigin
      /** Set when the identity holds but the workspace session does not. */
      readonly mintFailed?: true
    }

export type SignInEvent =
  | { readonly type: 'signInStarted'; readonly provider: SignInProvider }
  | { readonly type: 'credentialSucceeded' }
  | { readonly type: 'signInFailed'; readonly error: unknown }
  | { readonly type: 'userRestored' }
  | { readonly type: 'mintSucceeded' }
  | { readonly type: 'mintFailed' }
  | { readonly type: 'mintRetried' }
  | { readonly type: 'signedOut' }

function attemptInFlight(state: SignInState): boolean {
  return state.step === 'pending' || state.step === 'minting'
}

/** One popup at a time: a second click while an attempt runs changes nothing. */
function started(state: SignInState, provider: SignInProvider): SignInState {
  return attemptInFlight(state) ? state : { step: 'pending', provider }
}

/**
 * Firebase's restore listener also fires mid-popup; the in-flight attempt owns
 * the outcome then.
 */
function restored(state: SignInState): SignInState {
  return state.step === 'idle' || state.step === 'error'
    ? { step: 'minting', origin: 'restored' }
    : state
}

function minted(state: SignInState): SignInState {
  if (state.step === 'minting') {
    return { step: 'signedIn', origin: state.origin }
  }
  // A later refresh recovered the session: drop the stale failure banner.
  return state.step === 'signedIn' && state.mintFailed
    ? { step: 'signedIn', origin: state.origin }
    : state
}

function mintRefused(state: SignInState): SignInState {
  return state.step === 'minting'
    ? { step: 'signedIn', origin: state.origin, mintFailed: true }
    : state
}

function mintRetried(state: SignInState): SignInState {
  return state.step === 'signedIn' && state.mintFailed
    ? { step: 'minting', origin: state.origin }
    : state
}

function signedOut(state: SignInState): SignInState {
  return attemptInFlight(state) ? state : { step: 'idle' }
}

export function signInTransition(
  state: SignInState,
  event: SignInEvent
): SignInState {
  switch (event.type) {
    case 'signInStarted':
      return started(state, event.provider)
    case 'credentialSucceeded':
      return { step: 'minting', origin: 'interactive' }
    case 'signInFailed':
      return { step: 'error', classification: classifyAuthError(event.error) }
    case 'userRestored':
      return restored(state)
    case 'mintSucceeded':
      return minted(state)
    case 'mintFailed':
      return mintRefused(state)
    case 'mintRetried':
      return mintRetried(state)
    case 'signedOut':
      return signedOut(state)
  }
}
