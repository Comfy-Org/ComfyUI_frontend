import { DEPLOYMENT_LISTING_EXTENSIONS_WAIT_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import { waitForDeploymentListing } from '@/platform/workspace/composables/waitForDeploymentPick'
import { openDeployCustomNodesDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import { NEW_DEPLOYMENT_FROM_NODES } from '@/platform/workspace/platformFrame/platformFrameWaysIn'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

export async function openCloudExtensions(): Promise<boolean> {
  await waitForDeploymentListing(DEPLOYMENT_LISTING_EXTENSIONS_WAIT_MS)
  const pickStore = useDeploymentPickStore()
  if (!pickStore.isVisible) return false
  const frames = usePlatformFrameStore()
  if (!frames.isAvailable()) return openDeployCustomNodesDialog()
  const picked = pickStore.pickedDeployment
  if (picked)
    return frames.open(
      { step: 'nodes', deploymentId: picked.deployment_id },
      'extensions'
    )
  if (pickStore.deployments.length > 0)
    return frames.open(NEW_DEPLOYMENT_FROM_NODES, 'extensions')
  return openDeployCustomNodesDialog(NEW_DEPLOYMENT_FROM_NODES)
}
