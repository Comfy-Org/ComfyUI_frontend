import type {
  DownloadEntry,
  DownloadStartParams,
  NonPausableDownloadService
} from '../types'

export function createBrowserDownloadService(): NonPausableDownloadService {
  async function start(params: DownloadStartParams): Promise<DownloadEntry> {
    const anchorElement = document.createElement('a')
    anchorElement.href = params.url
    anchorElement.download = params.filename
    anchorElement.target = '_blank'
    anchorElement.rel = 'noopener noreferrer'
    anchorElement.click()

    return {
      id: params.url,
      url: params.url,
      filename: params.filename,
      savePath: params.savePath,
      status: 'completed',
      progress: 1
    }
  }

  async function cancel() {}

  function getAll(): DownloadEntry[] {
    return []
  }

  function getById(): null {
    return null
  }

  function onProgress(): () => void {
    return () => {}
  }

  return {
    supportsPauseResume: false,
    start,
    cancel,
    getAll,
    getById,
    onProgress
  }
}
