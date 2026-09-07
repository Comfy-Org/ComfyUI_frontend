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

/**
 * English source copy for auth failures, extracted verbatim from the cloud
 * app's shipped strings (src/locales/en/main.json, auth.errors.*) so hosts
 * never invent independently worded copy for the same failure. Keyed by the
 * Firebase code, plus the two named fallbacks. The unauthorized-domain copy
 * stays host-side: it interpolates the host's own domain and support email.
 */
export const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled':
    'This account has been disabled. Please contact support.',
  'auth/user-not-found':
    'No account found with this email. Would you like to create a new account?',
  'auth/wrong-password':
    'The password you entered is incorrect. Please try again.',
  'auth/email-already-in-use':
    'An account with this email already exists. Try signing in instead.',
  'auth/weak-password':
    'Password is too weak. Please use a stronger password with at least 6 characters.',
  'auth/too-many-requests':
    'Too many login attempts. Please wait a moment and try again.',
  'auth/operation-not-allowed':
    'This sign-in method is not currently supported.',
  'auth/invalid-credential':
    'Invalid login credentials. Please check your email and password.',
  'auth/network-request-failed':
    'Network error. Please check your connection and try again.',
  'auth/popup-closed-by-user':
    'The sign-in window closed before sign-in finished. Please try again.',
  'auth/cancelled-popup-request':
    'Another sign-in window was already open, so this one was cancelled. Please try again.',
  'auth/popup-blocked':
    'Your browser blocked the sign-in window. Please allow pop-ups for this site and try again.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email address but uses a different sign-in method. Please sign in the way you did originally.',
  generic: 'Something went wrong while signing you in. Please try again.',
  signupBlocked:
    "We couldn't create your account right now. Please try again later. If this keeps happening, email support@comfy.org."
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
