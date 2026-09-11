import { AUTH_TOAST_SUMMARIES } from '@comfyorg/account/firebaseAuthError'
import type { AuthCopyLocale } from '@comfyorg/account/firebaseAuthError'

import type { Locale } from '../i18n/translations'
import { DEFAULT_LOCALE } from './locales'

function isAuthCopyLocale(value: Locale): value is AuthCopyLocale {
  return value in AUTH_TOAST_SUMMARIES
}

/**
 * The locale the shared auth copy is read in.
 *
 * `@comfyorg/account` carries auth copy for fewer locales than this site
 * serves, and the desktop app shares that package, so widening it is not this
 * site's call to make. A locale it has no copy for reads English rather than
 * indexing a map with no entry for it.
 *
 * Never what a reader sees in practice: `/login`, `/signup` and
 * `/forgot-password` are locale-invariant, so they are only ever served
 * unprefixed. This keeps the types honest about a gap that exists but does not
 * surface.
 */
export function authCopyLocale(locale: Locale): AuthCopyLocale {
  return isAuthCopyLocale(locale) ? locale : DEFAULT_LOCALE
}
