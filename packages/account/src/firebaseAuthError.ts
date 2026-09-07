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
