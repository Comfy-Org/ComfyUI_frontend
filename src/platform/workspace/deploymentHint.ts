import { getPreservedQueryParam } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'

function hintKey(workspaceId: string): string {
  return `${WORKSPACE_STORAGE_KEYS.DEPLOYMENT_HINT_PREFIX}${workspaceId}`
}

/** True when this browser last ran on a deployment in the workspace. */
export function hasDeploymentHint(workspaceId: string): boolean {
  try {
    return localStorage.getItem(hintKey(workspaceId)) !== null
  } catch {
    return false
  }
}

/** Records the deployment this browser's next boot in the workspace runs on, or null for Comfy Cloud. */
export function setDeploymentHint(
  workspaceId: string,
  deploymentId: string | null
): void {
  try {
    if (deploymentId === null) localStorage.removeItem(hintKey(workspaceId))
    else localStorage.setItem(hintKey(workspaceId), deploymentId)
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
