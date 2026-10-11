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

/**
 * `satisfies readonly [...]` on an array literal rejects a value outside
 * `AgentFreeUsePlacement` but not a *missing* one, so an arm added to the union
 * and not to the array would fall back to `control` silently. Keying the arms
 * by the union makes that a compile error here instead.
 */
const PLACEMENT_ARMS = {
  'top-banner': true,
  'near-composer': true,
  'above-input': true,
  'inside-input': true
} as const satisfies Record<AgentFreeUsePlacement, true>

export const FREE_USE_PLACEMENTS = [
  'control',
  ...(Object.keys(PLACEMENT_ARMS) as AgentFreeUsePlacement[])
] as const

export type FreeUseVariant = (typeof FREE_USE_PLACEMENTS)[number]

function isFreeUseVariant(value: unknown): value is FreeUseVariant {
  return FREE_USE_PLACEMENTS.some((variant) => variant === value)
}

export function useFreeUsePlacement() {
  const assigned = ref<FreeUseVariant>()
  const variant = computed(() => assigned.value ?? 'control')

  const override =
    getSessionOverride<string>(FREE_USE_PLACEMENT_FLAG) ??
    getDevOverride<string>(FREE_USE_PLACEMENT_FLAG)
  const hasQaOverride = override !== undefined

  const assign = () => {
    const served = remoteConfig.value[FREE_USE_PLACEMENT_FLAG]
    const recognised = isFreeUseVariant(served)
    assigned.value = recognised ? served : 'control'
    // An absent or unrecognised value means the flag never served this client
    // an arm. `control` is itself an arm, so reporting the fallback as one
    // would file non-enrolled clients into the control cohort and overstate
    // the experiment's denominator.
    if (!recognised) return

    useTelemetry()?.trackAgentFreeUseExposure({
      placement: served,
      [`$feature/${FREE_USE_PLACEMENT_FLAG}`]: served
    })
  }

  // A QA override has to resolve ahead of the auth gate: `/features` can stay
  // pending or fail outright, and a reviewer previewing an arm would otherwise
  // sit in `control` with no way to tell the override was ignored.
  if (hasQaOverride) {
    assigned.value = isFreeUseVariant(override) ? override : 'control'
  } else if (isAuthenticatedConfigLoaded.value) {
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

  return {
    variant,
    /**
     * False while a QA override is forcing a placement. The analysis splits on
     * the variant PostHog actually assigned, so an overridden session's
     * interactions belong to no arm.
     */
    attributeExperiment: !hasQaOverride
  }
}
