import type { BillingOpOutcomeResponse } from '@comfyorg/ingest-types'
import { zGetBillingOpOutcomeResponse } from '@comfyorg/ingest-types/zod'

import type { BillingErrorCode } from './billingContracts'
import { operationRoute } from './operationLifecycle'
import { readValidatedBillingResponse } from './sharedRead'
import {
  DEFAULT_BILLING_TIMEOUT_MS,
  exchangeBillingRequest,
  startRequestBudget
} from './transportExchange'

export function operationOutcomeRoute(operationId: string): string {
  return `${operationRoute(operationId)}/outcome`
}

/** One read of how an operation ended: Cloud's answer, its refusal, or no usable answer. */
export type OperationOutcomeRead =
  | {
      readonly kind: 'outcome'
      readonly status: BillingOpOutcomeResponse['status']
    }
  | { readonly kind: 'refused' }
  | { readonly kind: 'unknown' }

export interface OperationOutcomeReadOptions {
  readonly operationId: string
  /** A scoped-session bearer. It goes to this route only, without cookies. */
  readonly token: string
  readonly resolveUrl: (route: string) => string
  readonly fetchImpl?: typeof fetch
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

const REFUSALS: readonly BillingErrorCode[] = ['ACCESS_DENIED', 'NOT_FOUND']

/** Reads how one operation ended with a scoped-session bearer alone, which Cloud honours for a while after that session expires. */
export async function readOperationOutcome(
  options: OperationOutcomeReadOptions
): Promise<OperationOutcomeRead> {
  const {
    operationId,
    token,
    resolveUrl,
    fetchImpl = fetch,
    signal,
    timeoutMs = DEFAULT_BILLING_TIMEOUT_MS
  } = options
  const budget = startRequestBudget(signal, timeoutMs)
  try {
    const read = await readValidatedBillingResponse(
      (request) =>
        exchangeBillingRequest(request, {
          fetchImpl,
          url: resolveUrl(request.route),
          signal: budget.signal,
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'omit'
        }),
      { method: 'GET', route: operationOutcomeRoute(operationId) },
      (body) => zGetBillingOpOutcomeResponse.safeParse(body)
    )
    if (read.status === 'ok')
      return { kind: 'outcome', status: read.value.data.status }
    return { kind: REFUSALS.includes(read.code) ? 'refused' : 'unknown' }
  } finally {
    budget.close()
  }
}
