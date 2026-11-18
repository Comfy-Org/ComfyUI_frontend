import { useTimeoutFn } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'

import { getModelFileKey } from '@/platform/workflow/core/utils/modelRequirements'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { isCloud } from '@/platform/distribution/types'
import { useMissingModelDownload } from '@/platform/workflowErrors/missingModel/composables/useMissingModelDownload'
import type { ModelWithUrl } from '@/platform/workflowErrors/missingModel/missingModelDownload'
import { useMissingModelDownloadStore } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'
import { groupMissingModelCandidates } from '@/platform/workflowErrors/missingModel/missingModelGrouping'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { getDownloadableModels } from '@/platform/workflowErrors/missingModel/missingModelViewUtils'
import {
  deriveMissingResourcesToastState,
  nextDownloadBatch,
  toUnavailableModels,
  trackedModelPhase
} from '@/platform/workflowErrors/missingResources/missingResourcesToastState'
import type {
  DownloadBatch,
  TrackedModel
} from '@/platform/workflowErrors/missingResources/missingResourcesToastState'
import { startModelDownload } from '@/platform/workflowErrors/missingResources/useTrackedModelActions'

const READY_DISMISS_DELAY_MS = 5000

/** Drives the bottom toast that offers to download a loaded workflow's missing models. */
export function useMissingResourcesToast() {
  const workflowStore = useWorkflowStore()
  const missingModelStore = useMissingModelStore()
  const downloadStore = useMissingModelDownloadStore()
  const { fileSizeFor, trustedGatedRepoUrlFor, prefetchModelMetadata } =
    useMissingModelDownload()

  const missingModelGroups = computed(() =>
    groupMissingModelCandidates(
      missingModelStore.visibleMissingModelCandidates,
      isCloud
    )
  )

  const missingDownloadable = computed(() =>
    getDownloadableModels(missingModelGroups.value)
  )

  const missingKeys = computed(
    () => new Set(missingDownloadable.value.map(getModelFileKey))
  )

  const trackedByKey = shallowRef(new Map<string, ModelWithUrl>())
  const dismissed = ref(false)

  watch(
    [() => workflowStore.activeWorkflow?.path, missingDownloadable],
    ([path, models], [previousPath]) => {
      const next =
        path === previousPath
          ? new Map(trackedByKey.value)
          : new Map<string, ModelWithUrl>()
      for (const model of models) next.set(getModelFileKey(model), model)
      if (path !== previousPath) dismissed.value = false
      trackedByKey.value = next
    },
    { immediate: true }
  )

  watch(
    trackedByKey,
    (tracked) => {
      for (const model of tracked.values())
        void prefetchModelMetadata(model.url)
    },
    { immediate: true }
  )

  const trackedModels = computed<TrackedModel[]>(() =>
    [...trackedByKey.value].map(([key, model]) => ({
      key,
      model,
      download: downloadStore.stateFor(model),
      stillMissing: missingKeys.value.has(key),
      sizeBytes: fileSizeFor(model.url),
      gatedRepoUrl: trustedGatedRepoUrlFor(model.url)
    }))
  )

  const unavailableModels = computed(() =>
    toUnavailableModels(missingModelGroups.value)
  )

  const needsAttention = computed(
    () =>
      unavailableModels.value.length > 0 ||
      trackedModels.value.some(
        (tracked) => tracked.gatedRepoUrl && tracked.stillMissing
      )
  )

  const downloadBatch = shallowRef<DownloadBatch>(new Map())

  watch(
    trackedModels,
    (models) => {
      const next = nextDownloadBatch(downloadBatch.value, models)
      const unchanged =
        next.size === downloadBatch.value.size &&
        [...next].every(
          ([key, phase]) => downloadBatch.value.get(key) === phase
        )
      if (!unchanged) downloadBatch.value = next
    },
    { immediate: true }
  )

  const state = computed(() =>
    deriveMissingResourcesToastState(
      trackedModels.value,
      unavailableModels.value.length,
      downloadBatch.value
    )
  )

  const visible = computed(
    () => !dismissed.value && state.value.kind !== 'hidden'
  )

  function dismiss() {
    dismissed.value = true
  }

  const { start: dismissSoon, stop: keepOpen } = useTimeoutFn(
    dismiss,
    READY_DISMISS_DELAY_MS,
    { immediate: false }
  )

  watch(
    () => state.value.kind === 'ready',
    (isReady) => (isReady ? dismissSoon() : keepOpen())
  )

  function startDownloads() {
    for (const tracked of trackedModels.value) {
      const phase = trackedModelPhase(tracked)
      if (phase === 'waiting' || phase === 'failed')
        startModelDownload(tracked.model)
    }
  }

  return {
    state,
    visible,
    trackedModels,
    unavailableModels,
    needsAttention,
    startDownloads,
    dismiss
  }
}
