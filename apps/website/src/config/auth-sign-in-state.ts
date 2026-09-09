/**
 * The sign-in page's state, as one union and a pure transition so the
 * orderings that matter — a popup resolving while Firebase's restore
 * listener also fires, a provisioning failure after the popup succeeded —
 * are decided in one tested place instead of by handler timing.
 */
import {
  authErrorMessage,
  classifyAuthError,
  unauthorizedDomainMessage
} from '@comfyorg/account/firebaseAuthError'
import type {
  AuthCopyLocale,
  AuthErrorClassification
} from '@comfyorg/account/firebaseAuthError'

import type { TranslationKey } from '../i18n/translations'

export type AuthSignInProvider = 'google' | 'github' | 'email'

export type AuthSignInState =
  | { readonly step: 'idle' }
  | { readonly step: 'pending'; readonly provider: AuthSignInProvider }
  | { readonly step: 'minting'; readonly email: string }
  | {
      readonly step: 'error'
      readonly classification: AuthErrorClassification
    }
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

const SUPPORT_EMAIL = 'support@comfy.org'

/**
 * Codes whose distinct copy would tell a visitor whether an address has an
 * account. Firebase collapses them itself only when Email Enumeration
 * Protection is on, so the collapse is enforced here regardless. Sign-up's
 * email-already-in-use stays distinct on purpose: the visitor is told to
 * sign in instead.
 */
const ACCOUNT_ORACLE_CODES: ReadonlySet<string> = new Set([
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/invalid-email'
])

function withoutAccountOracle(
  classification: AuthErrorClassification
): AuthErrorClassification {
  return classification.kind === 'auth' &&
    ACCOUNT_ORACLE_CODES.has(classification.code)
    ? { kind: 'auth', code: 'auth/invalid-credential' }
    : classification
}

/**
 * The copy for a failed attempt, from the package tables the cloud app's
 * own strings are pinned to. Only the unauthorized-domain line needs this
 * host's values.
 */
export function signInErrorMessage(
  classification: AuthErrorClassification,
  locale: AuthCopyLocale,
  hostname: string
): string {
  return classification.kind === 'unauthorized-domain'
    ? unauthorizedDomainMessage(
        { domain: hostname, email: SUPPORT_EMAIL },
        locale
      )
    : authErrorMessage(classification, locale)
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
    case 'signInFailed':
      return {
        step: 'error',
        classification: withoutAccountOracle(classifyAuthError(event.error))
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
      if (state.step === 'minting')
        return { step: 'signedIn', email: state.email }
      // A later refresh recovered the session: drop the stale failure banner.
      return state.step === 'signedIn' &&
        state.messageKey === 'auth.signIn.error.session'
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
