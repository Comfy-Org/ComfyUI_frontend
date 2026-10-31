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
 * missing nodes, given the deployments that run it (null until checked).
 */
export function useCustomDeploymentOffered(
  deploymentsThatRunIt: MaybeRefOrGetter<readonly (string | null)[] | null>
) {
  const pickStore = useDeploymentPickStore()
  const needsDeployment = useWorkflowNeedsDeployment()

  function noDeploymentRunsIt(): boolean {
    const runIt = toValue(deploymentsThatRunIt)
    return (
      pickStore.deployments.length === 0 ||
      (runIt !== null && runIt.length === 0)
    )
  }

  return computed(() => needsDeployment.value && noDeploymentRunsIt())
}
