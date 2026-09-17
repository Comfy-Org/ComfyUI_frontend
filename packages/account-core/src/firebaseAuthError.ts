/**
 * Classification of Firebase Auth failures, shared so both hosts branch on
 * the same buckets. Typed structurally rather than via `instanceof
 * FirebaseError` so this package needs no firebase dependency — a host passes
 * whatever it caught and unknown shapes land in 'unknown'.
 */

export interface FirebaseAuthErrorLike {
  code: string
  message: string
}

/**
 * The user or their browser dismissed/blocked the popup — an outcome to warn
 * about and retry on a fresh gesture, never an app fault.
 */
const POPUP_DISMISSED_CODES: readonly string[] = [
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/popup-blocked'
]

/**
 * The origin is not on the Firebase authorized-domains list (or a continue
 * URI is unauthorized): auth cannot work here at all until configuration
 * changes, so the host should say so rather than offer a retry.
 */
const UNAUTHORIZED_DOMAIN_CODES: readonly string[] = [
  'auth/unauthorized-domain',
  'auth/invalid-dynamic-link-domain',
  'auth/unauthorized-continue-uri'
]

export type AuthErrorClassification =
  | { kind: 'unauthorized-domain'; code: string }
  | { kind: 'signup-blocked'; code: string }
  | { kind: 'popup-dismissed'; code: string }
  | { kind: 'auth'; code: string }
  | { kind: 'unknown' }

export function isFirebaseAuthErrorLike(
  error: unknown
): error is FirebaseAuthErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('auth/') &&
    'message' in error &&
    typeof error.message === 'string'
  )
}

export function classifyAuthError(error: unknown): AuthErrorClassification {
  if (!isFirebaseAuthErrorLike(error)) return { kind: 'unknown' }
  if (UNAUTHORIZED_DOMAIN_CODES.includes(error.code)) {
    return { kind: 'unauthorized-domain', code: error.code }
  }
  // Match on `error.message`, not `error.code`: Firebase `beforeUserCreated`
  // rejections collapse the thrown code into a generic `auth/internal-error`,
  // so the message is the only reliable channel. `signup_blocked` is a
  // cross-repo contract token; matched case-insensitively.
  if (error.message.toLowerCase().includes('signup_blocked')) {
    return { kind: 'signup-blocked', code: error.code }
  }
  if (POPUP_DISMISSED_CODES.includes(error.code)) {
    return { kind: 'popup-dismissed', code: error.code }
  }
  return { kind: 'auth', code: error.code }
}

export type AuthToastSeverity = 'error' | 'warn'

/**
 * The cloud app's toast-severity policy for classified auth failures: a
 * dismissed popup is the user changing their mind, not an application
 * error; everything else alarms.
 */
export function severityForAuthError(
  classification: AuthErrorClassification
): AuthToastSeverity {
  return classification.kind === 'popup-dismissed' ? 'warn' : 'error'
}

/**
 * A host's auth error table: Firebase codes mapped to that host's copy, plus
 * the two fallbacks every table must carry. Hosts build this from their own
 * i18n; the package ships no strings of its own.
 */
export type AuthErrorCopy = Readonly<Record<string, string>> & {
  readonly generic: string
  readonly signupBlocked: string
}

/** Resolved to the invalid-credential line whatever table is in play. */
const ENUMERATION_NEUTRAL_CODES: ReadonlySet<string> = new Set([
  'auth/user-not-found',
  'auth/wrong-password'
])

/**
 * The detail copy for a classified failure, resolved against the host copy:
 * a code the table knows gets its own line, anything else the generic line, a
 * blocked sign-up its named copy. The user-not-found / wrong-password pair
 * collapses to the invalid-credential line so a sign-in attempt can never
 * reveal whether an email has an account. Unauthorized domains need the
 * host's domain and support address, which the host interpolates itself.
 */
export function authErrorMessage(
  classification: AuthErrorClassification,
  copy: AuthErrorCopy
): string {
  switch (classification.kind) {
    case 'signup-blocked':
      return copy.signupBlocked
    case 'popup-dismissed':
    case 'auth':
      if (ENUMERATION_NEUTRAL_CODES.has(classification.code)) {
        return copy['auth/invalid-credential'] ?? copy.generic
      }
      return copy[classification.code] ?? copy.generic
    case 'unauthorized-domain':
    case 'unknown':
      return copy.generic
  }
}
