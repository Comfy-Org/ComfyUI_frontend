import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import type { DownloadState } from '@comfyorg/comfyui-electron-types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { isDesktop } from '@/platform/distribution/types'
import { electronAPI } from '@/utils/envUtil'

export interface ElectronDownload extends Pick<
  DownloadState,
  'url' | 'filename'
> {
  progress?: number
  receivedBytes?: number
  savePath?: string
  status?: DownloadStatus
  totalBytes?: number
}

function normalizeElectronDownloadState({
  url,
  filename,
  state,
  receivedBytes,
  totalBytes
}: DownloadState): ElectronDownload {
  const download: ElectronDownload = {
    url,
    filename,
    status: state,
    receivedBytes,
    totalBytes
  }

  return Number.isFinite(receivedBytes) &&
    receivedBytes >= 0 &&
    Number.isFinite(totalBytes) &&
    totalBytes > 0 &&
    receivedBytes <= totalBytes
    ? { ...download, progress: receivedBytes / totalBytes }
    : download
}

/** Electron downloads store handler */
export const useElectronDownloadStore = defineStore('downloads', () => {
  const downloads = ref<ElectronDownload[]>([])
  const DownloadManager = isDesktop ? electronAPI().DownloadManager : undefined
  const progressListeners = new Set<(download: ElectronDownload) => void>()
  let isProgressListenerInstalled = false

  const findByUrl = (url: string) =>
    downloads.value.find((download) => url === download.url)

  function notifyProgressListeners(download: ElectronDownload) {
    for (const listener of progressListeners) {
      // Isolated so one throwing subscriber cannot stop the others, or
      // abandon a replay partway through.
      try {
        listener(download)
      } catch (error) {
        console.error('Electron download progress listener failed:', error)
      }
    }
  }

  function applyProgress(data: ElectronDownload) {
    if (!findByUrl(data.url)) {
      downloads.value.push(data)
    }

    const download = findByUrl(data.url)

    if (download) {
      download.progress = data.progress
      download.receivedBytes = undefined
      download.totalBytes = undefined
      download.status = data.status
      download.filename = data.filename
      download.savePath = data.savePath
      notifyProgressListeners(download)
    }
  }

  /** `defer` may hold an event back; returning true means it took ownership. */
  function installProgressListener(
    defer?: (download: ElectronDownload) => boolean
  ) {
    if (!DownloadManager || isProgressListenerInstalled) return

    isProgressListenerInstalled = true
    DownloadManager.onDownloadProgress((data) => {
      if (defer?.(data)) return
      applyProgress(data)
    })
  }

  const initialize = async () => {
    if (!isDesktop || !DownloadManager) return

    // Listen immediately so no live event is missed, but hold them back until
    // the snapshot has been applied: the snapshot describes an older moment,
    // so replaying afterwards is what keeps a download from moving backwards.
    const live = new Map<string, ElectronDownload>()
    let restored = false
    installProgressListener((download) => {
      if (restored) return false
      live.set(download.url, download)
      return true
    })

    try {
      const allDownloads = await DownloadManager.getAllDownloads()

      for (const download of allDownloads) {
        const normalizedDownload = normalizeElectronDownloadState(download)
        const existing = findByUrl(normalizedDownload.url)
        if (existing) {
          Object.assign(existing, normalizedDownload)
        } else {
          downloads.value.push(normalizedDownload)
        }
      }
    } catch {
      // A missing snapshot must not keep live progress from being observed.
    }

    restored = true
    for (const download of live.values()) applyProgress(download)
    live.clear()
  }

  function subscribeToDownloadProgress(
    listener: (download: ElectronDownload) => void
  ) {
    progressListeners.add(listener)

    return () => progressListeners.delete(listener)
  }

  void initialize()

  const start = ({
    url,
    savePath,
    filename
  }: {
    url: string
    savePath: string
    filename: string
  }) => DownloadManager!.startDownload(url, savePath, filename)
  const pause = (url: string) => DownloadManager!.pauseDownload(url)
  const resume = (url: string) => DownloadManager!.resumeDownload(url)
  const cancel = (url: string) => DownloadManager!.cancelDownload(url)

  return {
    downloads,
    start,
    pause,
    resume,
    cancel,
    findByUrl,
    initialize,
    subscribeToDownloadProgress,
    inProgressDownloads: computed(() =>
      downloads.value.filter(
        ({ status }) => status !== DownloadStatus.COMPLETED
      )
    )
  }
})
