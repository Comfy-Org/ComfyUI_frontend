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

/** Whether this page may boot on a deployment: the boot listing's answer, else false only for a confirmed Comfy Cloud hint. */
export function couldBootOnDeployment(): boolean {
  const { bootDeployment } = useDeploymentPickStore()
  if (bootDeployment !== undefined) return bootDeployment !== null
  return bootHint() !== 'cloud'
}

function listingWaitMs(hint: DeploymentHint): number {
  if (hint === 'deployment') return DEPLOYMENT_LISTING_BACKSTOP_MS
  if (hint === 'unconfirmed') return 0
  return DEPLOYMENT_LISTING_NO_HINT_WAIT_MS
}

/** Waits for the boot listing to say where this page runs; `onLateDeployment` runs if a late listing names a deployment. */
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
