import { computed } from 'vue'

import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { useWorkflowNeedsDeployment } from '@/platform/workspace/composables/useCustomDeploymentOffered'
import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { fullDeploymentLabel } from '@/platform/workspace/composables/useDeploymentLabels'
import { nodesNeedingDeployment } from '@/platform/workspace/missingForDeployment'
import { openWorkflowNeedsDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { openWorkflowForCheck } from '@/platform/workspace/openWorkflowForCheck'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { workflowDeploymentOffer } from '@/platform/workspace/workflowDeploymentOffer'

type IssuesToastBuildOffer =
  | { kind: 'switch'; buildName: string }
  | { kind: 'create' }

/** The Custom Build the issues toast offers for the open workflow's missing nodes, or null; open shows the workflow deployment dialog. */
export function useIssuesToastBuildOffer() {
  const needsDeployment = useWorkflowNeedsDeployment()
  const pickStore = useDeploymentPickStore()
  const missingNodesErrorStore = useMissingNodesErrorStore()
  const { markFor } = useDeploymentCompatibility()

  const offer = computed<IssuesToastBuildOffer | null>(() => {
    if (!needsDeployment.value) return null
    const deployments = pickStore.deployments
    if (deployments.length === 0) return { kind: 'create' }
    const workflowOffer = workflowDeploymentOffer(
      deployments,
      markFor,
      openWorkflowForCheck(
        nodesNeedingDeployment(
          missingNodesErrorStore.missingNodesError?.nodeTypes ?? []
        )
      )
    )
    if (workflowOffer.kind === 'switch') {
      return {
        kind: 'switch',
        buildName: fullDeploymentLabel(workflowOffer.choices[0].deployment)
      }
    }
    return workflowOffer.kind === 'noneRunIt' ? { kind: 'create' } : null
  })

  function open() {
    void openWorkflowNeedsDeploymentDialog('issues_toast')
  }

  return { offer, open }
}
