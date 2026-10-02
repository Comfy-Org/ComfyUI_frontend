import { computed, ref, watch } from 'vue'

import {
  isAuthenticatedConfigLoaded,
  remoteConfig,
  remoteConfigRevision
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import type { AgentFreeUsePlacement } from '@/platform/telemetry/types'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

export const FREE_USE_PLACEMENT_FLAG = 'agent-free-use-message-placement'

export const FREE_USE_PLACEMENTS = [
  'control',
  'top-banner',
  'near-composer',
  'above-input',
  'inside-input'
] as const satisfies readonly ['control', ...AgentFreeUsePlacement[]]

export type FreeUseVariant = (typeof FREE_USE_PLACEMENTS)[number]

function isFreeUseVariant(value: string | undefined): value is FreeUseVariant {
  return FREE_USE_PLACEMENTS.some((variant) => variant === value)
}

export function useFreeUsePlacement() {
  const assigned = ref<FreeUseVariant>()
  const variant = computed(() => assigned.value ?? 'control')

  const assign = () => {
    const override =
      getSessionOverride<string>(FREE_USE_PLACEMENT_FLAG) ??
      getDevOverride<string>(FREE_USE_PLACEMENT_FLAG)
    const value = override ?? remoteConfig.value[FREE_USE_PLACEMENT_FLAG]
    assigned.value = isFreeUseVariant(value) ? value : 'control'
    if (override !== undefined) return

    useTelemetry()?.trackAgentFreeUseExposure({
      placement: assigned.value,
      [`$feature/${FREE_USE_PLACEMENT_FLAG}`]: assigned.value
    })
  }

  if (isAuthenticatedConfigLoaded.value) {
    assign()
  } else {
    const stop = watch(
      [isAuthenticatedConfigLoaded, remoteConfigRevision],
      ([authenticated]) => {
        if (!authenticated) return
        assign()
        stop()
      }
    )
  }

  return { variant }
}
