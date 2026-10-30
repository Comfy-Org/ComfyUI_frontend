import { reportError } from '@comfyorg/telemetry/reportError'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { nodesNeedingDeployment } from '@/platform/workspace/missingForDeployment'
import { openWorkflowNeedsDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

function needsDeployment(): boolean {
  const nodeTypes = useMissingNodesErrorStore().missingNodesError?.nodeTypes
  return nodesNeedingDeployment(nodeTypes ?? []).length > 0
}

function waitForListing(): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    useDeploymentPickStore().loadOnce(),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, DEPLOYMENT_LISTING_MISSING_NODES_WAIT_MS)
    })
  ]).finally(() => clearTimeout(timeout))
}

async function offerCustomDeployment(): Promise<boolean> {
  const store = useDeploymentPickStore()
  await waitForListing()
  if (!store.isVisible || store.bootDeployment !== null) return false
  if (!needsDeployment()) return false
  return openWorkflowNeedsDeploymentDialog()
}

/**
 * Shows the custom deployment dialog on Comfy Cloud for the open workflow's
 * missing nodes with no replacement, else the error overlay.
 */
export function noticeMissingNodes(): void {
  const showOverlay = () => useExecutionErrorStore().showErrorOverlay()
  if (!useDeploymentSwitcherOffered().value || !needsDeployment()) {
    showOverlay()
    return
  }
  offerCustomDeployment().then(
    (opened) => {
      if (!opened) showOverlay()
    },
    (error: unknown) => {
      reportError(error, {
        errorType: 'error_offering_custom_deployment',
        surface: 'platform'
      })
      showOverlay()
    }
  )
}
