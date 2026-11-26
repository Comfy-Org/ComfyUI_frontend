import { computed } from 'vue'

import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useWorkflowNeedsDeployment } from '@/platform/workspace/composables/useCustomDeploymentOffered'
import { useMissingNodeDeploymentOffer } from '@/platform/workspace/composables/useMissingNodeDeploymentOffer'
import { openWorkflowNeedsDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { nodesNeedingDeployment } from '@/platform/workspace/missingForDeployment'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

function hasPackId(nodeType: MissingNodeType): boolean {
  return typeof nodeType !== 'string' && Boolean(nodeType.cnrId)
}

/** Whether to offer a custom deployment for the missing nodes, and how to set one up. */
export function useCustomDeploymentSetup() {
  const { offer } = useMissingNodeDeploymentOffer()
  const pickStore = useDeploymentPickStore()
  const needsDeployment = useWorkflowNeedsDeployment()
  const offered = computed(
    () =>
      needsDeployment.value &&
      (pickStore.deployments.length === 0 || offer.value?.kind === 'none')
  )
  const missingNodesErrorStore = useMissingNodesErrorStore()
  const coversEveryMissingNode = computed(() => {
    const nodeTypes = missingNodesErrorStore.missingNodesError?.nodeTypes ?? []
    return (
      nodeTypes.length > 0 &&
      nodesNeedingDeployment(nodeTypes).filter(hasPackId).length ===
        nodeTypes.length
    )
  })

  function setUp() {
    void openWorkflowNeedsDeploymentDialog('errors_panel')
  }

  return { offered, coversEveryMissingNode, setUp }
}
