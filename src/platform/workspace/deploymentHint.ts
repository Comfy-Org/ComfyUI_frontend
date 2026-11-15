import { getPreservedQueryParam } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'

const COMFY_CLOUD = 'cloud'

/** Where this browser's next boot in a workspace runs, per its hint. */
export type DeploymentHint = 'deployment' | 'cloud' | 'unconfirmed' | 'unknown'

function hintKey(workspaceId: string): string {
  return `${WORKSPACE_STORAGE_KEYS.DEPLOYMENT_HINT_PREFIX}${workspaceId}`
}

function unconfirmedCloudKey(workspaceId: string): string {
  return `${WORKSPACE_STORAGE_KEYS.UNCONFIRMED_CLOUD_HINT_PREFIX}${workspaceId}`
}

/** Reads this browser's deployment hint for the workspace; `unknown` when none is recorded or storage is unreadable. */
export function readDeploymentHint(workspaceId: string | null): DeploymentHint {
  if (workspaceId === null) return 'unknown'
  try {
    const hint = localStorage.getItem(hintKey(workspaceId))
    if (hint !== null) return hint === COMFY_CLOUD ? 'cloud' : 'deployment'
    return localStorage.getItem(unconfirmedCloudKey(workspaceId)) === null
      ? 'unknown'
      : 'unconfirmed'
  } catch {
    return 'unknown'
  }
}

/** Records the workspace's next boot target (null for Comfy Cloud), clearing any unconfirmed hint. */
export function setDeploymentHint(
  workspaceId: string,
  deploymentId: string | null
): void {
  try {
    localStorage.setItem(hintKey(workspaceId), deploymentId ?? COMFY_CLOUD)
    localStorage.removeItem(unconfirmedCloudKey(workspaceId))
  } catch {
    console.warn('Failed to persist the deployment hint')
  }
}

/** Records Comfy Cloud as the workspace's next boot target until a listing says otherwise. */
export function setUnconfirmedCloudHint(workspaceId: string): void {
  try {
    localStorage.setItem(unconfirmedCloudKey(workspaceId), '1')
  } catch {
    console.warn('Failed to persist the deployment hint')
  }
}

/** True when the page was opened from a deployment link, in its URL or stashed across sign-in. */
export function hasDeploymentLink(): boolean {
  return (
    new URLSearchParams(window.location.search).has('deployment') ||
    getPreservedQueryParam(
      PRESERVED_QUERY_NAMESPACES.DEPLOYMENT,
      'deployment'
    ) !== undefined
  )
}
