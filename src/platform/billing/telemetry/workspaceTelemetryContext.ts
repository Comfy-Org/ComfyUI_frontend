import { onScopeDispose, watch } from 'vue'

import { webSessionUser } from '@/platform/auth/session/webSessionUser'
import { useTelemetry } from '@comfyorg/telemetry'
import type { WorkspaceTelemetryContext } from '@comfyorg/telemetry/types'
import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'
import { useWorkspaceBillingStateStore } from '@/platform/billing/stores/workspaceBillingStateStore'

const reportedScopeMismatches = new Set<string>()

/** Undefined until a workspace is selected. Reactive when read in an effect. */
export function getWorkspaceTelemetryContext():
  | WorkspaceTelemetryContext
  | undefined {
  const workspace = useWorkspaceIdentity().activeWorkspace
  if (!workspace) return undefined
  return {
    workspace_id: workspace.id,
    workspace_type: workspace.type,
    workspace_role: workspace.role,
    workspace_tier:
      useWorkspaceBillingStateStore().activeSummary?.subscriptionTier ?? null,
    auth_rail: webSessionUser.value ? 'web_session' : 'token'
  }
}

export function syncWorkspaceTelemetryContext(): void {
  watch(
    getWorkspaceTelemetryContext,
    (context) => useTelemetry()?.setWorkspaceContext(context),
    { immediate: true }
  )
  onScopeDispose(() => useTelemetry()?.setWorkspaceContext(undefined))
}

export function reportWorkspaceScopeMismatch(
  requestedWorkspaceId: string,
  resolvedWorkspaceId: string
): void {
  const context = getWorkspaceTelemetryContext()
  if (context?.workspace_id !== requestedWorkspaceId) return
  const key = JSON.stringify([requestedWorkspaceId, resolvedWorkspaceId])
  if (reportedScopeMismatches.has(key)) return
  reportedScopeMismatches.add(key)

  const resolved = useWorkspaceIdentity().workspaces.find(
    (workspace) => workspace.id === resolvedWorkspaceId
  )
  useTelemetry()?.trackWorkspaceScopeMismatch({
    ...context,
    resolved_workspace_id: resolvedWorkspaceId,
    resolved_workspace_type: resolved?.type ?? 'unknown'
  })
}
