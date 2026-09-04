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
  | { readonly step: 'error'; readonly messageKey: TranslationKey }
  | { readonly step: 'signedIn'; readonly email: string }

export type AuthSignInEvent =
  | { readonly type: 'signInStarted'; readonly provider: AuthSignInProvider }
  | { readonly type: 'signInSucceeded'; readonly email: string }
  | { readonly type: 'signInFailed'; readonly error: unknown }
  | { readonly type: 'userRestored'; readonly email: string }
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
      return state.step === 'pending'
        ? state
        : { step: 'pending', provider: event.provider }
    case 'signInSucceeded':
      return { step: 'signedIn', email: event.email }
    case 'signInFailed':
      return {
        step: 'error',
        messageKey: ERROR_KEYS[classifyAuthError(event.error).kind]
      }
    case 'userRestored':
      // Firebase's restore listener also fires mid-popup; the in-flight
      // attempt owns the outcome then (provisioning may still fail).
      return state.step === 'pending'
        ? state
        : { step: 'signedIn', email: event.email }
    case 'signedOut':
      return state.step === 'pending' ? state : { step: 'idle' }
  }
}
