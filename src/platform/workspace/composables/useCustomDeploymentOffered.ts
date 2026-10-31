import { computed } from 'vue'

import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { nodesNeedingDeployment } from '@/platform/workspace/missingForDeployment'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

/** Whether Comfy Cloud offers a custom deployment for the open workflow's missing nodes. */
export function useCustomDeploymentOffered() {
  const pickStore = useDeploymentPickStore()
  const missingNodesErrorStore = useMissingNodesErrorStore()
  const switcherOffered = useDeploymentSwitcherOffered()
  return computed(
    () =>
      switcherOffered.value &&
      pickStore.isVisible &&
      pickStore.bootDeployment === null &&
      nodesNeedingDeployment(
        missingNodesErrorStore.missingNodesError?.nodeTypes ?? []
      ).length > 0
  )
}
