/**
 * The sign-in page's state, as one union and a pure transition so the
 * orderings that matter — a popup resolving while Firebase's restore
 * listener also fires, a provisioning failure after the popup succeeded —
 * are decided in one tested place instead of by handler timing.
 */
import { classifyAuthError } from '@comfyorg/auth-core/firebaseAuthError'

import type { TranslationKey } from '../i18n/translations'

export type AuthSignInProvider = 'google' | 'github'

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
  | { readonly type: 'popupSucceeded'; readonly email: string }
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
    case 'popupSucceeded':
      return { step: 'minting', email: event.email }
    case 'signInFailed':
      return {
        step: 'error',
        messageKey: ERROR_KEYS[classifyAuthError(event.error).kind]
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
