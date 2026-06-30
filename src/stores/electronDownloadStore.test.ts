import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useElectronDownloadStore } from '@/stores/electronDownloadStore'

const downloadManagerMock = vi.hoisted(() => ({
  cancelDownload: vi.fn(),
  getAllDownloads: vi.fn(),
  onDownloadProgress: vi.fn(),
  pauseDownload: vi.fn(),
  resumeDownload: vi.fn(),
  startDownload: vi.fn()
}))

vi.mock('@/platform/distribution/types', () => ({
  isDesktop: true
}))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => ({
    DownloadManager: downloadManagerMock
  })
}))

describe('electronDownloadStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    Object.values(downloadManagerMock).forEach((mock) => mock.mockReset())
    downloadManagerMock.getAllDownloads.mockResolvedValue([
      {
        filename: 'done.bin',
        status: DownloadStatus.COMPLETED,
        url: 'https://example.com/done.bin'
      }
    ])
  })

  it('loads existing downloads and applies progress updates by URL', async () => {
    let progressCallback:
      | Parameters<typeof downloadManagerMock.onDownloadProgress>[0]
      | undefined
    downloadManagerMock.onDownloadProgress.mockImplementation((callback) => {
      progressCallback = callback
    })
    const store = useElectronDownloadStore()

    await store.initialize()
    progressCallback?.({
      filename: 'model.bin',
      progress: 25,
      savePath: '/tmp/model.bin',
      status: DownloadStatus.IN_PROGRESS,
      url: 'https://example.com/model.bin'
    })
    progressCallback?.({
      filename: 'model.bin',
      progress: 50,
      savePath: '/tmp/model.bin',
      status: DownloadStatus.IN_PROGRESS,
      url: 'https://example.com/model.bin'
    })

    expect(store.findByUrl('https://example.com/done.bin')?.status).toBe(
      DownloadStatus.COMPLETED
    )
    expect(store.findByUrl('https://example.com/model.bin')).toMatchObject({
      filename: 'model.bin',
      progress: 50,
      status: DownloadStatus.IN_PROGRESS
    })
    expect(store.inProgressDownloads).toHaveLength(1)
  })

  it('delegates download controls to the Electron bridge', async () => {
    const store = useElectronDownloadStore()

    await store.start({
      filename: 'model.bin',
      savePath: '/tmp/model.bin',
      url: 'https://example.com/model.bin'
    })
    await store.pause('https://example.com/model.bin')
    await store.resume('https://example.com/model.bin')
    await store.cancel('https://example.com/model.bin')

    expect(downloadManagerMock.startDownload).toHaveBeenCalledWith(
      'https://example.com/model.bin',
      '/tmp/model.bin',
      'model.bin'
    )
    expect(downloadManagerMock.pauseDownload).toHaveBeenCalledWith(
      'https://example.com/model.bin'
    )
    expect(downloadManagerMock.resumeDownload).toHaveBeenCalledWith(
      'https://example.com/model.bin'
    )
    expect(downloadManagerMock.cancelDownload).toHaveBeenCalledWith(
      'https://example.com/model.bin'
    )
  })
})
