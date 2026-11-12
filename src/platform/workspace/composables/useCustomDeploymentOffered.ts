import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useDeploymentSwitcherOffered } from '@/platform/workspace/composables/useDeploymentSwitcherOffered'
import { nodesNeedingDeployment } from '@/platform/workspace/missingForDeployment'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

/**
 * Whether the open workflow needs a deployment: it lacks nodes with no
 * replacement, on a page booted on Comfy Cloud that was served the listing.
 */
export function useWorkflowNeedsDeployment() {
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

/**
 * Whether Comfy Cloud offers a custom deployment for the open workflow's
 * missing nodes, given whether Cloud and each deployment were found lacking.
 */
export function useCustomDeploymentOffered(
  noneRunIt: MaybeRefOrGetter<boolean>
) {
  const pickStore = useDeploymentPickStore()
  const needsDeployment = useWorkflowNeedsDeployment()

  return computed(
    () =>
      needsDeployment.value &&
      (pickStore.deployments.length === 0 || toValue(noneRunIt))
  )
}
