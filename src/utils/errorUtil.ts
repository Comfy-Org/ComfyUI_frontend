import type { ErrorResponse } from '@comfyorg/ingest-types'

/** Code reported when an error payload carries no machine-readable code. */
const UNKNOWN_ERROR_CODE = 'UNKNOWN_ERROR'

/**
 * Coerce an already-parsed error body into the canonical
 * `ErrorResponse { code, message, details? }` shape.
 *
 * The API emits this shape for all error responses; this helper is the
 * single place that tolerates legacy/partial payloads (missing `code`,
 * missing `message`, non-object bodies) so call sites never shape-sniff.
 *
 * @param body - The parsed response body (any JSON value, or `undefined`)
 * @param fallbackMessage - Used when the body carries no usable message
 */
export function errorResponseFromBody(
  body: unknown,
  fallbackMessage: string
): ErrorResponse {
  const record =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {}
  const code =
    typeof record.code === 'string' && record.code !== ''
      ? record.code
      : UNKNOWN_ERROR_CODE
  const message =
    typeof record.message === 'string' && record.message !== ''
      ? record.message
      : fallbackMessage
  const details =
    typeof record.details === 'object' &&
    record.details !== null &&
    !Array.isArray(record.details)
      ? (record.details as Record<string, unknown>)
      : undefined
  return details !== undefined ? { code, message, details } : { code, message }
}

/**
 * Parse a failed HTTP `Response` into the canonical
 * `ErrorResponse { code, message, details? }` shape.
 *
 * Never throws: non-JSON bodies and legacy payloads degrade to a
 * status-derived message and the `UNKNOWN_ERROR` code.
 */
export async function parseErrorResponse(
  response: Response
): Promise<ErrorResponse> {
  const body: unknown = await response.json().catch(() => undefined)
  return errorResponseFromBody(
    body,
    response.statusText || `HTTP ${response.status}`
  )
}

/**
 * Narrow an unknown caught value to an Error.
 *
 * Replaces unsafe `value as Error` assertions. When `value` is not already
 * an Error instance, wraps it in a new Error whose message is the stringified
 * input so downstream consumers (loggers, Sentry, toasts) always receive a
 * usable Error object instead of `undefined.message`.
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value
  if (typeof value === 'string') return new Error(value)
  if (value === undefined) return new Error('undefined')
  try {
    const serialised = JSON.stringify(value)
    return new Error(serialised ?? String(value))
  } catch {
    return new Error(String(value))
  }
}

/**
 * Extract a message from an unknown caught value without asserting its type.
 * Returns `undefined` when the value carries no usable message.
 */
export function getErrorMessage(value: unknown): string | undefined {
  if (value instanceof Error) return value.message
  if (typeof value === 'string') return value
  if (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as { message: unknown }).message === 'string'
  ) {
    return (value as { message: string }).message
  }
  return undefined
}
