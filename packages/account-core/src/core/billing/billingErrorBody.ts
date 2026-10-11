import { zErrorResponse } from '@comfyorg/ingest-types/zod'

import type { BillingServerCode } from './billingContracts.js'

/**
 * The `code` of a generated `ErrorResponse` body, or nothing. This decode is
 * the only place a `BillingServerCode` is minted, and the brand it carries is
 * erased at runtime.
 */
export function readBillingErrorCode(
  body: unknown
): BillingServerCode | undefined {
  const parsed = zErrorResponse.safeParse(body)
  return parsed.success ? (parsed.data.code as BillingServerCode) : undefined
}

/**
 * The `message` of a generated `ErrorResponse` body, or nothing when the body
 * is not that contract or the message is blank.
 */
export function readBillingErrorMessage(body: unknown): string | undefined {
  const parsed = zErrorResponse.safeParse(body)
  if (!parsed.success) return undefined
  const message = parsed.data.message.trim()
  return message === '' ? undefined : message
}
