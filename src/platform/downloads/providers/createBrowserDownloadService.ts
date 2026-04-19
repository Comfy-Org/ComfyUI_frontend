import type { DownloadEntry, DownloadService } from '../types'

export function createBrowserDownloadService(): DownloadService {
  async function start(params: {
    url: string
    savePath: string
    filename: string
  }): Promise<DownloadEntry> {
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

  async function pause() {}
  async function resume() {}
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
    pause,
    resume,
    cancel,
    getAll,
    getById,
    onProgress
  }
}
