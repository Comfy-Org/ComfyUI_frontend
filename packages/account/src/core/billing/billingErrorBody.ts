import { zErrorResponse } from '@comfyorg/ingest-types/zod'

import type { BillingServerCode } from './billingContracts.js'

/**
 * The `code` of a generated `ErrorResponse` body, or nothing. The body's
 * `message` is read by the schema and discarded here, so it cannot travel
 * further into the SDK. This decode is the only place a `BillingServerCode`
 * is minted, and the brand it carries is erased at runtime.
 */
export function readBillingErrorCode(
  body: unknown
): BillingServerCode | undefined {
  const parsed = zErrorResponse.safeParse(body)
  return parsed.success ? (parsed.data.code as BillingServerCode) : undefined
}
