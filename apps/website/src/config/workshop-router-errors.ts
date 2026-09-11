import type { FieldErrors } from './workshop-playground'
import type { RunFailure } from './workshop-run'

export class WorkshopRouterError extends Error {
  constructor(
    readonly reason: RunFailure,
    readonly requestId: string | null = null,
    readonly fieldErrors: FieldErrors = {}
  ) {
    super(`Router request failed: ${reason}`)
  }
}
