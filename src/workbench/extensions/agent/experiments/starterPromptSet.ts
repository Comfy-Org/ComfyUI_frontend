import { computed, ref, watch } from 'vue'

import type { GetFeaturesResponses } from '@comfyorg/ingest-types'

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
export type StarterPromptAssignment =
  GetFeaturesResponses[200][typeof STARTER_PROMPT_SET_FLAG]
const STARTER_PROMPT_ASSIGNMENTS: readonly StarterPromptAssignment[] = [
  'control',
  'test'
]

function isAssignment(value: unknown): value is StarterPromptAssignment {
  return STARTER_PROMPT_ASSIGNMENTS.some((assignment) => assignment === value)
}

function resolveAssignment(): {
  assignment: StarterPromptAssignment
  hasQaOverride: boolean
} {
  const override =
    getSessionOverride<string>(STARTER_PROMPT_SET_FLAG) ??
    getDevOverride<string>(STARTER_PROMPT_SET_FLAG)
  const candidate = override ?? remoteConfig.value[STARTER_PROMPT_SET_FLAG]
  return {
    assignment: isAssignment(candidate) ? candidate : 'control',
    hasQaOverride: override !== undefined
  }
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

  const exposeAssignment = () => {
    if (
      !surfaceRendered ||
      renderedSurfaceAssignment.value !== assigned.value ||
      qaOverride.value ||
      exposedAssignment.value === assigned.value
    ) {
      return
    }
    exposedAssignment.value = assigned.value
    useTelemetry()?.trackAgentStarterPromptExposure({
      [`$feature/${STARTER_PROMPT_SET_FLAG}`]: assigned.value
    })
  }

  const assign = () => {
    const resolved = resolveAssignment()
    if (
      surfaceRendered &&
      renderedSurfaceAssignment.value !== undefined &&
      renderedSurfaceAssignment.value !== resolved.assignment
    ) {
      // Keep the assignment that produced the currently rendered surface.
      // A late auth/config update must not turn control copy into treatment
      // without a matching exposure.
      assigned.value = renderedSurfaceAssignment.value
      qaOverride.value = resolved.hasQaOverride
      return
    }
    qaOverride.value = resolved.hasQaOverride
    assigned.value = resolved.assignment
    // An EmptyState can mount before authenticated config is available. Keep
    // its rendered assignment pending, but only make it an exposure once the
    // authenticated result has settled and the surface is still mounted.
    if (
      isAuthenticatedConfigLoaded.value &&
      !surfaceRendered &&
      renderedSurfaceAssignment.value !== undefined
    ) {
      surfaceRendered = true
    }
    exposeAssignment()
  }

  const expose = (renderedAssignment?: StarterPromptAssignment) => {
    // Resolve the assignment before marking the surface rendered. Otherwise a
    // localized control surface can emit a test exposure before its rendered
    // assignment mismatch is checked below.
    if (!isAuthenticatedConfigLoaded.value) {
      renderedSurfaceAssignment.value = renderedAssignment ?? assigned.value
      surfaceRendered = false
      return
    }
    surfaceRendered = false
    assign()
    surfaceRendered = true
    renderedSurfaceAssignment.value = renderedAssignment ?? assigned.value
    exposeAssignment()
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
    attributeExperiment: computed(
      () => isAuthenticatedConfigLoaded.value && !qaOverride.value
    ),
    expose,
    invalidateSurface
  }
}
