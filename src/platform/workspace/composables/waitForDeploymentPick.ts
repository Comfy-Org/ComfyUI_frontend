import { DEPLOYMENT_LISTING_BACKSTOP_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import {
  hasDeploymentHint,
  hasDeploymentLink
} from '@/platform/workspace/deploymentHint'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

/**
 * Whether this page may boot on a deployment: what the boot listing said
 * once it answered, before that a deployment link or this browser's hint
 * for the active workspace.
 */
export function couldBootOnDeployment(): boolean {
  const { bootDeployment } = useDeploymentPickStore()
  if (bootDeployment !== undefined) return bootDeployment !== null
  const { workspaceId } = useTeamWorkspaceStore()
  return hasDeploymentLink() || hasDeploymentHint(workspaceId)
}

/**
 * Waits, at most `DEPLOYMENT_LISTING_BACKSTOP_MS`, for the boot listing to
 * say which deployment this page booted on, so the editor offers that
 * deployment's models. True when it said so (Comfy Cloud included), and at
 * once on Comfy Cloud's models when the page cannot be on a deployment
 * (`couldBootOnDeployment`). False when it failed after its retries or did
 * not answer in time: the page then boots on Comfy Cloud's models
 * (`bootOnComfyCloud`).
 */
export async function waitForDeploymentPick(): Promise<boolean> {
  const store = useDeploymentPickStore()
  if (!couldBootOnDeployment()) {
    store.bootOnComfyCloud()
    return true
  }
  const listing = store.loadOnce()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const confirmed = await Promise.race([
      listing.then(() => store.bootDeployment !== undefined),
      new Promise<false>((resolve) => {
        timeout = setTimeout(
          () => resolve(false),
          DEPLOYMENT_LISTING_BACKSTOP_MS
        )
      })
    ])
    if (!confirmed) store.bootOnComfyCloud()
    return confirmed
  } finally {
    clearTimeout(timeout)
  }
}
