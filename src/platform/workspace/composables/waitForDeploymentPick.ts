import {
  DEPLOYMENT_LISTING_BACKSTOP_MS,
  DEPLOYMENT_LISTING_NO_HINT_WAIT_MS
} from '@/platform/workspace/api/deploymentListingTimeouts'
import {
  hasDeploymentLink,
  readDeploymentHint
} from '@/platform/workspace/deploymentHint'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

function bootHint(): 'deployment' | 'cloud' | 'unknown' {
  if (hasDeploymentLink()) return 'deployment'
  return readDeploymentHint(useTeamWorkspaceStore().workspaceId)
}

/**
 * Whether this page may boot on a deployment: what the boot listing said
 * once it answered. Before that, false only when this browser's hint for
 * the active workspace says Comfy Cloud and no deployment link opened the
 * page; a hint that says a deployment, or no hint at all, may be one.
 */
export function couldBootOnDeployment(): boolean {
  const { bootDeployment } = useDeploymentPickStore()
  if (bootDeployment !== undefined) return bootDeployment !== null
  return bootHint() !== 'cloud'
}

/**
 * Waits for the boot listing to say which deployment this page booted on,
 * so the editor offers that deployment's models. True when it said so
 * (Comfy Cloud included), and at once on Comfy Cloud's models when this
 * browser last booted on Comfy Cloud and no link names a deployment
 * (`couldBootOnDeployment`). With a hint or a link naming a deployment it
 * waits at most `DEPLOYMENT_LISTING_BACKSTOP_MS`, and is false when the
 * listing failed after its retries or did not answer in time. With no hint
 * it waits at most `DEPLOYMENT_LISTING_NO_HINT_WAIT_MS` and is true either
 * way; `onLateDeployment` runs if a listing that answers after that names a
 * deployment. Whenever the listing did not say, the page boots on Comfy
 * Cloud's models (`bootOnComfyCloud`).
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
        timeout = setTimeout(
          () => resolve(false),
          hint === 'deployment'
            ? DEPLOYMENT_LISTING_BACKSTOP_MS
            : DEPLOYMENT_LISTING_NO_HINT_WAIT_MS
        )
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
