import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useMissingModelDownload } from '@/platform/workflowErrors/missingModel/composables/useMissingModelDownload'
import type { ModelWithUrl } from '@/platform/workflowErrors/missingModel/missingModelDownload'
import { isActiveDownload } from '@/platform/workflowErrors/missingModel/missingModelDownloadState'
import { useMissingModelDownloadStore } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'
import { trackedModelPhase } from '@/platform/workflowErrors/missingResources/missingResourcesToastState'
import type { TrackedModel } from '@/platform/workflowErrors/missingResources/missingResourcesToastState'

/** Resumes a held host download of the model, or requests a new one. */
export function startModelDownload(model: ModelWithUrl): void {
  const downloadStore = useMissingModelDownloadStore()
  if (downloadStore.canResume(model)) downloadStore.resume(model)
  else downloadStore.download(model)
}

/** What one listed model offers: start, pause, resume, cancel, or request access. */
export function useTrackedModelActions(
  tracked: MaybeRefOrGetter<TrackedModel>
) {
  const downloadStore = useMissingModelDownloadStore()
  const { openModelAccessPage } = useMissingModelDownload()

  const model = computed(() => toValue(tracked).model)
  const phase = computed(() => trackedModelPhase(toValue(tracked)))

  const activeDownload = computed(() => {
    const { download } = toValue(tracked)
    return isActiveDownload(download) ? download : undefined
  })

  const isPaused = computed(() => {
    const { download } = toValue(tracked)
    return download.status === 'downloading' && download.paused
  })

  const canStart = computed(
    () => phase.value === 'waiting' || phase.value === 'failed'
  )

  const accessRepoUrl = computed(() =>
    canStart.value ? toValue(tracked).gatedRepoUrl : undefined
  )

  const canTogglePause = computed(
    () =>
      toValue(tracked).download.status === 'downloading' &&
      downloadStore.canControl(model.value, 'pauseDownload') &&
      downloadStore.canControl(model.value, 'resumeDownload')
  )

  const canCancel = computed(
    () =>
      phase.value === 'active' &&
      downloadStore.canControl(model.value, 'cancelDownload')
  )

  function start() {
    startModelDownload(model.value)
  }

  function togglePause() {
    if (isPaused.value) downloadStore.resume(model.value)
    else downloadStore.pause(model.value)
  }

  function cancel() {
    downloadStore.cancel(model.value)
  }

  function requestAccess() {
    if (accessRepoUrl.value) void openModelAccessPage(accessRepoUrl.value)
  }

  return {
    model,
    phase,
    activeDownload,
    isPaused,
    canStart,
    accessRepoUrl,
    canTogglePause,
    canCancel,
    start,
    togglePause,
    cancel,
    requestAccess
  }
}
