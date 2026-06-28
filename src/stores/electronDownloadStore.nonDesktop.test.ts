import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useElectronDownloadStore } from '@/stores/electronDownloadStore'

const electronAPI = vi.hoisted(() => vi.fn())

vi.mock('@/platform/distribution/types', () => ({ isDesktop: false }))
vi.mock('@/utils/envUtil', () => ({ electronAPI }))

describe('electronDownloadStore outside desktop', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    electronAPI.mockClear()
  })

  it('skips the Electron bridge when not running on desktop', async () => {
    const store = useElectronDownloadStore()

    await store.initialize()

    expect(electronAPI).not.toHaveBeenCalled()
    expect(store.downloads).toEqual([])
  })
})
