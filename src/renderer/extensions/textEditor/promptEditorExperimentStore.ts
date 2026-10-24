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

interface PromptEditorAssignment {
  variant: PromptEditorSurfaceVariant
  isAttributed: boolean
}

function resolveAssignment(): PromptEditorAssignment {
  const qaOverride = readQaOverride()
  if (qaOverride !== undefined)
    return {
      variant: isPromptEditorSurfaceVariant(qaOverride)
        ? qaOverride
        : 'control',
      isAttributed: false
    }
  const served = isAuthenticatedConfigLoaded.value
    ? remoteConfig.value[PROMPT_EDITOR_SURFACE_FLAG]
    : undefined
  return isPromptEditorSurfaceVariant(served)
    ? { variant: served, isAttributed: true }
    : { variant: 'control', isAttributed: false }
}

/** Assignment and exposure for the dialog-versus-panel prompt editor experiment. */
export const usePromptEditorExperimentStore = defineStore(
  'promptEditorExperiment',
  () => {
    const resolution = computed(resolveAssignment)
    const assignment = computed(() => resolution.value.variant)
    const experimentProperties = computed(
      (): Pick<PromptEditorOpenedMetadata, '$feature/prompt-editor-surface'> =>
        resolution.value.isAttributed
          ? { '$feature/prompt-editor-surface': resolution.value.variant }
          : {}
    )
    const reportedExposure = ref<PromptEditorSurfaceVariant | null>(null)

    function expose(rendered: PromptEditorSurfaceVariant) {
      const { variant, isAttributed } = resolution.value
      if (!isAttributed || rendered !== variant) return
      if (reportedExposure.value === variant) return
      const telemetry = useTelemetry()
      if (!telemetry) return
      reportedExposure.value = variant
      telemetry.trackPromptEditorExposure({
        '$feature/prompt-editor-surface': variant
      })
    }

    return { assignment, experimentProperties, expose }
  }
)
