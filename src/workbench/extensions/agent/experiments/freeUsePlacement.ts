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

import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

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

  const sessionOverride = getSessionOverride<unknown>(FREE_USE_PLACEMENT_FLAG)
  const override =
    sessionOverride !== undefined
      ? sessionOverride
      : getDevOverride<unknown>(FREE_USE_PLACEMENT_FLAG)
  const hasQaOverride = override !== undefined

  function assign(): void {
    const served = remoteConfig.value[FREE_USE_PLACEMENT_FLAG]
    if (!isFreeUseVariant(served)) {
      assigned.value = 'control'
      return
    }
    assigned.value = served
    if (panelStore.reportedFreeUseExposure) return
    const telemetry = useTelemetry()
    if (!telemetry) return
    panelStore.reportedFreeUseExposure = true
    telemetry.trackAgentFreeUseExposure({
      placement: served,
      [`$feature/${FREE_USE_PLACEMENT_FLAG}`]: served
    })
  }

  if (hasQaOverride) {
    if (isFreeUseVariant(override)) assigned.value = override
  } else if (isAuthenticatedConfigLoaded.value) {
    assign()
  } else {
    const stop = watch(isAuthenticatedConfigLoaded, (authenticated) => {
      if (!authenticated) return
      assign()
      stop()
    })
  }

  if (!hasQaOverride) {
    watch(
      () => remoteConfig.value[FREE_USE_PLACEMENT_FLAG],
      () => {
        if (isAuthenticatedConfigLoaded.value) assign()
      }
    )
    watch(
      () => panelStore.isOpen,
      (isOpen) => {
        if (isOpen && isAuthenticatedConfigLoaded.value) assign()
      }
    )
  }

  function reportNotice(metadata: AgentFreeUseNoticeMetadata): void {
    if (hasQaOverride) return
    if (metadata.action === 'shown' && panelStore.reportedFreeUseImpression)
      return
    const telemetry = useTelemetry()
    if (!telemetry) return
    if (metadata.action === 'shown') panelStore.reportedFreeUseImpression = true
    telemetry.trackAgentFreeUseNotice(metadata)
  }

  return {
    variant: readonly(assigned),
    reportNotice
  }
}
