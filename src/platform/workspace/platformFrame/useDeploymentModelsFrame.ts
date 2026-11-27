import { computed } from 'vue'

import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import type { PlatformFrameRequest } from '@/platform/workspace/platformFrame/platformFrameUrl'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

export function preinstallRequest(deploymentId: string): PlatformFrameRequest {
  return { step: 'preinstall', deploymentId, handsOverWorkflow: true }
}

export function useDeploymentModelsFrame() {
  const pickStore = useDeploymentPickStore()
  const frames = usePlatformFrameStore()

  const bootDeploymentId = computed(() =>
    frames.isAvailable() ? pickStore.bootDeployment?.deployment_id : undefined
  )

  return { bootDeploymentId }
}
