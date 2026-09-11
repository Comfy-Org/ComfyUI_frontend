/**
 * The one place a billing HTTP status becomes a code. The transport
 * deliberately returns an answer of any status as `ok`, so that every typed
 * operation maps status the same way instead of each inventing its own.
 */
import type { BillingErrorCode } from './billingContracts.js'

export function codeForHttpStatus(status: number): BillingErrorCode {
  // A 401 only reaches here having already survived the transport's single
  // re-mint and retry, so it is a real refusal rather than an expired token.
  if (status === 401 || status === 403) return 'ACCESS_DENIED'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  // 5xx joins the transient bucket with the network failures the transport
  // already reports there: one retryable failure for a caller, not several.
  return 'REQUEST_FAILED'
}
