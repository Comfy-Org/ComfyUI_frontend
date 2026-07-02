import { useIntervalFn } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { api } from '@/scripts/api'

import {
  cancelDownload,
  clearDownloads,
  deleteDownload,
  enqueueDownload,
  listDownloads,
  pauseDownload,
  resumeDownload,
  setDownloadPriority
} from '../api/modelDownloadApi'
import type {
  DownloadState,
  DownloadStatus,
  EnqueueRequest,
  EnqueueResponse
} from '../types'
import { directoryOf } from '../utils/modelId'

const ACTIVE_STATES: ReadonlySet<DownloadState> = new Set([
  'queued',
  'active',
  'paused',
  'verifying'
])

const POLL_INTERVAL_MS = 5_000
const STALE_THRESHOLD_MS = 8_000

/**
 * Static completion fraction (0..1) for a download. Live values (`progress`)
 * are only populated while a worker is running; for paused/terminal rows we
 * derive it from `bytes_done / total_bytes`.
 */
export function downloadProgressFraction(
  download: DownloadStatus
): number | null {
  if (download.progress != null) return download.progress
  if (download.total_bytes && download.total_bytes > 0) {
    return download.bytes_done / download.total_bytes
  }
  return null
}

function optimisticRow(
  downloadId: string,
  request: EnqueueRequest
): DownloadStatus {
  const now = Math.floor(Date.now() / 1000)
  return {
    download_id: downloadId,
    model_id: request.model_id,
    url: request.url,
    status: 'queued',
    priority: request.priority ?? 0,
    total_bytes: null,
    bytes_done: 0,
    progress: null,
    speed_bps: null,
    eta_seconds: null,
    segments: null,
    error: null,
    created_at: now,
    updated_at: now
  }
}

export interface CompletedDownload {
  downloadId: string
  modelId: string
  directory: string
  timestamp: number
}

export const useModelDownloadStore = defineStore('modelDownload', () => {
  const downloads = ref<Map<string, DownloadStatus>>(new Map())
  const lastWsUpdate = ref(0)
  const lastCompletedDownload = ref<CompletedDownload | null>(null)

  const downloadList = computed(() => Array.from(downloads.value.values()))
  const activeDownloads = computed(() =>
    downloadList.value.filter((d) => ACTIVE_STATES.has(d.status))
  )
  const historyDownloads = computed(() =>
    downloadList.value.filter((d) => !ACTIVE_STATES.has(d.status))
  )
  const hasActiveDownloads = computed(() => activeDownloads.value.length > 0)
  const activeDownloadCount = computed(() => activeDownloads.value.length)

  function upsert(status: DownloadStatus) {
    downloads.value.set(status.download_id, status)
  }

  function findByModelId(modelId: string): DownloadStatus | undefined {
    return downloadList.value.find((d) => d.model_id === modelId)
  }

  function handleProgress(e: CustomEvent<DownloadStatus>) {
    lastWsUpdate.value = Date.now()
    const previous = downloads.value.get(e.detail.download_id)
    upsert(e.detail)
    if (e.detail.status === 'completed' && previous?.status !== 'completed') {
      lastCompletedDownload.value = {
        downloadId: e.detail.download_id,
        modelId: e.detail.model_id,
        directory: directoryOf(e.detail.model_id),
        timestamp: Date.now()
      }
    }
    // The live failure event carries the terminal status but not the error
    // text, and polling stops once nothing is active. Refetch so the failure
    // reason surfaces without the user reopening the panel.
    if (
      e.detail.status === 'failed' &&
      previous?.status !== 'failed' &&
      !e.detail.error
    ) {
      void hydrate().catch(() => {})
    }
  }

  async function hydrate() {
    const previous = downloads.value
    const list = await listDownloads()
    downloads.value = new Map(list.map((d) => [d.download_id, d]))
    for (const download of list) {
      const prior = previous.get(download.download_id)
      if (
        download.status === 'completed' &&
        prior &&
        prior.status !== 'completed'
      ) {
        lastCompletedDownload.value = {
          downloadId: download.download_id,
          modelId: download.model_id,
          directory: directoryOf(download.model_id),
          timestamp: Date.now()
        }
      }
    }
  }

  async function enqueue(request: EnqueueRequest): Promise<EnqueueResponse> {
    const response = await enqueueDownload(request)
    upsert(optimisticRow(response.download_id, request))
    return response
  }

  function patchStatus(id: string, status: DownloadState) {
    const existing = downloads.value.get(id)
    if (existing) {
      downloads.value.set(id, { ...existing, status })
    }
  }

  async function pause(id: string) {
    patchStatus(id, 'paused')
    await pauseDownload(id)
  }

  async function resume(id: string) {
    patchStatus(id, 'queued')
    await resumeDownload(id)
  }

  async function cancel(id: string) {
    await cancelDownload(id)
    patchStatus(id, 'cancelled')
  }

  async function setPriority(id: string, priority: number) {
    const existing = downloads.value.get(id)
    if (existing) {
      downloads.value.set(id, { ...existing, priority })
    }
    await setDownloadPriority(id, priority)
  }

  async function remove(id: string) {
    await deleteDownload(id)
    downloads.value.delete(id)
  }

  async function clearHistory() {
    const clearedIds = historyDownloads.value.map((d) => d.download_id)
    await clearDownloads()
    for (const id of clearedIds) {
      downloads.value.delete(id)
    }
  }

  async function pollIfStale() {
    if (!hasActiveDownloads.value) return
    if (Date.now() - lastWsUpdate.value < STALE_THRESHOLD_MS) return
    try {
      await hydrate()
    } catch {
      // Server unreachable; retry on next interval
    }
  }

  useIntervalFn(() => void pollIfStale(), POLL_INTERVAL_MS)

  api.addEventListener('download_progress', handleProgress)

  return {
    downloadList,
    activeDownloads,
    historyDownloads,
    hasActiveDownloads,
    activeDownloadCount,
    lastCompletedDownload,
    upsert,
    findByModelId,
    hydrate,
    enqueue,
    pause,
    resume,
    cancel,
    setPriority,
    remove,
    clearHistory
  }
})
