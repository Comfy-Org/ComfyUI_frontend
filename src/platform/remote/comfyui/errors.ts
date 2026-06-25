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
  if (typeof body === 'string') {
    return {
      code: UNKNOWN_ERROR_CODE,
      message: body.trim() !== '' ? body : fallbackMessage
    }
  }
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

/** Parse JSON when possible, otherwise surface the raw text. */
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
  const text = await response.text().catch(() => '')
  return errorResponseFromBody(parseJsonOrText(text), fallbackMessage)
}
