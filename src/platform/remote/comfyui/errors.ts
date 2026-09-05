import { isPlainObject } from 'es-toolkit'

import type { ErrorResponse } from '@comfyorg/ingest-types'

/** Code reported when an error payload carries no machine-readable code. */
export const UNKNOWN_ERROR_CODE = 'UNKNOWN_ERROR'

/**
 * Upper bound on a raw non-JSON body surfaced as the user-facing message.
 * Short text/plain proxy errors (e.g. "upstream connect error") stay useful;
 * oversized bodies (e.g. a full HTML gateway page) degrade to the clean
 * status-derived fallback instead of dumping markup into a toast.
 */
const MAX_RAW_MESSAGE_LENGTH = 500

/**
 * A body opening with a tag or an XML declaration (`<?xml`, as S3/GCS error
 * documents do) is a markup document, never a usable message — however short
 * the page happens to be. Anchored so prose that merely mentions a bracketed
 * token (e.g. "connection to <backend-01> refused") still surfaces.
 */
const MARKUP_DOCUMENT = /^<[a-z!/?]/i

/**
 * A string body opening a JSON container only reaches here when parsing
 * failed, so it is a truncated or corrupt machine payload (e.g.
 * `{"code":"RATE_LIMITED","mess`), never prose worth showing.
 */
const UNPARSED_JSON_DOCUMENT = /^[{[]/

/**
 * Coerce an already-parsed error body into the canonical
 * `ErrorResponse { code, message, details? }` shape.
 *
 * The API emits this shape for all error responses; this helper is the
 * single place that tolerates legacy/partial flat `ErrorResponse` payloads
 * (missing `code`, missing `message`, non-object bodies) so call sites never
 * shape-sniff. Nested/domain error envelopes (e.g. `PromptExecutionError`)
 * are out of scope.
 *
 * @param body - The parsed response body (any JSON value, or `undefined`)
 * @param fallbackMessage - Used when the body carries no usable message
 */
export function errorResponseFromBody(
  body: unknown,
  fallbackMessage: string
): ErrorResponse {
  if (typeof body === 'string') {
    const trimmed = body.trim()
    const usable =
      trimmed !== '' &&
      trimmed.length <= MAX_RAW_MESSAGE_LENGTH &&
      !MARKUP_DOCUMENT.test(trimmed) &&
      !UNPARSED_JSON_DOCUMENT.test(trimmed)
    return {
      code: UNKNOWN_ERROR_CODE,
      message: usable ? trimmed : fallbackMessage
    }
  }
  const record: Record<PropertyKey, unknown> = isPlainObject(body) ? body : {}
  const code =
    typeof record.code === 'string' && record.code !== ''
      ? record.code
      : UNKNOWN_ERROR_CODE
  const message =
    typeof record.message === 'string' && record.message !== ''
      ? record.message
      : fallbackMessage
  const details = isPlainObject(record.details) ? record.details : undefined
  return details !== undefined ? { code, message, details } : { code, message }
}

/**
 * Parse JSON when possible, otherwise surface the raw text. A blank or
 * whitespace-only body yields `undefined` so callers fall through to a
 * status-derived fallback.
 */
function parseJsonOrText(text: string): unknown {
  if (text.trim() === '') return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Parse a failed HTTP `Response` into the canonical
 * `ErrorResponse { code, message, details? }` shape.
 *
 * Never throws: the body is read as text and JSON-parsed when possible, so
 * plain-text error bodies (e.g. from a proxy) survive as the message. Empty
 * or unreadable bodies degrade to a status-derived message and the
 * `UNKNOWN_ERROR` code.
 *
 * @param response - The failed response
 * @param fallbackMessage - Used when the body carries no usable message.
 * Defaults to a status-derived string; pass an operation-specific message
 * when the call site has more useful context than `502 Bad Gateway`.
 */
export async function parseErrorResponse(
  response: Response,
  fallbackMessage: string = response.statusText || `HTTP ${response.status}`
): Promise<ErrorResponse> {
  const text = await response.text().catch((err: unknown) => {
    console.warn('parseErrorResponse: failed to read response body', err)
    return ''
  })
  return errorResponseFromBody(parseJsonOrText(text), fallbackMessage)
}
