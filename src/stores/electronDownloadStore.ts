import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { isElectron, electronAPI } from '@/utils/envUtil'
import {
  type DownloadState,
  DownloadStatus
} from '@comfyorg/comfyui-electron-types'

export interface ElectronDownload
  extends Pick<DownloadState, 'url' | 'filename'> {
  progress?: number
  savePath?: string
  status?: DownloadStatus
}

/** Electron donwloads store handler */
export const useElectronDownloadStore = defineStore('downloads', () => {
  const downloads = ref<ElectronDownload[]>([])
  const { DownloadManager } = electronAPI()

  const findByUrl = (url: string) =>
    downloads.value.find((download) => url === download.url)

  const initialize = async () => {
    if (isElectron()) {
      const allDownloads = await DownloadManager.getAllDownloads()

      for (const download of allDownloads) {
        downloads.value.push(download)
      }

      // ToDO: replace with ElectronDownload type
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
  }) => DownloadManager.startDownload(url, savePath, filename)
  const pause = (url: string) => DownloadManager.pauseDownload(url)
  const resume = (url: string) => DownloadManager.resumeDownload(url)
  const cancel = (url: string) => DownloadManager.cancelDownload(url)

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
