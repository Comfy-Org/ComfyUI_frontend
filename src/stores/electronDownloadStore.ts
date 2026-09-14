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

  const notifyProgressListeners = (download: ElectronDownload) => {
    for (const listener of progressListeners) listener(download)
  }

  const installProgressListener = () => {
    if (!DownloadManager || isProgressListenerInstalled) return

    isProgressListenerInstalled = true
    DownloadManager.onDownloadProgress((data) => {
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
    })
  }

  const initialize = async () => {
    if (!isDesktop || !DownloadManager) return

    installProgressListener()

    try {
      const allDownloads = await DownloadManager.getAllDownloads()

      for (const download of allDownloads) {
        const normalizedDownload = normalizeElectronDownloadState(download)
        const existing = findByUrl(normalizedDownload.url)
        if (existing) {
          Object.assign(existing, normalizedDownload)
          notifyProgressListeners(existing)
        } else {
          downloads.value.push(normalizedDownload)
          notifyProgressListeners(normalizedDownload)
        }
      }
    } catch {
      return
    }
  }

  const subscribeToDownloadProgress = (
    listener: (download: ElectronDownload) => void
  ) => {
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
