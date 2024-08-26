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

export function useDownload() {
  const toast = useToastStore()
  const downloadState = ref<DownloadState>(DownloadState.Idle)
  const progress = ref(0)

  const reportError = (message: string) => {
    toast.add({ severity: 'error', summary: 'Error', detail: message })
  }

  const handleDownloadProgress = (detail: DownloadModelStatus) => {
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

  const triggerDownload = async (
    url: string,
    directory: string,
    filename: string
  ) => {
    if (downloadState.value !== DownloadState.Idle) {
      return
    }

    progress.value = 0
    try {
      const download = await api.internalDownloadModel(
        url,
        directory,
        filename,
        1
      )
      handleDownloadProgress(download)
    } catch (err) {
      reportError(`Failed to start download: ${err}`)
      downloadState.value = DownloadState.Error
    }
  }

  api.addEventListener('download_progress', (event) => {
    handleDownloadProgress(event.detail)
  })

  return {
    downloadState,
    progress,
    triggerDownload
  }
}
