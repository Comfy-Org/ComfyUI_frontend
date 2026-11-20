import type { BillingErrorCode } from '@comfyorg/account-core/billing'
import { reportError } from '@comfyorg/telemetry/reportError'

const SESSION_ENDED_CODES: ReadonlySet<BillingErrorCode> = new Set([
  'NOT_AUTHENTICATED',
  'SUPERSEDED'
])

/** Reports a failed saved payment methods read, except when the session ended or moved on under it. */
export function reportSavedPaymentMethodsReadFailure(
  code: BillingErrorCode,
  errorType: string
): void {
  if (SESSION_ENDED_CODES.has(code)) return
  reportError(new Error(`Saved payment methods read failed: ${code}`), {
    errorType,
    surface: 'billing'
  })
}
