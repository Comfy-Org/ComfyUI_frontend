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
}

/** Electron downloads store handler */
export const useElectronDownloadStore = defineStore('downloads', () => {
  const downloads = ref<ElectronDownload[]>([])
  const DownloadManager = isDesktop ? electronAPI().DownloadManager : undefined

  function findByUrl(url: string) {
    return downloads.value.find((download) => url === download.url)
  }

  async function initialize() {
    if (!isDesktop || !DownloadManager) return

    const allDownloads = await DownloadManager.getAllDownloads()

    for (const download of allDownloads) {
      downloads.value.push(download)
    }

    DownloadManager.onDownloadProgress((data) => {
      if (!findByUrl(data.url)) {
        downloads.value.push(data)
      }

      const download = findByUrl(data.url)

      if (download) {
        download.progress = data.progress
        download.status = data.status
        download.filename = data.filename
        download.savePath = data.savePath
      }
    })
  }

  void initialize()

  function start({
    url,
    savePath,
    filename
  }: {
    url: string
    savePath: string
    filename: string
  }) {
    return DownloadManager!.startDownload(url, savePath, filename)
  }
  function pause(url: string) {
    return DownloadManager!.pauseDownload(url)
  }
  function resume(url: string) {
    return DownloadManager!.resumeDownload(url)
  }
  function cancel(url: string) {
    return DownloadManager!.cancelDownload(url)
  }

  return {
    downloads,
    start,
    pause,
    resume,
    cancel,
    findByUrl,
    initialize,
    inProgressDownloads: computed(() =>
      downloads.value.filter(
        ({ status }) => status !== DownloadStatus.COMPLETED
      )
    )
  }
})
