import { ref } from 'vue'
import { defineStore } from 'pinia'
import { isElectron, electronAPI } from '@/utils/envUtil'

export interface ElectronDownload {
  url: string
  status: 'paused' | 'in_progress' | 'cancelled'
  progress: number
  savePath: string
  filename: string
}

/** Electron donwloads store handler */
export const useElectronDownloadStore = defineStore('downloads', () => {
  const downloads = ref<ElectronDownload[]>([])
  const { DownloadManager } = electronAPI()

  const findByUrl = (url: string) =>
    downloads.value.find((download) => url === download.url)

  const initialize = async () => {
    if (isElectron()) {
      const allDownloads: ElectronDownload[] =
        await DownloadManager.getAllDownloads()

      for (const download of allDownloads) {
        downloads.value.push(download)
      }

      // ToDO: replace with ElectronDownload type
      DownloadManager.onDownloadProgress((data: any) => {
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
  }: Pick<ElectronDownload, 'url' | 'savePath' | 'filename'>) =>
    DownloadManager.startDownload(url, savePath, filename)
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
    initialize
  }
})
