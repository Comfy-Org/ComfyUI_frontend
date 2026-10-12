import { readonly, ref, watch } from 'vue'

import {
  isAuthenticatedConfigLoaded,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import type {
  AgentFreeUseNoticeMetadata,
  AgentFreeUseVariant
} from '@/platform/telemetry/types'
import { AGENT_FREE_USE_PLACEMENTS } from '@/platform/telemetry/types'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

import { useAgentPanelStore } from '../stores/agent/agentPanelStore'

export const FREE_USE_PLACEMENT_FLAG = 'agent-free-use-message-placement'

export const FREE_USE_VARIANTS = [
  'control',
  ...AGENT_FREE_USE_PLACEMENTS
] as const satisfies readonly AgentFreeUseVariant[]

export type FreeUseVariant = AgentFreeUseVariant

function isFreeUseVariant(value: unknown): value is FreeUseVariant {
  return FREE_USE_VARIANTS.some((variant) => variant === value)
}

export function useFreeUsePlacement() {
  const panelStore = useAgentPanelStore()
  const assigned = ref<FreeUseVariant>('control')

  const override =
    getSessionOverride<unknown>(FREE_USE_PLACEMENT_FLAG) ??
    getDevOverride<unknown>(FREE_USE_PLACEMENT_FLAG)
  const hasQaOverride = override !== undefined

  function assign(): void {
    const served = remoteConfig.value[FREE_USE_PLACEMENT_FLAG]
    if (!isFreeUseVariant(served)) return
    assigned.value = served
    if (panelStore.reportedFreeUseExposure) return
    panelStore.reportedFreeUseExposure = true
    useTelemetry()?.trackAgentFreeUseExposure({
      placement: served,
      [`$feature/${FREE_USE_PLACEMENT_FLAG}`]: served
    })
  }

  if (hasQaOverride) {
    if (isFreeUseVariant(override)) assigned.value = override
    else
      console.warn(
        `[agent] ignoring unknown ${FREE_USE_PLACEMENT_FLAG} override ${JSON.stringify(override)}; expected one of ${FREE_USE_VARIANTS.join(', ')}`
      )
  } else if (isAuthenticatedConfigLoaded.value) {
    assign()
  } else {
    const stop = watch(isAuthenticatedConfigLoaded, (authenticated) => {
      if (!authenticated) return
      assign()
      stop()
    })
  }

  function reportNotice(metadata: AgentFreeUseNoticeMetadata): void {
    if (hasQaOverride) return
    if (metadata.action === 'shown') {
      if (panelStore.reportedFreeUseImpression) return
      panelStore.reportedFreeUseImpression = true
    }
    useTelemetry()?.trackAgentFreeUseNotice(metadata)
  }

  return {
    variant: readonly(assigned),
    reportNotice
  }
}
