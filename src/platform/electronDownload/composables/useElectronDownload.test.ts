import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useElectronDownload } from '@/platform/electronDownload/composables/useElectronDownload'
import { useElectronDownloadStore } from '@/platform/electronDownload/electronDownloadStore'
import type { ElectronDownload } from '@/platform/electronDownload/electronDownloadStore'

vi.mock('@/platform/distribution/types', () => ({ isDesktop: false }))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => ({ DownloadManager: undefined })
}))

function seedDownload(overrides: Partial<ElectronDownload> = {}) {
  const store = useElectronDownloadStore()
  const entry: ElectronDownload = {
    url: 'https://civitai.com/api/download/models/1',
    filename: 'model.safetensors',
    savePath: '/tmp/checkpoints/model.safetensors',
    progress: 0.25,
    status: DownloadStatus.IN_PROGRESS,
    ...overrides
  }
  store.downloads.push(entry)
  return entry
}

describe('useElectronDownload', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('resolves download reactively from the store by URL', () => {
    const seeded = seedDownload()
    const { download } = useElectronDownload(() => seeded.url)
    expect(download.value?.url).toBe(seeded.url)

    // Mutate through the store's reactive entry so computed dependencies fire.
    const store = useElectronDownloadStore()
    const stored = store.findByUrl(seeded.url)!
    stored.progress = 0.5
    expect(download.value?.progress).toBe(0.5)
  })

  it('returns undefined when the URL getter yields undefined', () => {
    seedDownload()
    const urlRef = ref<string | undefined>(undefined)
    const { download } = useElectronDownload(() => urlRef.value)
    expect(download.value).toBeUndefined()
  })

  it('classifies phase correctly for each status', () => {
    const url = 'https://civitai.com/api/download/models/7'
    const { download, phase } = useElectronDownload(() => url)

    expect(phase.value).toBe('none')
    expect(download.value).toBeUndefined()

    seedDownload({ url, status: DownloadStatus.IN_PROGRESS })
    const store = useElectronDownloadStore()
    const stored = store.findByUrl(url)!
    expect(phase.value).toBe('active')

    stored.status = DownloadStatus.PENDING
    expect(phase.value).toBe('active')

    stored.status = DownloadStatus.PAUSED
    expect(phase.value).toBe('active')

    stored.status = DownloadStatus.COMPLETED
    expect(phase.value).toBe('active')

    stored.status = DownloadStatus.CANCELLED
    expect(phase.value).toBe('stopped')

    stored.status = DownloadStatus.ERROR
    expect(phase.value).toBe('stopped')
  })
})
