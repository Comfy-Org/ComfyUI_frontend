import type { CustomDeploymentEntry } from '@comfyorg/telemetry/types'

import { computed } from 'vue'

import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useCustomDeploymentOffered } from '@/platform/workspace/composables/useCustomDeploymentOffered'
import { useMissingNodeDeploymentOffer } from '@/platform/workspace/composables/useMissingNodeDeploymentOffer'
import { openWorkflowNeedsDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { nodesNeedingDeployment } from '@/platform/workspace/missingForDeployment'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import { NEW_DEPLOYMENT_FOR_WORKFLOW } from '@/platform/workspace/platformFrame/platformFrameWaysIn'

/** Whether to offer a custom deployment for the missing nodes, and how to set one up. */
export function useCustomDeploymentSetup() {
  const { offer } = useMissingNodeDeploymentOffer()
  const offered = useCustomDeploymentOffered(() => offer.value?.kind === 'none')
  const missingNodesErrorStore = useMissingNodesErrorStore()
  const coversEveryMissingNode = computed(() => {
    const nodeTypes = missingNodesErrorStore.missingNodesError?.nodeTypes ?? []
    return (
      nodeTypes.length > 0 &&
      nodesNeedingDeployment(nodeTypes).length === nodeTypes.length
    )
  })

  function setUp(entry: CustomDeploymentEntry) {
    if (usePlatformFrameStore().open(NEW_DEPLOYMENT_FOR_WORKFLOW, entry)) return
    void openWorkflowNeedsDeploymentDialog()
  }

  return { offered, coversEveryMissingNode, setUp }
}
