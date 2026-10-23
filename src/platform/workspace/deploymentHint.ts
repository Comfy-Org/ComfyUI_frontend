import { getPreservedQueryParam } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'

/** The hint's value for Comfy Cloud; any other value but the one below is a deployment id. */
const COMFY_CLOUD = 'cloud'
/** The hint's value for Comfy Cloud when no listing has said so: one failed with no hint. */
const UNCONFIRMED_COMFY_CLOUD = 'cloud-unconfirmed'

/** What this browser's hint says its next boot in a workspace runs on (see `readDeploymentHint`). */
export type DeploymentHint = 'deployment' | 'cloud' | 'unconfirmed' | 'unknown'

function hintKey(workspaceId: string): string {
  return `${WORKSPACE_STORAGE_KEYS.DEPLOYMENT_HINT_PREFIX}${workspaceId}`
}

/**
 * What this browser's next boot in the workspace runs on, as its last
 * listing or its own switch recorded it: `deployment`, `cloud`,
 * `unconfirmed` when a listing failed before any answered (Comfy Cloud
 * unless a late listing names a deployment), or `unknown` when nothing is
 * recorded (a new profile, cleared storage, a browser that has not booted
 * since this shipped) or localStorage cannot be read. The server decides
 * from a cookie the page cannot read, so `unconfirmed` and `unknown` may
 * be either.
 */
export function readDeploymentHint(workspaceId: string | null): DeploymentHint {
  if (workspaceId === null) return 'unknown'
  try {
    const hint = localStorage.getItem(hintKey(workspaceId))
    if (hint === null) return 'unknown'
    if (hint === UNCONFIRMED_COMFY_CLOUD) return 'unconfirmed'
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

/** Records that this browser's next boot in the workspace runs on Comfy Cloud until a listing says otherwise. */
export function setUnconfirmedCloudHint(workspaceId: string): void {
  try {
    localStorage.setItem(hintKey(workspaceId), UNCONFIRMED_COMFY_CLOUD)
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
