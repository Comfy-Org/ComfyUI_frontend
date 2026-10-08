import { computed } from 'vue'

import { zGetFeaturesResponse } from '@comfyorg/ingest-types/zod'

import {
  isAuthenticatedConfigLoaded,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import type { AgentStarterPromptAssignment } from '@/platform/telemetry/types'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

export const STARTER_PROMPT_SET_FLAG = 'agent-starter-prompt-set'
const starterPromptAssignmentSchema =
  zGetFeaturesResponse.shape[STARTER_PROMPT_SET_FLAG].catch('control')

function resolveAssignment(): {
  assignment: AgentStarterPromptAssignment
  hasQaOverride: boolean
} {
  const override =
    getSessionOverride<unknown>(STARTER_PROMPT_SET_FLAG) ??
    getDevOverride<unknown>(STARTER_PROMPT_SET_FLAG)
  const candidate = override ?? remoteConfig.value[STARTER_PROMPT_SET_FLAG]
  return {
    assignment: starterPromptAssignmentSchema.parse(candidate),
    hasQaOverride: override !== undefined
  }
}

/** Resolves the current assignment and attributes an eligible rendered arm. */
export function useStarterPromptSet() {
  const assignment = computed(() => {
    const resolved = resolveAssignment()
    return isAuthenticatedConfigLoaded.value || resolved.hasQaOverride
      ? resolved.assignment
      : 'control'
  })
  const attributeExperiment = computed(() => {
    const resolved = resolveAssignment()
    return isAuthenticatedConfigLoaded.value && !resolved.hasQaOverride
  })

  const expose = (renderedAssignment: AgentStarterPromptAssignment) => {
    if (!attributeExperiment.value || renderedAssignment !== assignment.value)
      return
    useTelemetry()?.trackAgentStarterPromptExposure({
      [`$feature/${STARTER_PROMPT_SET_FLAG}`]: assignment.value
    })
  }

  return {
    assignment,
    attributeExperiment,
    expose
  }
}
