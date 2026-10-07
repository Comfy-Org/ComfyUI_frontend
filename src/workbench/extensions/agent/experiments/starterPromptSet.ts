import { computed } from 'vue'

import type { GetFeaturesResponses } from '@comfyorg/ingest-types'
import { zGetFeaturesResponse } from '@comfyorg/ingest-types/zod'

import {
  isAuthenticatedConfigLoaded,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

export const STARTER_PROMPT_SET_FLAG = 'agent-starter-prompt-set'
export type StarterPromptAssignment = NonNullable<
  GetFeaturesResponses[200][typeof STARTER_PROMPT_SET_FLAG]
>
const starterPromptAssignmentSchema =
  zGetFeaturesResponse.shape[STARTER_PROMPT_SET_FLAG]

function resolveAssignment(): {
  assignment: StarterPromptAssignment
  hasQaOverride: boolean
} {
  const override =
    getSessionOverride<unknown>(STARTER_PROMPT_SET_FLAG) ??
    getDevOverride<unknown>(STARTER_PROMPT_SET_FLAG)
  const candidate = override ?? remoteConfig.value[STARTER_PROMPT_SET_FLAG]
  const parsed = starterPromptAssignmentSchema.safeParse(candidate)
  return {
    assignment: parsed.success ? parsed.data : 'control',
    hasQaOverride: override !== undefined
  }
}

/** Resolves the current assignment and attributes an eligible rendered arm. */
export function useStarterPromptSet() {
  const resolved = computed(resolveAssignment)
  const assignment = computed(() =>
    isAuthenticatedConfigLoaded.value || resolved.value.hasQaOverride
      ? resolved.value.assignment
      : 'control'
  )
  const attributeExperiment = computed(
    () => isAuthenticatedConfigLoaded.value && !resolved.value.hasQaOverride
  )

  const expose = (renderedAssignment: StarterPromptAssignment) => {
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
