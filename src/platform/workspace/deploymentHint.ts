import { getPreservedQueryParam } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'

/** The hint's value for Comfy Cloud; any other value is a deployment id. */
const COMFY_CLOUD = 'cloud'

function hintKey(workspaceId: string): string {
  return `${WORKSPACE_STORAGE_KEYS.DEPLOYMENT_HINT_PREFIX}${workspaceId}`
}

/**
 * What this browser's next boot in the workspace runs on, as its last
 * listing or its own switch recorded it: `deployment`, `cloud`, or
 * `unknown` when nothing is recorded (a new profile, cleared storage, a
 * browser that has not booted since this shipped) or localStorage cannot
 * be read. The server decides from a cookie the page cannot read, so
 * `unknown` may be either.
 */
export function readDeploymentHint(
  workspaceId: string | null
): 'deployment' | 'cloud' | 'unknown' {
  if (workspaceId === null) return 'unknown'
  try {
    const hint = localStorage.getItem(hintKey(workspaceId))
    if (hint === null) return 'unknown'
    return hint === COMFY_CLOUD ? 'cloud' : 'deployment'
  } catch {
    return 'unknown'
  }
}

/** Records the deployment this browser's next boot in the workspace runs on, or null for Comfy Cloud. */
export function setDeploymentHint(
  workspaceId: string,
  deploymentId: string | null
): void {
  try {
    localStorage.setItem(hintKey(workspaceId), deploymentId ?? COMFY_CLOUD)
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
