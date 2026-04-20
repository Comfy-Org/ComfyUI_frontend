import type { DownloadProgressUpdate } from '@comfyorg/comfyui-electron-types'

import type {
  DownloadEntry,
  DownloadService,
  DownloadStartParams,
  DownloadStatus
} from '../types'

import { electronAPI } from '@/utils/envUtil'

export function createElectronDownloadService(): DownloadService & {
  initialize(): Promise<void>
} {
  const entries = new Map<string, DownloadEntry>()
  const progressListeners = new Map<
    string,
    Set<(entry: DownloadEntry) => void>
  >()
  const api = electronAPI()
  const downloadManager = api?.DownloadManager
  if (!downloadManager) {
    throw new Error(
      'DownloadManager is unavailable. Verify Electron preload exposes DownloadManager.'
    )
  }

  const VALID_STATUSES = new Set<DownloadStatus>([
    'pending',
    'in_progress',
    'paused',
    'completed',
    'cancelled',
    'error'
  ])

  function toDownloadStatus(
    value: unknown,
    fallback: DownloadStatus = 'error'
  ): DownloadStatus {
    return VALID_STATUSES.has(value as DownloadStatus)
      ? (value as DownloadStatus)
      : fallback
  }

  function notifyListeners(id: string, entry: DownloadEntry) {
    progressListeners.get(id)?.forEach((cb) => cb(entry))
  }

  function upsertFromProgress(update: DownloadProgressUpdate) {
    const existing = entries.get(update.url)
    const entry: DownloadEntry = {
      id: update.url,
      url: update.url,
      filename: update.filename ?? existing?.filename ?? '',
      savePath: update.savePath ?? existing?.savePath ?? '',
      status: toDownloadStatus(update.status, 'in_progress'),
      progress: update.progress ?? 0
    }
    entries.set(update.url, entry)
    notifyListeners(update.url, entry)
  }

  let initialized = false
  let initPromise: Promise<void> | null = null

  async function initialize() {
    if (initialized) return
    if (initPromise) return initPromise

    initPromise = (async () => {
      try {
        const existingDownloads = await downloadManager.getAllDownloads()
        for (const download of existingDownloads) {
          entries.set(download.url, {
            id: download.url,
            url: download.url,
            filename: download.filename,
            savePath: '',
            status: toDownloadStatus(download.state),
            progress: download.totalBytes
              ? download.receivedBytes / download.totalBytes
              : 0
          })
        }
        downloadManager.onDownloadProgress(upsertFromProgress)
        initialized = true
      } finally {
        initPromise = null
      }
    })()

    return initPromise
  }

  async function start(params: DownloadStartParams): Promise<DownloadEntry> {
    const started = await downloadManager.startDownload(
      params.url,
      params.savePath,
      params.filename
    )
    if (started === false) {
      throw new Error(
        `Download could not be started for ${params.url}. Verify the URL and try again.`
      )
    }
    const entry: DownloadEntry = {
      id: params.url,
      url: params.url,
      filename: params.filename,
      savePath: params.savePath,
      status: 'pending',
      progress: 0
    }
    entries.set(params.url, entry)
    return entry
  }

  async function pause(id: string) {
    await downloadManager.pauseDownload(id)
  }

  async function resume(id: string) {
    await downloadManager.resumeDownload(id)
  }

  async function cancel(id: string) {
    await downloadManager.cancelDownload(id)
  }

  function getAll(): DownloadEntry[] {
    return [...entries.values()]
  }

  function getById(id: string): DownloadEntry | null {
    return entries.get(id) ?? null
  }

  function onProgress(
    id: string,
    cb: (entry: DownloadEntry) => void
  ): () => void {
    if (!progressListeners.has(id)) {
      progressListeners.set(id, new Set())
    }
    progressListeners.get(id)!.add(cb)
    return () => {
      const listeners = progressListeners.get(id)
      if (!listeners) return
      listeners.delete(cb)
      if (listeners.size === 0) {
        progressListeners.delete(id)
      }
    }
  }

  return {
    supportsPauseResume: true,
    initialize,
    start,
    pause,
    resume,
    cancel,
    getAll,
    getById,
    onProgress
  }
}
