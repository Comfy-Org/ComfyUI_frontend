import type { ModelFile } from '@comfyorg/graph-model/workflowSchema'

import { useTemplateModelRowDownloads } from '@/platform/workflow/templates/composables/useTemplateModelRowDownloads'
import { createTemplateModelDownloadState } from '@/platform/workflow/templates/utils/templateModelDownloadState'
import type { TemplateModelDownloadState } from '@/platform/workflow/templates/utils/templateModelDownloadState'
import { hostReportsModelDownloadProgress } from '@/platform/workflowErrors/missingModel/missingModelDownload'
import { useMissingModelDownloadStore } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'
import type { MissingModelDownloadState } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'

type TemplateModelRowDownloads = ReturnType<typeof useTemplateModelRowDownloads>

export function toTemplateModelDownloadState(
  state: MissingModelDownloadState
): TemplateModelDownloadState {
  switch (state.status) {
    case 'idle':
      return createTemplateModelDownloadState()
    case 'requested':
      return { status: 'queued', attempt: 1 }
    case 'pending':
      return { status: 'starting', attempt: 1 }
    case 'downloading':
      return {
        status: 'downloading',
        attempt: 1,
        activity: state.paused ? 'paused' : 'active',
        receivedBytes: state.receivedBytes,
        totalBytes: state.totalBytes,
        fraction: state.fraction
      }
    case 'done':
      return { status: 'done', attempt: 1 }
    case 'failed':
      return { status: 'failed', attempt: 1, reason: 'error' }
  }
}

/** Template model downloads, shared with the Errors tab wherever the host reports progress. */
export function useTemplateModelDownloads(
  options: Parameters<typeof useTemplateModelRowDownloads>[0],
  missingModels: readonly ModelFile[] = []
): TemplateModelRowDownloads {
  const store = useMissingModelDownloadStore()
  if (!hostReportsModelDownloadProgress() || !store.tracksHostProgress()) {
    return useTemplateModelRowDownloads(options)
  }
  store.reopenFinished(missingModels)
  let fallback: TemplateModelRowDownloads | undefined
  let disposed = false
  const dialogTracker = () => {
    if (!fallback && !disposed && !store.tracksHostProgress()) {
      fallback = useTemplateModelRowDownloads(options)
    }
    return fallback
  }
  return {
    stateFor: (model) => {
      const tracker = dialogTracker()
      return tracker
        ? tracker.stateFor(model)
        : toTemplateModelDownloadState(store.stateFor(model))
    },
    canResume: (model) => {
      const tracker = dialogTracker()
      return tracker ? tracker.canResume(model) : store.canResume(model)
    },
    request: (model) => {
      if (disposed) return
      const tracker = dialogTracker()
      if (tracker) tracker.request(model)
      else store.download(model)
    },
    dispose: () => {
      disposed = true
      fallback?.dispose()
    }
  }
}
