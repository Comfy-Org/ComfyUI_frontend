import { reportError } from '@comfyorg/telemetry/reportError'
import { useAppMode } from '@/composables/useAppMode'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import { useCustomDeploymentOffered } from '@/platform/workspace/composables/useCustomDeploymentOffered'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { waitForDeploymentListing } from '@/platform/workspace/composables/waitForDeploymentPick'
import {
  missingNodeTypeName,
  nodesNeedingDeployment
} from '@/platform/workspace/missingForDeployment'
import { openWorkflowNeedsDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { useCustomDeploymentOfferStore } from '@/platform/workspace/stores/customDeploymentOfferStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

function firstNoticeOfTheseNodes(): boolean {
  const names = nodesNeedingDeployment(
    useMissingNodesErrorStore().missingNodesError?.nodeTypes ?? []
  ).map(missingNodeTypeName)
  return names.length > 0 && useCustomDeploymentOfferStore().offerOnce(names)
}

async function offerCustomDeployment(): Promise<void> {
  const workflowStore = useWorkflowStore()
  const noticedWorkflow = workflowStore.activeWorkflow
  const offered = useCustomDeploymentOffered(null)
  await waitForDeploymentListing(DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS)
  const stillNoticed =
    workflowStore.activeWorkflow === noticedWorkflow &&
    useExecutionErrorStore().isErrorOverlayOpen &&
    !useAppMode().isAppMode.value
  if (offered.value && stillNoticed) await openWorkflowNeedsDeploymentDialog()
}

/**
 * Shows the error overlay for the open workflow's missing nodes and, the first
 * time this page meets them, the custom deployment dialog over it when offered.
 */
export async function noticeMissingNodes(): Promise<void> {
  useExecutionErrorStore().showErrorOverlay()
  if (!useDeploymentSwitcherOffered().value || !firstNoticeOfTheseNodes())
    return
  await offerCustomDeployment().catch((error: unknown) => {
    reportError(error, {
      errorType: 'error_offering_custom_deployment',
      surface: 'platform'
    })
  })
}
