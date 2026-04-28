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
  savePath?: string
  status?: DownloadStatus
  message?: string
}

/** Electron downloads store handler */
export const useElectronDownloadStore = defineStore('downloads', () => {
  const downloads = ref<ElectronDownload[]>([])
  const DownloadManager = isDesktop ? electronAPI().DownloadManager : undefined
  let initialized = false

  // Electron reports user-initiated cancels as status=ERROR (not CANCELLED), so
  // we remember URLs whose cancel we dispatched and translate the next error
  // event to CANCELLED in the progress handler.
  const userCancelledUrls = new Set<string>()

  const findByUrl = (url: string) =>
    downloads.value.find((download) => url === download.url)

  const normalizeDownloadState = (
    download: DownloadState
  ): ElectronDownload => ({
    url: download.url,
    filename: download.filename,
    status: download.state,
    progress: download.totalBytes
      ? download.receivedBytes / download.totalBytes
      : 0
  })

  const initialize = async () => {
    if (!isDesktop || !DownloadManager || initialized) return
    initialized = true

    const allDownloads = await DownloadManager.getAllDownloads()

    for (const download of allDownloads) {
      if (!findByUrl(download.url)) {
        downloads.value.push(normalizeDownloadState(download))
      }
    }

    DownloadManager.onDownloadProgress((data) => {
      // Translate the error event that Electron emits on user cancel into
      // CANCELLED so the UI can visually differentiate intentional stops.
      const userCancelled =
        userCancelledUrls.has(data.url) && data.status === DownloadStatus.ERROR

      const existing = findByUrl(data.url)
      if (!existing) {
        downloads.value.push(data)
      }

      const download = findByUrl(data.url)
      if (!download) return

      download.progress = data.progress
      download.status = userCancelled ? DownloadStatus.CANCELLED : data.status
      download.filename = data.filename
      download.savePath = data.savePath
      download.message = data.message

      // The cancel flag is single-shot: consume it on the first matching
      // ERROR event so later genuine ERRORs for the same URL aren't silently
      // masked as CANCELLED.
      if (userCancelled) {
        userCancelledUrls.delete(data.url)
      }
      if (
        data.status === DownloadStatus.COMPLETED ||
        data.status === DownloadStatus.CANCELLED
      ) {
        userCancelledUrls.delete(data.url)
      }
    })
  }

  void initialize()

  const start = async ({
    url,
    savePath,
    filename
  }: {
    url: string
    savePath: string
    filename: string
  }) => {
    if (!DownloadManager) return

    userCancelledUrls.delete(url)
    const download: ElectronDownload = findByUrl(url) ?? {
      url,
      filename,
      savePath
    }

    if (!findByUrl(url)) {
      downloads.value.push(download)
    }

    download.filename = filename
    download.savePath = savePath
    download.status = DownloadStatus.PENDING
    download.progress = 0
    download.message = undefined

    try {
      return await DownloadManager.startDownload(url, savePath, filename)
    } catch (error) {
      download.status = DownloadStatus.ERROR
      download.message = error instanceof Error ? error.message : String(error)
      throw error
    }
  }
  const pause = (url: string) => DownloadManager?.pauseDownload(url)
  const resume = (url: string) => DownloadManager?.resumeDownload(url)
  const cancel = (url: string) => {
    if (!DownloadManager) return

    userCancelledUrls.add(url)
    return DownloadManager.cancelDownload(url)
  }
  const remove = (url: string) => {
    userCancelledUrls.delete(url)
    downloads.value = downloads.value.filter((download) => download.url !== url)
  }

  return {
    downloads,
    start,
    pause,
    resume,
    cancel,
    remove,
    findByUrl,
    initialize,
    inProgressDownloads: computed(() =>
      downloads.value.filter(
        ({ status }) => status !== DownloadStatus.COMPLETED
      )
    )
  }
})
