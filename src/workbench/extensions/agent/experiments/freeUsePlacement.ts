import { computed, ref, watch } from 'vue'

import {
  isAuthenticatedConfigLoaded,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import type { AgentFreeUseNoticeMetadata } from '@/platform/telemetry/types'
import { AGENT_FREE_USE_PLACEMENTS } from '@/platform/telemetry/types'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

import { useAgentPanelStore } from '../stores/agent/agentPanelStore'

export const FREE_USE_PLACEMENT_FLAG = 'agent-free-use-message-placement'

export const FREE_USE_PLACEMENTS = [
  'control',
  ...AGENT_FREE_USE_PLACEMENTS
] as const

export type FreeUseVariant = (typeof FREE_USE_PLACEMENTS)[number]

function isFreeUseVariant(value: unknown): value is FreeUseVariant {
  return FREE_USE_PLACEMENTS.some((variant) => variant === value)
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

  // A QA override has to resolve ahead of the auth gate: `/features` can stay
  // pending or fail outright, and a reviewer previewing an arm would otherwise
  // sit in `control` with no way to tell the override was ignored.
  if (hasQaOverride) {
    if (isFreeUseVariant(override)) assigned.value = override
    else if (import.meta.env.DEV)
      console.warn(
        `[agent] ignoring unknown ${FREE_USE_PLACEMENT_FLAG} override ${JSON.stringify(override)}; expected one of ${FREE_USE_PLACEMENTS.join(', ')}`
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

  /**
   * Withheld entirely while a QA override is forcing a placement: the analysis
   * splits on the variant PostHog actually assigned, so an overridden session's
   * exposure and interactions belong to no arm. `shown` is additionally
   * reported once per panel open — see `reportedFreeUseImpression`.
   */
  function reportNotice(metadata: AgentFreeUseNoticeMetadata): void {
    if (hasQaOverride) return
    if (metadata.action === 'shown') {
      if (panelStore.reportedFreeUseImpression) return
      panelStore.reportedFreeUseImpression = true
    }
    useTelemetry()?.trackAgentFreeUseNotice(metadata)
  }

  return {
    variant: computed<FreeUseVariant>(() => assigned.value),
    reportNotice
  }
}
