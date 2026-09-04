/**
 * The sign-in page's state, as one union and a pure transition so the
 * orderings that matter — a popup resolving while Firebase's restore
 * listener also fires, a session mint failing after the popup succeeded —
 * are decided in one tested place instead of by handler timing.
 *
 * `minting` is its own step because the popup succeeding is not the end:
 * the visitor is signed in only once the workspace session exists, and a
 * mint failure needs a retry surface that must never re-prompt the popup.
 */
import { classifyAuthError } from '@comfyorg/auth-core/firebaseAuthError'

import type { TranslationKey } from '../i18n/translations'

export type AuthSignInProvider = 'google' | 'github' | 'email'

export type AuthSignInState =
  | { readonly step: 'idle' }
  | { readonly step: 'pending'; readonly provider: AuthSignInProvider }
  | { readonly step: 'minting'; readonly email: string }
  | { readonly step: 'error'; readonly messageKey: TranslationKey }
  | { readonly step: 'sessionError'; readonly email: string }
  | { readonly step: 'signedIn'; readonly email: string }

export type AuthSignInEvent =
  | { readonly type: 'signInStarted'; readonly provider: AuthSignInProvider }
  | { readonly type: 'credentialSucceeded'; readonly email: string }
  | { readonly type: 'signInFailed'; readonly error: unknown }
  | { readonly type: 'userRestored'; readonly email: string }
  | { readonly type: 'mintSucceeded' }
  | { readonly type: 'mintFailed' }
  | { readonly type: 'mintRetried' }
  | { readonly type: 'signedOut' }

const ERROR_KEYS: Record<
  ReturnType<typeof classifyAuthError>['kind'],
  TranslationKey
> = {
  'popup-dismissed': 'auth.signIn.error.popupDismissed',
  'unauthorized-domain': 'auth.signIn.error.domain',
  'signup-blocked': 'auth.signIn.error.blocked',
  auth: 'auth.signIn.error.generic',
  unknown: 'auth.signIn.error.generic'
}

/**
 * Email failures a visitor can act on get their own copy. Firebase collapses
 * wrong-password and user-not-found into invalid-credential when email
 * enumeration protection is on, so all three read the same.
 */
const EMAIL_ERROR_KEYS: Partial<Record<string, TranslationKey>> = {
  'auth/invalid-credential': 'auth.signIn.error.invalidCredentials',
  'auth/wrong-password': 'auth.signIn.error.invalidCredentials',
  'auth/user-not-found': 'auth.signIn.error.invalidCredentials',
  'auth/invalid-email': 'auth.signIn.error.invalidCredentials',
  'auth/email-already-in-use': 'auth.signIn.error.emailInUse',
  'auth/too-many-requests': 'auth.signIn.error.tooManyRequests'
}

export function authSignInTransition(
  state: AuthSignInState,
  event: AuthSignInEvent
): AuthSignInState {
  switch (event.type) {
    case 'signInStarted':
      // One attempt at a time: a click during pending/minting changes nothing.
      return state.step === 'pending' || state.step === 'minting'
        ? state
        : { step: 'pending', provider: event.provider }
    case 'credentialSucceeded':
      return { step: 'minting', email: event.email }
    case 'signInFailed': {
      const classified = classifyAuthError(event.error)
      const emailKey =
        classified.kind === 'auth'
          ? EMAIL_ERROR_KEYS[classified.code]
          : undefined
      return {
        step: 'error',
        messageKey: emailKey ?? ERROR_KEYS[classified.kind]
      }
    }
    case 'userRestored':
      // A returning Firebase user still needs the mint. While an attempt is
      // in flight (the popup fires this listener too), the attempt owns the
      // outcome.
      return state.step === 'idle' || state.step === 'error'
        ? { step: 'minting', email: event.email }
        : state
    case 'mintSucceeded':
      return state.step === 'minting'
        ? { step: 'signedIn', email: state.email }
        : state
    case 'mintFailed':
      return state.step === 'minting'
        ? { step: 'sessionError', email: state.email }
        : state
    case 'mintRetried':
      return state.step === 'sessionError'
        ? { step: 'minting', email: state.email }
        : state
    case 'signedOut':
      return state.step === 'pending' || state.step === 'minting'
        ? state
        : { step: 'idle' }
  }
}
