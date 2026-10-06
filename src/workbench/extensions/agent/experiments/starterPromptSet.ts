import { computed, ref, watch } from 'vue'

import {
  authenticatedRemoteConfigState,
  isAuthenticatedConfigLoaded,
  remoteConfig,
  remoteConfigRevision
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

export const STARTER_PROMPT_SET_FLAG = 'agent-starter-prompt-set'
const STARTER_PROMPT_ASSIGNMENTS = ['control', 'test'] as const
export type StarterPromptAssignment =
  (typeof STARTER_PROMPT_ASSIGNMENTS)[number]

function isAssignment(
  value: string | undefined
): value is StarterPromptAssignment {
  return STARTER_PROMPT_ASSIGNMENTS.some((assignment) => assignment === value)
}

/**
 * Resolves the server's PostHog assignment once per panel instance. Unknown,
 * missing, inactive, and not-yet-loaded values intentionally stay control.
 * Assignment is passed through the rendered prompt attribution so every
 * experiment event uses the same value; no prompt text or workflow data is
 * used for allocation.
 */
export function useStarterPromptSet() {
  const assigned = ref<StarterPromptAssignment>('control')
  const exposedAssignment = ref<StarterPromptAssignment>()
  const renderedSurfaceAssignment = ref<StarterPromptAssignment>()
  const qaOverride = ref(false)
  let surfaceRendered = false

  const assign = () => {
    const override =
      getSessionOverride<string>(STARTER_PROMPT_SET_FLAG) ??
      getDevOverride<string>(STARTER_PROMPT_SET_FLAG)
    qaOverride.value = override !== undefined
    assigned.value = isAssignment(
      override ?? remoteConfig.value[STARTER_PROMPT_SET_FLAG]
    )
      ? ((override ??
          remoteConfig.value[
            STARTER_PROMPT_SET_FLAG
          ]) as StarterPromptAssignment)
      : 'control'
    if (
      surfaceRendered &&
      (renderedSurfaceAssignment.value === undefined ||
        renderedSurfaceAssignment.value === assigned.value) &&
      !qaOverride.value &&
      exposedAssignment.value !== assigned.value
    ) {
      exposedAssignment.value = assigned.value
      useTelemetry()?.trackAgentStarterPromptExposure({
        [`$feature/${STARTER_PROMPT_SET_FLAG}`]: assigned.value
      })
    }
  }

  const expose = (renderedAssignment?: StarterPromptAssignment) => {
    // Resolve the assignment before marking the surface rendered. Otherwise a
    // localized control surface can emit a test exposure before its rendered
    // assignment mismatch is checked below.
    if (!isAuthenticatedConfigLoaded.value) {
      renderedSurfaceAssignment.value = renderedAssignment ?? assigned.value
      surfaceRendered = true
      return
    }
    surfaceRendered = false
    assign()
    surfaceRendered = true
    renderedSurfaceAssignment.value = renderedAssignment ?? assigned.value
    if (renderedSurfaceAssignment.value !== assigned.value) return
    if (!qaOverride.value && exposedAssignment.value !== assigned.value) {
      exposedAssignment.value = assigned.value
      useTelemetry()?.trackAgentStarterPromptExposure({
        [`$feature/${STARTER_PROMPT_SET_FLAG}`]: assigned.value
      })
    }
  }

  const invalidateSurface = () => {
    surfaceRendered = false
    exposedAssignment.value = undefined
    renderedSurfaceAssignment.value = undefined
  }

  if (isAuthenticatedConfigLoaded.value) {
    assign()
  } else {
    watch(
      [
        isAuthenticatedConfigLoaded,
        remoteConfigRevision,
        authenticatedRemoteConfigState
      ],
      ([authenticated]) => {
        if (!authenticated) return
        assign()
      }
    )
  }

  return {
    assignment: computed(() => assigned.value),
    expose,
    invalidateSurface
  }
}
