/**
 * The sign-in page's state, as one union and a pure transition so the
 * orderings that matter — a popup resolving while Firebase's restore
 * listener also fires, a provisioning failure after the popup succeeded —
 * are decided in one tested place instead of by handler timing.
 */
import {
  authErrorMessage,
  classifyAuthError
} from '@comfyorg/account-core/firebaseAuthError'
import type {
  AuthErrorClassification,
  AuthErrorCopy
} from '@comfyorg/account-core/firebaseAuthError'

import type { Locale, TranslationKey } from '../i18n/translations'
import { t, translationKeys } from '../i18n/translations'

export type AuthSignInProvider = 'google' | 'github' | 'email'

export type AuthSignInState =
  | { readonly step: 'idle' }
  | { readonly step: 'pending'; readonly provider: AuthSignInProvider }
  /**
   * Pop-up dismissed, controls handed back, attempt still running and still
   * owning its outcome — Firebase can take 8-10s more and still answer with a
   * credential. Not `idle`: that would let the restore listener mint that
   * credential past the provisioning the attempt still has to run.
   */
  | { readonly step: 'detached'; readonly provider: AuthSignInProvider }
  | {
      readonly step: 'minting'
      readonly email: string
      readonly origin: 'interactive' | 'restored'
    }
  | {
      readonly step: 'error'
      readonly classification: AuthErrorClassification
    }
  | {
      readonly step: 'signedIn'
      readonly email: string
      readonly messageKey?: TranslationKey
      readonly origin?: 'interactive' | 'restored'
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
  | { readonly type: 'signInAbandoned' }
  | { readonly type: 'signInDetached' }

const SUPPORT_EMAIL = 'support@comfy.org'

const AUTH_ERROR_PREFIX = 'auth.errors.'
const authErrorCodeKeys = translationKeys.filter(
  (key) =>
    key.startsWith(AUTH_ERROR_PREFIX) &&
    key !== 'auth.errors.generic' &&
    key !== 'auth.errors.signupBlocked'
)

/** This host's own auth-error table, keyed the way the package resolver reads it. */
function localizedAuthErrorCopy(locale: Locale): AuthErrorCopy {
  return {
    ...Object.fromEntries(
      authErrorCodeKeys.map((key) => [
        key.slice(AUTH_ERROR_PREFIX.length),
        t(key, locale)
      ])
    ),
    generic: t('auth.errors.generic', locale),
    signupBlocked: t('auth.errors.signupBlocked', locale)
  }
}

/**
 * The copy for a failed attempt, resolved from this host's own i18n. The
 * account package supplies the classification and resolution rules; the
 * strings live here. Only the unauthorized-domain line needs this host's
 * runtime values.
 */
export function signInErrorMessage(
  classification: AuthErrorClassification,
  locale: Locale,
  hostname: string
): string {
  return classification.kind === 'unauthorized-domain'
    ? t('toastMessages.unauthorizedDomain', locale)
        .replace('{domain}', hostname)
        .replace('{email}', SUPPORT_EMAIL)
    : authErrorMessage(classification, localizedAuthErrorCopy(locale))
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
      return { step: 'minting', email: event.email, origin: 'interactive' }
    case 'signInFailed':
      return { step: 'error', classification: classifyAuthError(event.error) }
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
        ? { step: 'minting', email: event.email, origin: 'restored' }
        : state
    case 'mintSucceeded':
      if (state.step === 'minting')
        return { step: 'signedIn', email: state.email, origin: state.origin }
      // A later refresh recovered the session: drop the stale failure banner.
      return state.step === 'signedIn' &&
        state.messageKey === 'auth.signIn.error.session'
        ? { step: 'signedIn', email: state.email, origin: state.origin }
        : state
    case 'mintFailed':
      return state.step === 'minting'
        ? {
            step: 'signedIn',
            email: state.email,
            messageKey: 'auth.signIn.error.session',
            origin: state.origin
          }
        : state
    case 'mintRetried':
      return state.step === 'signedIn' &&
        state.messageKey === 'auth.signIn.error.session'
        ? { step: 'minting', email: state.email, origin: 'interactive' }
        : state
    case 'signedOut':
      return state.step === 'pending' ||
        state.step === 'minting' ||
        state.step === 'detached'
        ? state
        : { step: 'idle' }
    case 'signInAbandoned':
      // Drop an attempt a flag flip invalidated; leave settled states alone.
      return state.step === 'pending' ||
        state.step === 'minting' ||
        state.step === 'detached'
        ? { step: 'idle' }
        : state
    case 'signInDetached':
      return state.step === 'pending'
        ? { step: 'detached', provider: state.provider }
        : state
  }
}
