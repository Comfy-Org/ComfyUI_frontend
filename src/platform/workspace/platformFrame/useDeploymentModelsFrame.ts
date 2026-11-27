import { computed } from 'vue'

import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import type { PlatformFrameRequest } from '@/platform/workspace/platformFrame/platformFrameUrl'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

export function deploymentModelsRequest(
  deploymentId: string,
  { handsOverWorkflow = false }: { handsOverWorkflow?: boolean } = {}
): PlatformFrameRequest {
  return {
    step: 'models',
    deploymentId,
    ...(handsOverWorkflow && { handsOverWorkflow })
  }
}

export function preinstallRequest(deploymentId: string): PlatformFrameRequest {
  return { step: 'preinstall', deploymentId, handsOverWorkflow: true }
}

export function useDeploymentModelsFrame() {
  const pickStore = useDeploymentPickStore()
  const frames = usePlatformFrameStore()

  const bootDeploymentId = computed(() =>
    frames.isAvailable() ? pickStore.bootDeployment?.deployment_id : undefined
  )

  function addModels(): boolean {
    const deploymentId = bootDeploymentId.value
    return deploymentId !== undefined
      ? frames.open(deploymentModelsRequest(deploymentId), 'model_library')
      : false
  }

  return { bootDeploymentId, addModels }
}
