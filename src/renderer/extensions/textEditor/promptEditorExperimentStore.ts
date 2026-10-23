import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  isAuthenticatedConfigLoaded,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import type {
  PromptEditorOpenedMetadata,
  PromptEditorSurfaceVariant
} from '@/platform/telemetry/types'
import { PROMPT_EDITOR_SURFACE_VARIANTS } from '@/platform/telemetry/types'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

export const PROMPT_EDITOR_SURFACE_FLAG = 'prompt-editor-surface'

function isPromptEditorSurfaceVariant(
  value: unknown
): value is PromptEditorSurfaceVariant {
  return PROMPT_EDITOR_SURFACE_VARIANTS.some((variant) => variant === value)
}

function readQaOverride(): unknown {
  const sessionOverride = getSessionOverride<unknown>(
    PROMPT_EDITOR_SURFACE_FLAG
  )
  return sessionOverride !== undefined
    ? sessionOverride
    : getDevOverride<unknown>(PROMPT_EDITOR_SURFACE_FLAG)
}

/** Assignment and exposure for the dialog-versus-panel prompt editor experiment. */
export const usePromptEditorExperimentStore = defineStore(
  'promptEditorExperiment',
  () => {
    const qaOverride = readQaOverride()
    const hasQaOverride = qaOverride !== undefined
    const isAttributed = computed(
      () => !hasQaOverride && isAuthenticatedConfigLoaded.value
    )
    function servedVariant(): unknown {
      if (hasQaOverride) return qaOverride
      return isAuthenticatedConfigLoaded.value
        ? remoteConfig.value[PROMPT_EDITOR_SURFACE_FLAG]
        : undefined
    }
    const assignment = computed<PromptEditorSurfaceVariant>(() => {
      const served = servedVariant()
      return isPromptEditorSurfaceVariant(served) ? served : 'control'
    })
    const experimentProperties = computed(
      (): Pick<PromptEditorOpenedMetadata, '$feature/prompt-editor-surface'> =>
        isAttributed.value
          ? { '$feature/prompt-editor-surface': assignment.value }
          : {}
    )
    const hasReportedExposure = ref(false)

    function expose(rendered: PromptEditorSurfaceVariant) {
      if (
        hasReportedExposure.value ||
        !isAttributed.value ||
        rendered !== assignment.value
      )
        return
      hasReportedExposure.value = true
      useTelemetry()?.trackPromptEditorExposure({
        '$feature/prompt-editor-surface': assignment.value
      })
    }

    return { assignment, experimentProperties, expose }
  }
)
