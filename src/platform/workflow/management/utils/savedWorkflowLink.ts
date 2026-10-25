import { isWorkspaceId } from '@comfyorg/account-core/workspaceLink'
import { validate as isUuid } from 'uuid'
import type { LocationQueryRaw } from 'vue-router'

type SavedWorkflowLink =
  | { status: 'absent' }
  | { status: 'invalid' }
  | {
      status: 'valid'
      workflowId: string
      workspaceId: string | null
      deploymentId: string | null
      environment: 'standard' | null
    }

export function readSavedWorkflowLink(
  query: LocationQueryRaw
): SavedWorkflowLink {
  if (query.workflow === undefined) return { status: 'absent' }
  if (typeof query.workflow !== 'string' || !isUuid(query.workflow)) {
    return { status: 'invalid' }
  }

  const workspaceId = query.workspace === undefined ? null : query.workspace
  const deploymentId = query.deployment === undefined ? null : query.deployment
  const environment = query.environment === undefined ? null : query.environment
  if (
    query.environment === null ||
    (environment !== null && environment !== 'standard') ||
    (environment !== null && (!workspaceId || deploymentId !== null))
  ) {
    return { status: 'invalid' }
  }
  if (
    workspaceId !== null &&
    (typeof workspaceId !== 'string' || !isWorkspaceId(workspaceId))
  ) {
    return { status: 'invalid' }
  }
  if (query.workspace === null || query.deployment === null) {
    return { status: 'invalid' }
  }
  if (
    deploymentId !== null &&
    (typeof deploymentId !== 'string' ||
      !isWorkspaceId(deploymentId) ||
      !workspaceId)
  ) {
    return { status: 'invalid' }
  }

  return {
    status: 'valid',
    workflowId: query.workflow,
    workspaceId,
    deploymentId,
    environment
  }
}
