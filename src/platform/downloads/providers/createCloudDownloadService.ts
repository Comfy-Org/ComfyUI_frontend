import type { DownloadEntry, DownloadService } from '../types'

export function createCloudDownloadService(): DownloadService {
  const entries = new Map<string, DownloadEntry>()
  const progressListeners = new Map<
    string,
    Set<(entry: DownloadEntry) => void>
  >()

  async function start(params: {
    url: string
    savePath: string
    filename: string
  }): Promise<DownloadEntry> {
    const { assetService } =
      await import('@/platform/assets/services/assetService')

    const result = await assetService.uploadAssetAsync({
      source_url: params.url,
      tags: ['models']
    })

    const id = result.type === 'async' ? result.task.task_id : params.url
    const entry: DownloadEntry = {
      id,
      url: params.url,
      filename: params.filename,
      savePath: params.savePath,
      status: result.type === 'async' ? 'in_progress' : 'completed',
      progress: result.type === 'async' ? 0 : 1
    }
    entries.set(id, entry)
    return entry
  }

  async function pause() {}
  async function resume() {}
  async function cancel() {}

  function getAll(): DownloadEntry[] {
    return [...entries.values()]
  }

  function getById(id: string): DownloadEntry | null {
    return entries.get(id) ?? null
  }

  function onProgress(
    id: string,
    cb: (entry: DownloadEntry) => void
  ): () => void {
    if (!progressListeners.has(id)) {
      progressListeners.set(id, new Set())
    }
    progressListeners.get(id)!.add(cb)
    return () => {
      progressListeners.get(id)?.delete(cb)
    }
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
