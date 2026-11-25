import { watch } from 'vue'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import type { PlatformFrameRequest } from '@/platform/workspace/platformFrame/platformFrameUrl'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

export function preinstallRequest(deploymentId: string): PlatformFrameRequest {
  return { step: 'preinstall', deploymentId, handsOverWorkflow: true }
}

export function usePreinstallOffer() {
  const workflows = useWorkflowStore()
  const missingModels = useMissingModelStore()
  const missingNodes = useMissingNodesErrorStore()
  const pickStore = useDeploymentPickStore()
  const frames = usePlatformFrameStore()
  const offered = new Set<string>()

  const lacksNodes = () =>
    missingNodes.missingNodesError !== null ||
    !!workflows.activeWorkflow?.pendingWarnings?.missingNodeTypes?.length

  return watch(
    [
      () => workflows.activeWorkflow?.path,
      () => pickStore.bootDeployment?.deployment_id,
      () => missingModels.hasMissingModels && !lacksNodes(),
      () => frames.session !== null,
      () => frames.isAvailable()
    ],
    ([path, deploymentId, lacksOnlyModels, frameOpen, available]) => {
      if (!path || !deploymentId || !lacksOnlyModels) return
      if (frameOpen || !available || offered.has(path)) return
      if (frames.open(preinstallRequest(deploymentId), 'preinstall'))
        offered.add(path)
    },
    { immediate: true }
  )
}
