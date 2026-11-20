import type {
  AddCreditsPendingTopup,
  BillingAuthenticationState,
  HostedTopupCheckoutFailure
} from '@comfyorg/account-core/billing'
import { readBillingErrorCode } from '@comfyorg/account-core/billing'

import type { ProcessingTopupPayment } from '@/platform/billing/processingTopupPayment'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'

interface PendingTopupOperation {
  readonly status: string
  readonly actionUrl: string | null
  readonly authenticationState: BillingAuthenticationState | null
}

/** The open top-up the dialog shows up front, from either rail's operation and the processing checkout read. */
export function addCreditsPendingTopup(
  operation: PendingTopupOperation | null | undefined,
  processing: ProcessingTopupPayment | null
): AddCreditsPendingTopup | undefined {
  if (
    operation?.authenticationState === 'failed_retryable' ||
    operation?.status === 'reconciliation_needed'
  ) {
    return { kind: 'not_verified' }
  }
  if (operation?.actionUrl) {
    return { kind: 'needs_verification', verifyUrl: operation.actionUrl }
  }
  if (!processing) return undefined
  return processing.paymentAmountCents === null
    ? { kind: 'processing' }
    : { kind: 'processing', amountCents: processing.paymentAmountCents }
}

/** A checkout the app's rails threw for, back in the SDK's failure shape. */
export function topupCheckoutFailure(
  error: unknown
): HostedTopupCheckoutFailure {
  if (!(error instanceof WorkspaceApiError)) {
    return { status: 'error', code: 'REQUEST_FAILED' }
  }
  const serverCode =
    error.code === undefined
      ? undefined
      : readBillingErrorCode({ code: error.code, message: error.message })
  return {
    status: 'error',
    code: error.status === 403 ? 'ACCESS_DENIED' : 'REQUEST_FAILED',
    ...(error.status === undefined ? {} : { httpStatus: error.status }),
    ...(serverCode === undefined ? {} : { serverCode }),
    ...(error.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: error.retryAfterSeconds })
  }
}
