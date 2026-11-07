import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { DEPLOYMENT_LISTING_EXTENSIONS_WAIT_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import { waitForDeploymentListing } from '@/platform/workspace/composables/waitForDeploymentPick'
import {
  openBuildCustomNodesDialog,
  openDeployCustomNodesDialog
} from '@/platform/workspace/openCustomDeploymentDialog'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

/**
 * Opens what Extensions shows on Comfy Cloud: the node picker when the editor
 * runs on a deployment with a Build, else the custom deployment explainer.
 * False when neither opened, so the caller shows the waitlist survey.
 */
export async function openCloudExtensions(): Promise<boolean> {
  await waitForDeploymentListing(DEPLOYMENT_LISTING_EXTENSIONS_WAIT_MS)
  const pickStore = useDeploymentPickStore()
  if (!pickStore.isVisible) return false
  const deployment = pickStore.pickedDeployment
  if (useFeatureFlags().flags.buildCustomNodesEnabled && deployment?.build_id)
    return openBuildCustomNodesDialog(deployment)
  return openDeployCustomNodesDialog()
}
