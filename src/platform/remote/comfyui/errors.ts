import { isPlainObject } from 'es-toolkit'

import type { ErrorResponse } from '@comfyorg/ingest-types'

/** Code reported when an error payload carries no machine-readable code. */
const UNKNOWN_ERROR_CODE = 'UNKNOWN_ERROR'

/**
 * Upper bound on a raw non-JSON body surfaced as the user-facing message.
 * Short text/plain proxy errors (e.g. "upstream connect error") stay useful;
 * oversized bodies (e.g. a full HTML gateway page) degrade to the clean
 * status-derived fallback instead of dumping markup into a toast.
 */
const MAX_RAW_MESSAGE_LENGTH = 500

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
    const usable = trimmed !== '' && trimmed.length <= MAX_RAW_MESSAGE_LENGTH
    return {
      code: UNKNOWN_ERROR_CODE,
      message: usable ? body : fallbackMessage
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
 */
export async function parseErrorResponse(
  response: Response
): Promise<ErrorResponse> {
  const fallbackMessage = response.statusText || `HTTP ${response.status}`
  const text = await response.text().catch((err: unknown) => {
    console.warn('parseErrorResponse: failed to read response body', err)
    return ''
  })
  return errorResponseFromBody(parseJsonOrText(text), fallbackMessage)
}
