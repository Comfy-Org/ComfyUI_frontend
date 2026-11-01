import type { BillingTelemetryFailure } from '@comfyorg/account-core/billing'

export class WorkspaceApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly failureCategory?: BillingTelemetryFailure['failure_category'],
    public readonly operation?: string
  ) {
    super(message)
    this.name = 'WorkspaceApiError'
  }
}

export const NO_WORKSPACE_ACCESS = 'no_workspace_access'

export const MEMBERSHIP_MANAGED_BY_DIRECTORY = 'membership_managed_by_directory'

export class NoWorkspaceAccessError extends WorkspaceApiError {
  constructor(message: string, status?: number, operation?: string) {
    super(message, status, NO_WORKSPACE_ACCESS, undefined, operation)
    this.name = 'NoWorkspaceAccessError'
  }
}
