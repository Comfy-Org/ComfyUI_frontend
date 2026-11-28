import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useTelemetry } from '@comfyorg/telemetry'
import type {
  PromptEditorOpenedMetadata,
  PromptEditorSurfaceVariant
} from '@comfyorg/telemetry/types'
import { zGetFeaturesResponse } from '@comfyorg/ingest-types/zod'

import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

const PROMPT_EDITOR_SURFACE_FLAG = 'prompt-editor-surface'

const variantSchema =
  zGetFeaturesResponse.shape[PROMPT_EDITOR_SURFACE_FLAG].unwrap()

function parseVariant(value: unknown): PromptEditorSurfaceVariant | undefined {
  const parsed = variantSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
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

function resolveAssignment(served: unknown): PromptEditorAssignment {
  const qaOverride = readQaOverride()
  if (qaOverride !== undefined)
    return {
      variant: parseVariant(qaOverride) ?? 'control',
      isAttributed: false
    }
  const servedVariant = parseVariant(served)
  return servedVariant
    ? { variant: servedVariant, isAttributed: true }
    : { variant: 'control', isAttributed: false }
}

/** Assignment and exposure for the dialog-versus-panel prompt editor experiment. */
export const usePromptEditorExperimentStore = defineStore(
  'promptEditorExperiment',
  () => {
    const remoteConfigStore = useRemoteConfigStore()
    const resolution = ref(resolveAssignment(undefined))
    const reportedExposure = ref<PromptEditorSurfaceVariant | null>(null)
    function resolveServedAssignment() {
      resolution.value = resolveAssignment(
        remoteConfigStore.config[PROMPT_EDITOR_SURFACE_FLAG]
      )
    }
    watch(
      () => remoteConfigStore.authenticatedLoadState,
      (state) => {
        if (state === 'authenticated') resolveServedAssignment()
        if (state !== 'unloaded') return
        resolution.value = resolveAssignment(undefined)
        reportedExposure.value = null
      },
      { immediate: true, flush: 'sync' }
    )
    watch(
      () => remoteConfigStore.config[PROMPT_EDITOR_SURFACE_FLAG],
      () => {
        if (remoteConfigStore.isAuthenticatedConfigLoaded)
          resolveServedAssignment()
      }
    )
    const assignment = computed(() => resolution.value.variant)

    function isAttributedTo(rendered: PromptEditorSurfaceVariant) {
      const { variant, isAttributed } = resolution.value
      return isAttributed && rendered === variant
    }

    function experimentPropertiesFor(
      rendered: PromptEditorSurfaceVariant
    ): Pick<PromptEditorOpenedMetadata, '$feature/prompt-editor-surface'> {
      return isAttributedTo(rendered)
        ? { '$feature/prompt-editor-surface': rendered }
        : {}
    }

    function expose(rendered: PromptEditorSurfaceVariant) {
      if (!isAttributedTo(rendered)) return
      if (reportedExposure.value === rendered) return
      const telemetry = useTelemetry()
      if (!telemetry) return
      reportedExposure.value = rendered
      telemetry.trackPromptEditorExposure({
        variant: rendered,
        '$feature/prompt-editor-surface': rendered
      })
    }

    return { assignment, experimentPropertiesFor, expose }
  }
)
