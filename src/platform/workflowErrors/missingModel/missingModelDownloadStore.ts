import type { ComfyDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'
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
  url: string
  state: MissingModelDownloadState
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
): MissingModelDownloadState {
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
      return progress.status satisfies never
  }
}

function isActive(state: MissingModelDownloadState): boolean {
  return (
    state.status === 'requested' ||
    state.status === 'pending' ||
    state.status === 'downloading'
  )
}

/** Desktop 2 model downloads, mirrored by destination wherever they started. */
export const useMissingModelDownloadStore = defineStore(
  'missingModelDownload',
  () => {
    const missingModelStore = useMissingModelStore()
    const downloads = shallowReactive(new Map<string, HostDownload>())
    let refreshPending = false

    function stateFor(model: ModelWithUrl): MissingModelDownloadState {
      const download = downloads.get(getModelFileKey(model))
      return download?.url === model.url ? download.state : IDLE
    }

    function flushRefresh() {
      if (!refreshPending || missingModelStore.isRefreshingMissingModels) return
      refreshPending = false
      void missingModelStore.refreshMissingModels()
    }

    watch(() => missingModelStore.isRefreshingMissingModels, flushRefresh)

    function applyHostProgress(progress: ComfyDownloadProgress) {
      if (progress.directory === undefined) return
      const key = getModelFileKey({
        name: progress.filename,
        directory: progress.directory
      })
      const current = downloads.get(key)
      if (current && current.url !== progress.url && isActive(current.state))
        return

      const state = toDownloadState(progress)
      downloads.set(key, { url: progress.url, state })
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
      return (
        window.__comfyDesktop2?.onDownloadProgress?.(applyHostProgress) ??
        (() => undefined)
      )
    }

    function failRequest(model: ModelWithUrl) {
      if (stateFor(model).status !== 'requested') return
      downloads.set(getModelFileKey(model), {
        url: model.url,
        state: { status: 'failed', reason: 'error' }
      })
    }

    function download(model: ModelWithUrl): void {
      if (!hostReportsModelDownloadProgress()) {
        downloadModel(model, missingModelStore.folderPaths)
        return
      }
      if (isActive(stateFor(model))) return

      downloads.set(getModelFileKey(model), {
        url: model.url,
        state: { status: 'requested' }
      })
      const outcome = dispatchModelDownload(model, {})
      if (outcome.status !== 'host-requested') {
        failRequest(model)
        return
      }
      void outcome.hostResult.then(
        (accepted) => {
          if (!accepted) failRequest(model)
        },
        () => failRequest(model)
      )
    }

    return { stateFor, download, startTracking }
  }
)
