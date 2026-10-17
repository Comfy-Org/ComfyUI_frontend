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

import { DEFAULT_LOCALE } from '@/config/locales'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

export type AuthSignInProvider = 'google' | 'github' | 'email'

export type AuthSignInState =
  | { readonly step: 'idle' }
  | { readonly step: 'pending'; readonly provider: AuthSignInProvider }
  /** Leaving for Cloud's SSO start; held until the page unloads. */
  | { readonly step: 'redirecting' }
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
  | { readonly type: 'ssoRedirected' }

const SUPPORT_EMAIL = 'support@comfy.org'

const authErrorCodes = Object.keys(
  translationsFor(DEFAULT_LOCALE).tm('auth.errors')
).filter((code) => code !== 'generic' && code !== 'signupBlocked')

/** This host's own auth-error table, keyed the way the package resolver reads it. */
function localizedAuthErrorCopy(locale: Locale): AuthErrorCopy {
  const { t } = translationsFor(locale)
  return {
    ...Object.fromEntries(
      authErrorCodes.map((code) => [code, t(`auth.errors.${code}`)])
    ),
    generic: t('auth.errors.generic'),
    signupBlocked: t('auth.errors.signupBlocked')
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
  const { t } = translationsFor(locale)
  return classification.kind === 'unauthorized-domain'
    ? t('toastMessages.unauthorizedDomain', {
        domain: hostname,
        email: SUPPORT_EMAIL
      })
    : authErrorMessage(classification, localizedAuthErrorCopy(locale))
}

/** An attempt the page must not start over, sign out under, or remount during. */
export function isAttemptInFlight(state: AuthSignInState): boolean {
  return (
    state.step === 'pending' ||
    state.step === 'minting' ||
    state.step === 'redirecting'
  )
}

export function authSignInTransition(
  state: AuthSignInState,
  event: AuthSignInEvent
): AuthSignInState {
  switch (event.type) {
    case 'signInStarted':
      // One popup at a time: a second click while pending changes nothing.
      return isAttemptInFlight(state)
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
      return isAttemptInFlight(state) ? state : { step: 'idle' }
    case 'signInAbandoned':
      // Drop an attempt a flag flip invalidated, or an SSO redirect the
      // back-forward cache restored; leave settled states alone.
      return isAttemptInFlight(state) ? { step: 'idle' } : state
    case 'ssoRedirected':
      return state.step === 'pending' ? { step: 'redirecting' } : state
  }
}
