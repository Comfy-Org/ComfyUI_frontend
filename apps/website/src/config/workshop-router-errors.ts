import type { FieldErrors } from './workshop-playground'
import type { RunFailure } from './workshop-run'

export type WorkshopFailureStage =
  | 'upload_grant'
  | 'upload_put'
  | 'example_download'
  | 'request'
  | 'response'

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
    options?: ErrorOptions
  ) {
    super(`Router request failed: ${reason}`, options)
  }
}
