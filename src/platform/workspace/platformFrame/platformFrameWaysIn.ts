import { DEPLOYMENT_LISTING_EXTENSIONS_WAIT_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import { waitForDeploymentListing } from '@/platform/workspace/composables/waitForDeploymentPick'
import { openDeployCustomNodesDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import type { PlatformFrameRequest } from '@/platform/workspace/platformFrame/platformFrameUrl'
import { asksForItsOwnTab } from '@/platform/workspace/platformWorkflowHandoff'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

export const NEW_DEPLOYMENT_FROM_NODES: PlatformFrameRequest = {
  step: 'new',
  startAtNodes: true
}

export const NEW_DEPLOYMENT_FOR_WORKFLOW: PlatformFrameRequest = {
  step: 'new',
  handsOverWorkflow: true
}

export function openPlatformFrameOnClick(
  event: MouseEvent,
  request: PlatformFrameRequest
): boolean {
  if (asksForItsOwnTab(event)) return false
  if (!usePlatformFrameStore().open(request)) return false
  event.preventDefault()
  return true
}

export async function openCloudExtensions(): Promise<boolean> {
  await waitForDeploymentListing(DEPLOYMENT_LISTING_EXTENSIONS_WAIT_MS)
  const pickStore = useDeploymentPickStore()
  if (!pickStore.isVisible) return false
  const frames = usePlatformFrameStore()
  if (!frames.isAvailable()) return openDeployCustomNodesDialog()
  const picked = pickStore.pickedDeployment
  if (picked)
    return frames.open({ step: 'nodes', deploymentId: picked.deployment_id })
  if (pickStore.deployments.length > 0)
    return frames.open(NEW_DEPLOYMENT_FROM_NODES)
  return openDeployCustomNodesDialog(NEW_DEPLOYMENT_FROM_NODES)
}
