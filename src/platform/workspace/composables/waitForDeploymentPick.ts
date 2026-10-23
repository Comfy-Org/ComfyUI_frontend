import {
  DEPLOYMENT_LISTING_BACKSTOP_MS,
  DEPLOYMENT_LISTING_NO_HINT_WAIT_MS
} from '@/platform/workspace/api/deploymentListingTimeouts'
import type { DeploymentHint } from '@/platform/workspace/deploymentHint'
import {
  hasDeploymentLink,
  readDeploymentHint
} from '@/platform/workspace/deploymentHint'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

function bootHint(): DeploymentHint {
  if (hasDeploymentLink()) return 'deployment'
  return readDeploymentHint(useTeamWorkspaceStore().workspaceId)
}

/**
 * Whether this page may boot on a deployment: what the boot listing said
 * once it answered. Before that, false only when this browser's hint for
 * the active workspace says Comfy Cloud, confirmed, and no deployment link
 * opened the page; a hint that says a deployment, an unconfirmed Comfy
 * Cloud hint, or no hint at all, may be one.
 */
export function couldBootOnDeployment(): boolean {
  const { bootDeployment } = useDeploymentPickStore()
  if (bootDeployment !== undefined) return bootDeployment !== null
  return bootHint() !== 'cloud'
}

/** How long the boot waits for the listing: 45 s when a hint or link names a deployment, none when the hint is an unconfirmed Comfy Cloud, 5 s with no hint. */
function listingWaitMs(hint: DeploymentHint): number {
  if (hint === 'deployment') return DEPLOYMENT_LISTING_BACKSTOP_MS
  if (hint === 'unconfirmed') return 0
  return DEPLOYMENT_LISTING_NO_HINT_WAIT_MS
}

/**
 * Waits for the boot listing to say where this page runs, for `listingWaitMs`.
 * `onLateDeployment` runs when a listing that answers after that wait names a deployment, unless a hint or link named one.
 */
export async function waitForDeploymentPick(
  onLateDeployment: () => void = () => {}
): Promise<boolean> {
  const store = useDeploymentPickStore()
  const hint = bootHint()
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
        timeout = setTimeout(() => resolve(false), listingWaitMs(hint))
      })
    ])
    if (confirmed) return true
    store.bootOnComfyCloud()
    if (hint === 'deployment') return false
    void listing.then(() => {
      if (store.pickedDeployment !== null) onLateDeployment()
    })
    return true
  } finally {
    clearTimeout(timeout)
  }
}
