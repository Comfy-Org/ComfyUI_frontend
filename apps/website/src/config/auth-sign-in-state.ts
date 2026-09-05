/**
 * The sign-in page's state, as one union and a pure transition so the
 * orderings that matter — a popup resolving while Firebase's restore
 * listener also fires, a provisioning failure after the popup succeeded —
 * are decided in one tested place instead of by handler timing.
 */
import { classifyAuthError } from '@comfyorg/auth-core/firebaseAuthError'

import type { TranslationKey } from '../i18n/translations'

export type AuthSignInProvider = 'google' | 'github' | 'email'

export type AuthSignInState =
  | { readonly step: 'idle' }
  | { readonly step: 'pending'; readonly provider: AuthSignInProvider }
  | { readonly step: 'minting'; readonly email: string }
  | { readonly step: 'error'; readonly messageKey: TranslationKey }
  | {
      readonly step: 'signedIn'
      readonly email: string
      readonly messageKey?: TranslationKey
    }

export type AuthSignInEvent =
  | { readonly type: 'signInStarted'; readonly provider: AuthSignInProvider }
  | { readonly type: 'credentialSucceeded'; readonly email: string }
  | { readonly type: 'signInFailed'; readonly error: unknown }
  | { readonly type: 'provisioningFailed'; readonly email: string }
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
  // Deliberate UX tradeoff: signup identifies an existing account so the
  // visitor can switch to sign-in. Password reset itself remains neutral and
  // never reveals whether an address exists.
  'auth/email-already-in-use': 'auth.signIn.error.emailInUse',
  'auth/too-many-requests': 'auth.signIn.error.tooManyRequests'
}

export function authSignInTransition(
  state: AuthSignInState,
  event: AuthSignInEvent
): AuthSignInState {
  switch (event.type) {
    case 'signInStarted':
      // One popup at a time: a second click while pending changes nothing.
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
    case 'provisioningFailed':
      return {
        step: 'signedIn',
        email: event.email,
        messageKey: 'auth.signIn.error.provisioning'
      }
    case 'userRestored':
      // Firebase's restore listener also fires mid-popup; the in-flight
      // attempt owns the outcome then (provisioning may still fail).
      return state.step === 'idle' || state.step === 'error'
        ? { step: 'minting', email: event.email }
        : state
    case 'mintSucceeded':
      return state.step === 'minting'
        ? { step: 'signedIn', email: state.email }
        : state
    case 'mintFailed':
      return state.step === 'minting'
        ? {
            step: 'signedIn',
            email: state.email,
            messageKey: 'auth.signIn.error.session'
          }
        : state
    case 'mintRetried':
      return state.step === 'signedIn' &&
        state.messageKey === 'auth.signIn.error.session'
        ? { step: 'minting', email: state.email }
        : state
    case 'signedOut':
      return state.step === 'pending' || state.step === 'minting'
        ? state
        : { step: 'idle' }
  }
}
