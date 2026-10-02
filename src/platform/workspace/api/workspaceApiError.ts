import type { BillingTelemetryFailure } from '@comfyorg/account-core/billing'

/**
 * A leaf module, so a subclass can be declared wherever the class is needed
 * without pulling the workspace client and its stores into the import graph.
 */
export class WorkspaceApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    /** For a failure `status` cannot classify, such as a billing SDK refusal. */
    public readonly failureCategory?: BillingTelemetryFailure['failure_category']
  ) {
    super(message)
    this.name = 'WorkspaceApiError'
  }
}
