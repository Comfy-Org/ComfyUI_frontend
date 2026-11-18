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
  isTrackedModelRelevant,
  nextDownloadBatch,
  startableModels,
  toUnavailableModels
} from '@/platform/workflowErrors/missingResources/missingResourcesToastState'
import type {
  DownloadBatch,
  TrackedModel
} from '@/platform/workflowErrors/missingResources/missingResourcesToastState'
import { startModelDownload } from '@/platform/workflowErrors/missingResources/useTrackedModelActions'
import { useCloseOverlayCoveredByToast } from '@/platform/workflowErrors/missingResources/useCloseOverlayCoveredByToast'

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
  const prefetchedUrls = new Set<string>()
  const reportedTotals = shallowRef<ReadonlyMap<string, number>>(new Map())
  const dismissed = ref(false)

  watch(
    [() => workflowStore.activeWorkflow, missingDownloadable],
    ([workflow, models], [previousWorkflow]) => {
      const sameWorkflow = workflow === previousWorkflow
      const next = sameWorkflow
        ? new Map(trackedByKey.value)
        : new Map<string, ModelWithUrl>()
      for (const model of models) next.set(getModelFileKey(model), model)
      if (!sameWorkflow) {
        dismissed.value = false
        reportedTotals.value = new Map()
        prefetchedUrls.clear()
      }
      trackedByKey.value = next
    },
    { immediate: true }
  )

  watch(
    trackedByKey,
    (tracked) => {
      for (const { url } of tracked.values()) {
        if (prefetchedUrls.has(url)) continue
        prefetchedUrls.add(url)
        void prefetchModelMetadata(url)
      }
    },
    { immediate: true }
  )

  const downloads = computed(() =>
    [...trackedByKey.value].map(([key, model]) => ({
      key,
      model,
      download: downloadStore.stateFor(model)
    }))
  )

  watch(downloads, (entries) => {
    const totals = entries.flatMap(({ key, download }) =>
      download.status === 'downloading' &&
      download.totalBytes &&
      reportedTotals.value.get(key) !== download.totalBytes
        ? [[key, download.totalBytes] as const]
        : []
    )
    if (totals.length > 0)
      reportedTotals.value = new Map([...reportedTotals.value, ...totals])
  })

  const trackedModels = computed<TrackedModel[]>(() =>
    downloads.value
      .map(({ key, model, download }) => ({
        key,
        model,
        download,
        stillMissing: missingKeys.value.has(key),
        sizeBytes: reportedTotals.value.get(key) ?? fileSizeFor(model.url),
        gatedRepoUrl: trustedGatedRepoUrlFor(model.url)
      }))
      .filter(isTrackedModelRelevant)
  )

  const unavailableModels = computed(() =>
    toUnavailableModels(missingModelGroups.value)
  )

  const needsAttention = computed(
    () =>
      unavailableModels.value.length > 0 ||
      startableModels(trackedModels.value).some(
        (tracked) => tracked.gatedRepoUrl
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

  const readyShownLongEnough = ref(false)

  const visible = computed(
    () =>
      downloadStore.tracksHostProgress() &&
      !dismissed.value &&
      !readyShownLongEnough.value &&
      state.value.kind !== 'hidden'
  )

  useCloseOverlayCoveredByToast(() => visible.value)

  function dismiss() {
    dismissed.value = true
  }

  const { start: hideWhenReady, stop: cancelReadyHide } = useTimeoutFn(
    () => {
      readyShownLongEnough.value = true
    },
    READY_DISMISS_DELAY_MS,
    { immediate: false }
  )

  watch(
    () => state.value.kind === 'ready',
    (isReady) => {
      if (isReady) {
        hideWhenReady()
        return
      }
      cancelReadyHide()
      readyShownLongEnough.value = false
    }
  )

  function startDownloads() {
    for (const tracked of startableModels(trackedModels.value))
      startModelDownload(tracked.model)
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
