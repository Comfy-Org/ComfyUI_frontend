import type { DownloadProgressUpdate } from '@comfyorg/comfyui-electron-types'

import type { DownloadEntry, DownloadService, DownloadStatus } from '../types'

import { electronAPI } from '@/utils/envUtil'

export function createElectronDownloadService(): DownloadService & {
  initialize(): Promise<void>
} {
  const entries = new Map<string, DownloadEntry>()
  const progressListeners = new Map<
    string,
    Set<(entry: DownloadEntry) => void>
  >()
  const downloadManager = electronAPI().DownloadManager

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
      status: (update.status as DownloadStatus) ?? 'in_progress',
      progress: update.progress ?? 0
    }
    entries.set(update.url, entry)
    notifyListeners(update.url, entry)
  }

  async function initialize() {
    const existingDownloads = await downloadManager.getAllDownloads()
    for (const download of existingDownloads) {
      entries.set(download.url, {
        id: download.url,
        url: download.url,
        filename: download.filename,
        savePath: '',
        status: download.state as DownloadStatus,
        progress: download.totalBytes
          ? download.receivedBytes / download.totalBytes
          : 0
      })
    }
    downloadManager.onDownloadProgress(upsertFromProgress)
  }

  async function start(params: {
    url: string
    savePath: string
    filename: string
  }): Promise<DownloadEntry> {
    await downloadManager.startDownload(
      params.url,
      params.savePath,
      params.filename
    )
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
      progressListeners.get(id)?.delete(cb)
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
