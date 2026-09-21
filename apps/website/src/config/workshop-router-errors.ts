import type { FieldErrors } from './workshop-playground'
import type { RunFailure } from './workshop-run'

export type WorkshopFailureStage =
  | 'upload_grant'
  | 'upload_put'
  | 'example_download'
  | 'request'
  | 'response'

export type WorkshopRequestSettlement = 'pending' | 'terminal'

interface WorkshopRouterErrorOptions extends ErrorOptions {
  readonly requestSettlement?: WorkshopRequestSettlement
}

export function workshopResponseDetails(response: Response, body = '') {
  return {
    status: response.status,
    errorType: response.headers.get('X-Comfy-Error-Type'),
    retryAfter: response.headers.get('Retry-After'),
    concurrencyLimit: response.headers.get('X-Concurrency-Limit'),
    concurrencyCurrent: response.headers.get('X-Concurrency-Current'),
    concurrencyRemaining: response.headers.get('X-Concurrency-Remaining'),
    body
  }
}

export class WorkshopRouterError extends Error {
  readonly requestSettlement?: WorkshopRequestSettlement

  constructor(
    readonly reason: RunFailure,
    readonly requestId: string | null = null,
    readonly fieldErrors: FieldErrors = {},
    readonly response?: {
      readonly status: number
      readonly errorType: string | null
      readonly retryAfter: string | null
      readonly concurrencyLimit: string | null
      readonly concurrencyCurrent: string | null
      readonly concurrencyRemaining: string | null
      readonly body: string
    },
    readonly stage?: WorkshopFailureStage,
    options?: WorkshopRouterErrorOptions
  ) {
    super(`Router request failed: ${reason}`, options)
    this.requestSettlement = options?.requestSettlement
  }
}

export function workshopRunMayStillSettle(
  failure: WorkshopRouterError
): boolean {
  if (failure.requestSettlement) return failure.requestSettlement === 'pending'
  if (['network', 'response', 'conflict'].includes(failure.reason)) return true
  return (
    failure.reason === 'timeout' &&
    (!failure.response || failure.stage === 'response')
  )
}
