import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import type { DownloadState } from '@comfyorg/comfyui-electron-types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { reportDownloadFailure } from '@/platform/electronDownload/downloadFailureReporter'
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

  // Electron reports user-initiated cancels as status=ERROR (not CANCELLED), so
  // we remember URLs whose cancel we dispatched and translate the next error
  // event to CANCELLED in the progress handler.
  const userCancelledUrls = new Set<string>()

  const findByUrl = (url: string) =>
    downloads.value.find((download) => url === download.url)

  const initialize = async () => {
    if (!isDesktop || !DownloadManager) return

    const allDownloads = await DownloadManager.getAllDownloads()

    for (const download of allDownloads) {
      downloads.value.push(download)
    }

    DownloadManager.onDownloadProgress((data) => {
      // Translate the error event that Electron emits on user cancel into
      // CANCELLED so the UI can visually differentiate intentional stops.
      const userCancelled =
        userCancelledUrls.has(data.url) && data.status === DownloadStatus.ERROR

      const existing = findByUrl(data.url)
      const previousStatus = existing?.status
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

      // Report genuine failures to Sentry once per ERROR transition. User
      // cancels are already translated to CANCELLED above so they're skipped.
      if (
        download.status === DownloadStatus.ERROR &&
        previousStatus !== DownloadStatus.ERROR
      ) {
        reportDownloadFailure(download)
      }
    })
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
  }) => {
    userCancelledUrls.delete(url)
    return DownloadManager!.startDownload(url, savePath, filename)
  }
  const pause = (url: string) => DownloadManager!.pauseDownload(url)
  const resume = (url: string) => DownloadManager!.resumeDownload(url)
  const cancel = (url: string) => {
    userCancelledUrls.add(url)
    return DownloadManager!.cancelDownload(url)
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
