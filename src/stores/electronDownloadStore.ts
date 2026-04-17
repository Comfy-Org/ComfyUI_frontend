import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import type {
  DownloadProgressUpdate,
  DownloadState
} from '@comfyorg/comfyui-electron-types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type {
  DownloadLifecycleState,
  DownloadLifecycleStatus
} from '@/platform/downloads/types'
import { isDesktop } from '@/platform/distribution/types'
import { electronAPI } from '@/utils/envUtil'

type DesktopDownloadSnapshot = Pick<
  DownloadProgressUpdate,
  'url' | 'filename'
> &
  Partial<DownloadState> &
  Partial<DownloadProgressUpdate>

export interface ElectronDownload extends DownloadLifecycleState {
  url: string
  filename: string
  savePath: string
}

const desktopStatusToLifecycleStatus = {
  [DownloadStatus.PENDING]: 'created',
  [DownloadStatus.IN_PROGRESS]: 'running',
  [DownloadStatus.PAUSED]: 'paused',
  [DownloadStatus.COMPLETED]: 'completed',
  [DownloadStatus.CANCELLED]: 'cancelled',
  [DownloadStatus.ERROR]: 'failed'
} satisfies Record<DownloadStatus, DownloadLifecycleStatus>

/** Electron downloads store handler */
export const useElectronDownloadStore = defineStore('downloads', () => {
  const downloads = ref<ElectronDownload[]>([])
  const DownloadManager = isDesktop ? electronAPI().DownloadManager : undefined

  const findByUrl = (url: string) =>
    downloads.value.find((download) => url === download.url)

  function normalizeStatus(
    status?: DownloadStatus,
    isPaused?: boolean
  ): ElectronDownload['status'] {
    if (isPaused || status === DownloadStatus.PAUSED) {
      return 'paused'
    }

    if (!status) return 'failed'

    return desktopStatusToLifecycleStatus[status]
  }

  function normalizeProgress(
    download: DesktopDownloadSnapshot,
    status: ElectronDownload['status']
  ): number {
    if (typeof download.progress === 'number') {
      return download.progress
    }

    if (
      typeof download.receivedBytes === 'number' &&
      typeof download.totalBytes === 'number' &&
      download.totalBytes > 0
    ) {
      return download.receivedBytes / download.totalBytes
    }

    return status === 'completed' ? 1 : 0
  }

  function normalizeDownload(
    download: DesktopDownloadSnapshot
  ): ElectronDownload {
    const status = normalizeStatus(
      download.status ?? download.state,
      download.isPaused
    )

    return {
      url: download.url,
      filename: download.filename,
      savePath: download.savePath ?? '',
      progress: normalizeProgress(download, status),
      status,
      error: download.message
    }
  }

  function upsertDownload(download: DesktopDownloadSnapshot) {
    const normalizedDownload = normalizeDownload(download)
    const existingDownload = findByUrl(normalizedDownload.url)

    if (existingDownload) {
      Object.assign(existingDownload, normalizedDownload)
      return
    }

    downloads.value.push(normalizedDownload)
  }

  const initialize = async () => {
    if (!isDesktop || !DownloadManager) return

    const allDownloads = await DownloadManager.getAllDownloads()

    for (const download of allDownloads) {
      upsertDownload(download)
    }

    DownloadManager.onDownloadProgress((data) => {
      upsertDownload(data)
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
    inProgressDownloads: computed(() =>
      downloads.value.filter(({ status }) => status !== 'completed')
    )
  }
})
