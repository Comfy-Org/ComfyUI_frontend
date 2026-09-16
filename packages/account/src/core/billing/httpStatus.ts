/**
 * The one place a billing HTTP status becomes a code. The transport
 * deliberately returns an answer of any status as `ok`, so that every typed
 * operation maps status the same way instead of each inventing its own.
 */
import type {
  BillingErrorCode,
  BillingHttpResponse
} from './billingContracts.js'

export function codeForHttpStatus(
  response: Pick<
    BillingHttpResponse,
    'httpStatus' | 'authenticationRetrySkipped'
  >
): BillingErrorCode {
  const status = response.httpStatus
  // A 401 the transport re-minted and retried is a real refusal. One it had
  // to leave alone, because the write was not replayable, says only that the
  // token had gone stale; the caller's next attempt mints a fresh one, so it
  // joins the transient bucket rather than reading as a permanent denial.
  if (status === 401 && response.authenticationRetrySkipped) {
    return 'REQUEST_FAILED'
  }
  if (status === 401 || status === 403) return 'ACCESS_DENIED'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  // 5xx joins the transient bucket with the network failures the transport
  // already reports there: one retryable failure for a caller, not several.
  return 'REQUEST_FAILED'
}
