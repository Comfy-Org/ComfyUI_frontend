import type { ComfyDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { defineStore } from 'pinia'
import { shallowReactive, watch } from 'vue'

import { getModelFileKey } from '@/platform/workflow/core/utils/modelRequirements'
import {
  dispatchModelDownload,
  downloadModel,
  hostReportsModelDownloadProgress
} from '@/platform/workflowErrors/missingModel/missingModelDownload'
import type { ModelWithUrl } from '@/platform/workflowErrors/missingModel/missingModelDownload'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'

export type MissingModelDownloadState =
  | { status: 'idle' }
  | { status: 'requested' }
  | { status: 'pending' }
  | {
      status: 'downloading'
      paused: boolean
      receivedBytes: number | null
      totalBytes: number | null
      fraction: number | null
    }
  | { status: 'done' }
  | { status: 'failed' }

interface HostDownload {
  name: string
  url: string
  state: MissingModelDownloadState
  jobId?: string
  jobEnded: boolean
  request?: number
  endedJobs: ReadonlySet<string>
}

const IDLE: MissingModelDownloadState = { status: 'idle' }

function validCount(value: number | undefined): number | null {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? value
    : null
}

function progressFraction(progress: ComfyDownloadProgress): number | null {
  const received = validCount(progress.receivedBytes)
  const total = validCount(progress.totalBytes)
  if (received !== null && total !== null && total > 0 && received <= total) {
    return received / total
  }
  return Number.isFinite(progress.progress) &&
    progress.progress >= 0 &&
    progress.progress <= 1
    ? progress.progress
    : null
}

function toDownloadState(
  progress: ComfyDownloadProgress
): MissingModelDownloadState | undefined {
  switch (progress.status) {
    case 'pending':
      return { status: 'pending' }
    case 'downloading':
    case 'paused':
      return {
        status: 'downloading',
        paused: progress.status === 'paused',
        receivedBytes: validCount(progress.receivedBytes),
        totalBytes: validCount(progress.totalBytes),
        fraction: progressFraction(progress)
      }
    case 'completed':
      return { status: 'done' }
    case 'error':
      return { status: 'failed' }
    case 'cancelled':
      return IDLE
    default:
      return undefined
  }
}

function isActive(state: MissingModelDownloadState): boolean {
  return (
    state.status === 'requested' ||
    state.status === 'pending' ||
    state.status === 'downloading'
  )
}

function isHostTerminal(status: ComfyDownloadProgress['status']): boolean {
  return status === 'completed' || status === 'error' || status === 'cancelled'
}

function acceptsEvent(
  current: HostDownload | undefined,
  progress: ComfyDownloadProgress
): boolean {
  if (!current) return true
  if (progress.id === undefined) {
    if (current.jobEnded && !isHostTerminal(progress.status)) return false
  } else if (current.endedJobs.has(progress.id)) {
    return false
  }
  return (
    !isActive(current.state) ||
    current.state.status === 'requested' ||
    current.url === progress.url
  )
}

/** Desktop 2 model downloads, mirrored by destination wherever they started. */
export const useMissingModelDownloadStore = defineStore(
  'missingModelDownload',
  () => {
    const missingModelStore = useMissingModelStore()
    const downloads = shallowReactive(new Map<string, HostDownload>())
    let refreshPending = false
    let tracking = false
    let nextRequest = 0

    function stateFor(model: ModelWithUrl): MissingModelDownloadState {
      return downloads.get(getModelFileKey(model))?.state ?? IDLE
    }

    function resetWhere(matches: (download: HostDownload) => boolean) {
      for (const [key, download] of downloads) {
        if (matches(download)) downloads.set(key, { ...download, state: IDLE })
      }
    }

    function flushRefresh() {
      if (!refreshPending || missingModelStore.isRefreshingMissingModels) return
      refreshPending = false
      void missingModelStore.refreshMissingModels()
    }

    let finishedBeforeRefresh = new Set<HostDownload>()
    watch(
      () => missingModelStore.isRefreshingMissingModels,
      (refreshing) => {
        if (refreshing) {
          finishedBeforeRefresh = new Set(
            [...downloads.values()].filter(
              (download) => download.state.status === 'done'
            )
          )
          return
        }
        const finished = finishedBeforeRefresh
        finishedBeforeRefresh = new Set()
        resetWhere((download) => finished.has(download))
        flushRefresh()
      }
    )

    function keyFor(progress: ComfyDownloadProgress): string | undefined {
      if (progress.directory !== undefined) {
        return getModelFileKey({
          name: progress.filename,
          directory: progress.directory
        })
      }
      const matches = [...downloads].filter(
        ([, download]) =>
          download.url === progress.url && download.name === progress.filename
      )
      return matches.length === 1 ? matches[0][0] : undefined
    }

    function applyHostProgress(progress: ComfyDownloadProgress) {
      const state = toDownloadState(progress)
      const key = keyFor(progress)
      if (!state || key === undefined) return
      const current = downloads.get(key)
      if (!acceptsEvent(current, progress)) return

      const jobId = progress.id ?? current?.jobId
      const jobEnded = isHostTerminal(progress.status)
      const endedJobs =
        jobEnded && jobId !== undefined
          ? new Set([...(current?.endedJobs ?? []), jobId])
          : (current?.endedJobs ?? new Set<string>())
      const isMissing = !!missingModelStore.missingModelCandidates?.some(
        (candidate) =>
          candidate.name === progress.filename &&
          (progress.directory === undefined ||
            candidate.directory === progress.directory)
      )
      downloads.set(key, {
        name: progress.filename,
        url: progress.url,
        state: state.status === 'done' && !isMissing ? IDLE : state,
        jobId,
        jobEnded,
        endedJobs
      })

      if (
        state.status === 'done' &&
        current?.state.status !== 'done' &&
        isMissing
      ) {
        refreshPending = true
        flushRefresh()
      }
    }

    function startTracking(): () => void {
      if (!hostReportsModelDownloadProgress()) return () => undefined
      const stop =
        window.__comfyDesktop2?.onDownloadProgress?.(applyHostProgress)
      if (typeof stop !== 'function') return () => undefined
      tracking = true
      return () => {
        tracking = false
        try {
          stop()
        } catch (error) {
          reportError(error, {
            surface: 'platform',
            errorType: 'error_stopping_model_download_tracking'
          })
        } finally {
          resetWhere(() => true)
        }
      }
    }

    function failRequest(model: ModelWithUrl, request: number) {
      const key = getModelFileKey(model)
      const current = downloads.get(key)
      if (current?.request !== request || current.state.status !== 'requested')
        return
      downloads.set(key, {
        ...current,
        state: { status: 'failed' }
      })
    }

    function reportStartFailure(error: unknown) {
      reportError(error, {
        surface: 'platform',
        errorType: 'error_starting_model_download',
        tags: { host: 'desktop2' }
      })
    }

    function download(model: ModelWithUrl): void {
      if (!tracking || !hostReportsModelDownloadProgress()) {
        downloadModel(model, missingModelStore.folderPaths)
        return
      }
      const key = getModelFileKey(model)
      const current = downloads.get(key)
      if (
        current &&
        (isActive(current.state) || current.state.status === 'done')
      )
        return

      const request = ++nextRequest
      downloads.set(key, {
        name: model.name,
        url: model.url,
        state: { status: 'requested' },
        jobEnded: false,
        request,
        endedJobs: current?.endedJobs ?? new Set<string>()
      })
      const outcome = dispatchModelDownload(model, {})
      if (outcome.status === 'dispatch-failed') {
        reportStartFailure(outcome.error)
      }
      if (outcome.status !== 'host-requested') {
        failRequest(model, request)
        return
      }
      void outcome.hostResult.then(
        (accepted) => {
          if (!accepted) failRequest(model, request)
        },
        (error: unknown) => {
          reportStartFailure(error)
          failRequest(model, request)
        }
      )
    }

    return { stateFor, download, startTracking }
  }
)
