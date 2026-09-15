import { zErrorResponse } from '@comfyorg/ingest-types/zod'

/**
 * The `code` of a generated `ErrorResponse` body, or nothing. The body's
 * `message` is read by the schema and discarded here, so it cannot travel
 * further into the SDK.
 */
export function readBillingErrorCode(body: unknown): string | undefined {
  const parsed = zErrorResponse.safeParse(body)
  return parsed.success ? parsed.data.code : undefined
}
