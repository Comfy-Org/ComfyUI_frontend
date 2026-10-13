import type { AuthTypeNotAllowedError } from '@comfyorg/ingest-types'
import {
  zAuthTypeNotAllowedError,
  zErrorResponse
} from '@comfyorg/ingest-types/zod'

export const AUTH_REJECTION_STATUSES = [401, 403] as const
export type AuthRejectionStatus = (typeof AUTH_REJECTION_STATUSES)[number]

export function isAuthRejectionStatus(
  status: number
): status is AuthRejectionStatus {
  return AUTH_REJECTION_STATUSES.some((rejection) => rejection === status)
}

const OTHER = 'other'
type Other = typeof OTHER

/**
 * Backend values are reported only when they are on these lists, and anything
 * else is `other`: the backend text is uncontrolled and can carry user,
 * workspace or key identifiers, and an open value space would make the tags
 * unbounded in cardinality. The generated ingest types describe these codes in
 * prose only, so this is the one place they are listed.
 */
export const KNOWN_AUTH_REFUSAL_CODES = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'csrf_invalid',
  'workspace_access_denied',
  'workspace_id_invalid',
  'origin_not_allowed',
  'cross_site_request'
] as const
export const KNOWN_ACCEPTED_AUTH_METHODS = ['bearer_jwt', 'x_api_key'] as const

/** Message phrases for the plain `{ error: string }` shape, which has no code. */
const REASON_PHRASES = [
  {
    phrase: 'authentication method not allowed',
    reason: 'auth_method_not_allowed'
  }
] as const

export const MAX_REASON_TEXT_LENGTH = 500
export const MAX_ACCEPTED_METHODS = 8

type AuthRefusalCode = (typeof KNOWN_AUTH_REFUSAL_CODES)[number] | Other
type AcceptedAuthMethod = (typeof KNOWN_ACCEPTED_AUTH_METHODS)[number] | Other
type AuthRejectionReason = (typeof REASON_PHRASES)[number]['reason'] | Other

interface BackendFields {
  reason: AuthRejectionReason
  errorType: AuthTypeNotAllowedError['error']['type']
  errorCode: AuthRefusalCode
}

/** Tags describing the backend's refusal: `backendReason`, `backendErrorType`, ... */
export type AuthRejectionTags = {
  [K in keyof BackendFields as `backend${Capitalize<K>}`]?: BackendFields[K]
} & { acceptedMethods?: string }

function isOneOf<T extends string>(
  known: readonly T[],
  value: string
): value is T {
  return known.some((entry) => entry === value)
}

function reasonOf(text: string): AuthRejectionReason | undefined {
  const bounded = text.slice(0, MAX_REASON_TEXT_LENGTH).toLowerCase()
  if (bounded.trim().length === 0) return undefined
  return (
    REASON_PHRASES.find(({ phrase }) => bounded.includes(phrase))?.reason ??
    OTHER
  )
}

function codeOf(code: string): AuthRefusalCode {
  return isOneOf(KNOWN_AUTH_REFUSAL_CODES, code) ? code : OTHER
}

function acceptedMethodsOf(accepted: readonly string[]): string | undefined {
  const methods = accepted
    .slice(0, MAX_ACCEPTED_METHODS)
    .map(
      (method): AcceptedAuthMethod =>
        isOneOf(KNOWN_ACCEPTED_AUTH_METHODS, method) ? method : OTHER
    )
  return methods.length > 0 ? [...new Set(methods)].join(',') : undefined
}

/**
 * The tags that tell an auth refusal's causes apart, taken from the ingest
 * error shapes (`AuthTypeNotAllowedError`, `ErrorResponse`) or, for a body in
 * neither, from the already-extracted message. Pure and total: any input
 * yields a (possibly empty) tag set, and no value is copied from the response.
 */
export function authRejectionTags(
  body: unknown,
  message: string
): AuthRejectionTags {
  const notAllowed = zAuthTypeNotAllowedError.safeParse(body).data
  const refusal = zErrorResponse.safeParse(body).data
  const reason = reasonOf(refusal?.message ?? message)
  const acceptedMethods = notAllowed && acceptedMethodsOf(notAllowed.accepted)
  return {
    ...(reason && { backendReason: reason }),
    ...(notAllowed && { backendErrorType: notAllowed.error.type }),
    ...(refusal && { backendErrorCode: codeOf(refusal.code) }),
    ...(acceptedMethods && { acceptedMethods })
  }
}
