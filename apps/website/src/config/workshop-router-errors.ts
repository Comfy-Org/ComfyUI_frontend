import type { FieldErrors } from './workshop-playground'
import type { RunFailure } from './workshop-run'

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
    }
  ) {
    super(`Router request failed: ${reason}`)
  }
}
