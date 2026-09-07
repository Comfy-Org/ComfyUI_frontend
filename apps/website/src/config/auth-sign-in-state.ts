/**
 * The sign-in page's state, as one union and a pure transition so the
 * orderings that matter — a popup resolving while Firebase's restore
 * listener also fires, a provisioning failure after the popup succeeded —
 * are decided in one tested place instead of by handler timing.
 */
import { classifyAuthError } from '@comfyorg/account/firebaseAuthError'

import type { TranslationKey } from '../i18n/translations'

export type AuthSignInProvider = 'google' | 'github'

export type AuthSignInState =
  | { readonly step: 'idle' }
  | { readonly step: 'pending'; readonly provider: AuthSignInProvider }
  | { readonly step: 'error'; readonly messageKey: TranslationKey }
  | {
      readonly step: 'signedIn'
      readonly email: string
      readonly messageKey?: TranslationKey
    }

export type AuthSignInEvent =
  | { readonly type: 'signInStarted'; readonly provider: AuthSignInProvider }
  | { readonly type: 'signInSucceeded'; readonly email: string }
  | { readonly type: 'signInFailed'; readonly error: unknown }
  | { readonly type: 'provisioningFailed'; readonly email: string }
  | { readonly type: 'userRestored'; readonly email: string }
  | { readonly type: 'signedOut' }

const ERROR_KEYS: Record<
  ReturnType<typeof classifyAuthError>['kind'],
  TranslationKey
> = {
  'popup-dismissed': 'auth.signIn.error.popupClosed',
  'unauthorized-domain': 'auth.signIn.error.domain',
  'signup-blocked': 'auth.signIn.error.blocked',
  auth: 'auth.signIn.error.generic',
  unknown: 'auth.signIn.error.generic'
}

// Each dismissal shape gets the cloud app's own copy for it; the closed
// message is the fallback for any future code in the family.
const POPUP_DISMISSED_KEYS: Partial<Record<string, TranslationKey>> = {
  'auth/popup-closed-by-user': 'auth.signIn.error.popupClosed',
  'auth/cancelled-popup-request': 'auth.signIn.error.popupCancelled',
  'auth/popup-blocked': 'auth.signIn.error.popupBlocked'
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
    case 'signInFailed': {
      const classified = classifyAuthError(event.error)
      const popupKey =
        classified.kind === 'popup-dismissed'
          ? POPUP_DISMISSED_KEYS[classified.code]
          : undefined
      return {
        step: 'error',
        messageKey: popupKey ?? ERROR_KEYS[classified.kind]
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
      return state.step === 'pending'
        ? state
        : { step: 'signedIn', email: event.email }
    case 'signedOut':
      return state.step === 'pending' ? state : { step: 'idle' }
  }
}
