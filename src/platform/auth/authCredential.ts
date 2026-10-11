import type {
  ApiKeyAuthHeader,
  AuthCredential,
  AuthHeader,
  LoggedInAuthHeader
} from '@/types/authTypes'

const HEADER_CREDENTIAL = {
  Authorization: 'bearer',
  'X-API-KEY': 'api-key'
} as const satisfies Record<
  keyof LoggedInAuthHeader | keyof ApiKeyAuthHeader,
  AuthCredential
>

/** The credential kind an auth header carries; `none` when it carries neither. */
export function authCredentialOf(header: AuthHeader | null): AuthCredential {
  if (header === null) return 'none'
  const headerKey = Object.keys(HEADER_CREDENTIAL).find((key) => key in header)
  return headerKey === undefined
    ? 'none'
    : HEADER_CREDENTIAL[headerKey as keyof typeof HEADER_CREDENTIAL]
}

/**
 * Delivers a credential kind to a diagnostics callback without letting the
 * callback affect the request: telemetry must fail open.
 */
export function notifyAuthCredential(
  callback: ((credential: AuthCredential) => void) | undefined,
  credential: AuthCredential
): void {
  try {
    callback?.(credential)
  } catch (error) {
    console.warn('onAuthCredential callback failed:', error)
  }
}
