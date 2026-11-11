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
  | { status: 'failed'; reason: 'error' | 'cancelled' }

interface HostDownload {
  name: string
  url: string
  state: MissingModelDownloadState
  jobId?: string
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
  if (received !== null && total !== null && total > 0) {
    return Math.min(1, received / total)
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
    case 'cancelled':
      return { status: 'failed', reason: progress.status }
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

function isTerminal(state: MissingModelDownloadState): boolean {
  return state.status === 'done' || state.status === 'failed'
}

function acceptsEvent(
  current: HostDownload | undefined,
  progress: ComfyDownloadProgress
): boolean {
  if (!current) return true
  if (progress.id !== undefined && current.endedJobs.has(progress.id))
    return false
  return !isActive(current.state) || current.url === progress.url
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
      const download = downloads.get(getModelFileKey(model))
      return download?.url === model.url ? download.state : IDLE
    }

    function clearFinished() {
      for (const [key, download] of downloads) {
        if (download.state.status === 'done') downloads.delete(key)
      }
    }

    function flushRefresh() {
      if (!refreshPending || missingModelStore.isRefreshingMissingModels) return
      refreshPending = false
      void missingModelStore.refreshMissingModels().finally(clearFinished)
    }

    watch(() => missingModelStore.isRefreshingMissingModels, flushRefresh)

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
      const endedJobs =
        isTerminal(state) && jobId !== undefined
          ? new Set([...(current?.endedJobs ?? []), jobId])
          : (current?.endedJobs ?? new Set<string>())
      downloads.set(key, {
        name: progress.filename,
        url: progress.url,
        state,
        jobId,
        endedJobs
      })

      if (
        state.status === 'done' &&
        current?.state.status !== 'done' &&
        !!missingModelStore.missingModelCandidates?.length
      ) {
        refreshPending = true
        flushRefresh()
      }
    }

    function startTracking(): () => void {
      if (!hostReportsModelDownloadProgress()) return () => undefined
      const stop =
        window.__comfyDesktop2?.onDownloadProgress?.(applyHostProgress)
      if (!stop) return () => undefined
      tracking = true
      return () => {
        tracking = false
        stop()
      }
    }

    function failRequest(model: ModelWithUrl, request: number) {
      const key = getModelFileKey(model)
      const current = downloads.get(key)
      if (current?.request !== request || current.state.status !== 'requested')
        return
      downloads.set(key, {
        ...current,
        state: { status: 'failed', reason: 'error' }
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
      if (current && isActive(current.state)) return

      const request = ++nextRequest
      downloads.set(key, {
        name: model.name,
        url: model.url,
        state: { status: 'requested' },
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
