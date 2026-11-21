import { computed } from 'vue'

import { useTelemetry } from '@comfyorg/telemetry'
import type { AgentFreeUseNoticeMetadata } from '@comfyorg/telemetry/types'

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

export const LOCAL_FREE_USE_PLACEMENT = 'near-composer' as const

export const FREE_USE_VARIANTS = ['control', LOCAL_FREE_USE_PLACEMENT] as const

export type FreeUseVariant = (typeof FREE_USE_VARIANTS)[number]

export function useFreeUsePlacement(isCloudDistribution: boolean) {
  const panelStore = useAgentPanelStore()
  const variant = computed<FreeUseVariant>(() =>
    isCloudDistribution ? 'control' : LOCAL_FREE_USE_PLACEMENT
  )

  function reportNotice(metadata: AgentFreeUseNoticeMetadata): void {
    if (isCloudDistribution) return
    if (metadata.action === 'shown' && panelStore.reportedFreeUseImpression)
      return
    const telemetry = useTelemetry()
    if (!telemetry) return
    if (metadata.action === 'shown') panelStore.reportedFreeUseImpression = true
    telemetry.trackAgentFreeUseNotice({ ...metadata, deployment: 'local' })
  }

  return { variant, reportNotice }
}
