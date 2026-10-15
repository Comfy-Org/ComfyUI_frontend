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
    public readonly failureCategory?: BillingTelemetryFailure['failure_category'],
    /** The `workspaceApi` method that failed, or the one an SDK-rail read replaces. */
    public readonly operation?: string
  ) {
    super(message)
    this.name = 'WorkspaceApiError'
  }
}

/** Ingest's 403 code for an account left with no workspace. */
export const NO_WORKSPACE_ACCESS = 'no_workspace_access'

/** `AcceptWorkspaceInviteErrors` 403 code, named in the spec prose only. */
export const MEMBERSHIP_MANAGED_BY_DIRECTORY = 'membership_managed_by_directory'

/** The account can enter no workspace: ingest refused with `no_workspace_access`, or listed none. */
export class NoWorkspaceAccessError extends WorkspaceApiError {
  constructor(message: string, status?: number, operation?: string) {
    super(message, status, NO_WORKSPACE_ACCESS, undefined, operation)
    this.name = 'NoWorkspaceAccessError'
  }
}
