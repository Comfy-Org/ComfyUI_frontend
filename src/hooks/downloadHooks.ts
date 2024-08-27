import { ref } from 'vue'
import { api } from '@/scripts/api'
import { DownloadModelStatus } from '@/types/apiTypes'
import { useToastStore } from '@/stores/toastStore'

export enum DownloadState {
  Idle = 'idle',
  Downloading = 'downloading',
  Completed = 'completed',
  Error = 'error'
}

export interface DownloadTask {
  url: string
  directory: string
  filename: string
}

export function useDownload() {
  const toast = useToastStore()
  const downloadState = ref<DownloadState>(DownloadState.Idle)
  const progress = ref(0)
  const currentFilePath = ref<string | null>(null)

  const reportError = (message: string) => {
    toast.add({ severity: 'error', summary: 'Error', detail: message })
  }

  const handleDownloadProgress = (detail: DownloadModelStatus) => {
    if (detail.download_path !== currentFilePath.value) {
      return
    }

    if (detail.status === 'in_progress') {
      downloadState.value = DownloadState.Downloading
      progress.value = detail.progress_percentage
    } else if (detail.status === 'pending') {
      downloadState.value = DownloadState.Downloading
      progress.value = 0
    } else if (detail.status === 'completed') {
      downloadState.value = DownloadState.Completed
      progress.value = 100
    } else if (detail.status === 'error') {
      downloadState.value = DownloadState.Error
      progress.value = 0
      reportError(detail.message)
    }
  }

  const triggerDownload = async (downloadTask: DownloadTask) => {
    if (downloadState.value !== DownloadState.Idle) {
      return
    }

    progress.value = 0
    try {
      const status: DownloadModelStatus = await api.internalDownloadModel(
        downloadTask.url,
        downloadTask.directory,
        downloadTask.filename,
        1
      )
      handleDownloadProgress(status)
      currentFilePath.value = status.download_path
    } catch (err) {
      reportError(`Failed to start download: ${err}`)
      downloadState.value = DownloadState.Error
    }
  }

  api.addEventListener(
    'download_progress',
    (event: CustomEvent<DownloadModelStatus>) => {
      handleDownloadProgress(event.detail)
    }
  )

  return {
    downloadState,
    progress,
    triggerDownload
  }
}
