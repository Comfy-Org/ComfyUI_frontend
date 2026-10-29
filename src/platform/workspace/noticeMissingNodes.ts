import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { nodesNeedingDeployment } from '@/platform/workspace/missingForDeployment'
import { openWorkflowNeedsDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

async function offerCustomDeployment(): Promise<boolean> {
  const store = useDeploymentPickStore()
  await store.loadOnce()
  if (!store.isVisible || store.bootDeployment !== null) return false
  return openWorkflowNeedsDeploymentDialog()
}

/**
 * Tells the user that a workflow just opened needs nodes this editor lacks.
 * On Comfy Cloud, to an account served the deployments listing, nodes with no
 * replacement open the custom deployment dialog; otherwise the error overlay.
 */
export function noticeMissingNodes(
  nodeTypes: readonly MissingNodeType[]
): void {
  const showOverlay = () => useExecutionErrorStore().showErrorOverlay()
  if (
    !useDeploymentSwitcherOffered().value ||
    nodesNeedingDeployment(nodeTypes).length === 0
  ) {
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
