import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import type {
  DownloadProgressUpdate,
  ElectronAPI
} from '@comfyorg/comfyui-electron-types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
import type { ElectronDownload } from '@/stores/electronDownloadStore'

vi.mock('@/platform/distribution/types', () => ({
  isDesktop: true
}))

const progressCallbacks: ((progress: DownloadProgressUpdate) => void)[] = []

const downloadManager = {
  onDownloadProgress: vi.fn((callback: (p: DownloadProgressUpdate) => void) => {
    progressCallbacks.push(callback)
  }),
  startDownload: vi.fn(),
  cancelDownload: vi.fn(),
  pauseDownload: vi.fn(),
  resumeDownload: vi.fn(),
  deleteModel: vi.fn(),
  getAllDownloads: vi.fn(async () => [])
}

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () =>
    ({ DownloadManager: downloadManager }) as unknown as ElectronAPI
}))

function emitProgress(update: DownloadProgressUpdate) {
  progressCallbacks.forEach((callback) => callback(update))
}

describe('electronDownloadStore', () => {
  beforeEach(() => {
    progressCallbacks.length = 0
    setActivePinia(createPinia())
  })

  const url = 'https://example.com/model.safetensors'
  const errorMessage = 'EACCES: permission denied, open /models/checkpoints'

  async function driveDownloadToFailure() {
    const store = useElectronDownloadStore()
    await store.initialize()

    emitProgress({
      url,
      filename: 'model.safetensors',
      savePath: '/models/checkpoints',
      progress: 0.42,
      status: DownloadStatus.IN_PROGRESS
    })

    expect(store.inProgressDownloads.map((d) => d.url)).toEqual([url])

    emitProgress({
      url,
      filename: 'model.safetensors',
      savePath: '/models/checkpoints',
      progress: 0.42,
      status: DownloadStatus.ERROR,
      message: errorMessage
    })

    return store
  }

  it('surfaces the error of a failed download', async () => {
    const store = await driveDownloadToFailure()

    const download: (ElectronDownload & { message?: string }) | undefined =
      store.findByUrl(url)

    expect(download?.status).toBe(DownloadStatus.ERROR)
    expect(download?.message).toBe(errorMessage)
  })

  it('stops reporting a failed download as in progress', async () => {
    const store = await driveDownloadToFailure()

    expect(store.inProgressDownloads.map((d) => d.url)).toEqual([])
  })
})
