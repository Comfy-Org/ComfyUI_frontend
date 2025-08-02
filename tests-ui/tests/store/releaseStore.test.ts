import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useReleaseStore } from '@/stores/releaseStore'

// Mock the dependencies
vi.mock('@/utils/formatUtil')
vi.mock('@/services/releaseService')
vi.mock('@/stores/settingStore')
vi.mock('@/stores/systemStatsStore')

describe('useReleaseStore', () => {
  let store: ReturnType<typeof useReleaseStore>
  let mockReleaseService: any
  let mockSettingStore: any
  let mockSystemStatsStore: any

  const mockRelease = {
    id: 1,
    project: 'comfyui' as const,
    version: '1.2.0',
    content: 'New features and improvements',
    published_at: '2023-12-01T00:00:00Z',
    attention: 'high' as const
  }

  beforeEach(async () => {
    setActivePinia(createPinia())

    // Reset all mocks
    vi.clearAllMocks()

    // Setup mock services
    mockReleaseService = {
      getReleases: vi.fn(),
      isLoading: { value: false },
      error: { value: null }
    }

    mockSettingStore = {
      get: vi.fn(),
      set: vi.fn()
    }

    mockSystemStatsStore = {
      systemStats: {
        system: {
          comfyui_version: '1.0.0'
        }
      },
      fetchSystemStats: vi.fn(),
      getFormFactor: vi.fn(() => 'git-windows')
    }

    // Setup mock implementations
    const { useReleaseService } = await import('@/services/releaseService')
    const { useSettingStore } = await import('@/stores/settingStore')
    const { useSystemStatsStore } = await import('@/stores/systemStatsStore')

    vi.mocked(useReleaseService).mockReturnValue(mockReleaseService)
    vi.mocked(useSettingStore).mockReturnValue(mockSettingStore)
    vi.mocked(useSystemStatsStore).mockReturnValue(mockSystemStatsStore)

    store = useReleaseStore()
  })

  describe('initial state', () => {
    it('should initialize with default state', () => {
      expect(store.releases).toEqual([])
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('computed properties', () => {
    it('should return most recent release', () => {
      const olderRelease = {
        ...mockRelease,
        id: 2,
        version: '1.1.0',
        published_at: '2023-11-01T00:00:00Z'
      }

      store.releases = [mockRelease, olderRelease]
      expect(store.recentRelease).toEqual(mockRelease)
    })

    it('should return 3 most recent releases', () => {
      const releases = [
        mockRelease,
        { ...mockRelease, id: 2, version: '1.1.0' },
        { ...mockRelease, id: 3, version: '1.0.0' },
        { ...mockRelease, id: 4, version: '0.9.0' }
      ]

      store.releases = releases
      expect(store.recentReleases).toEqual(releases.slice(0, 3))
    })

    it('should show update button (shouldShowUpdateButton)', async () => {
      const { compareVersions } = await import('@/utils/formatUtil')
      vi.mocked(compareVersions).mockReturnValue(1) // newer version available

      store.releases = [mockRelease]
      expect(store.shouldShowUpdateButton).toBe(true)
    })

    it('should not show update button when no new version', async () => {
      const { compareVersions } = await import('@/utils/formatUtil')
      vi.mocked(compareVersions).mockReturnValue(-1) // current version is newer

      store.releases = [mockRelease]
      expect(store.shouldShowUpdateButton).toBe(false)
    })
  })

  describe('release initialization', () => {
    it('should fetch releases successfully', async () => {
      mockReleaseService.getReleases.mockResolvedValue([mockRelease])

      await store.initialize()

      expect(mockReleaseService.getReleases).toHaveBeenCalledWith({
        project: 'comfyui',
        current_version: '1.0.0',
        form_factor: 'git-windows'
      })
      expect(store.releases).toEqual([mockRelease])
    })

    it('should include form_factor in API call', async () => {
      mockSystemStatsStore.getFormFactor.mockReturnValue('desktop-mac')
      mockReleaseService.getReleases.mockResolvedValue([mockRelease])

      await store.initialize()

      expect(mockReleaseService.getReleases).toHaveBeenCalledWith({
        project: 'comfyui',
        current_version: '1.0.0',
        form_factor: 'desktop-mac'
      })
    })

    it('should handle API errors gracefully', async () => {
      mockReleaseService.getReleases.mockResolvedValue(null)
      mockReleaseService.error.value = 'API Error'

      await store.initialize()

      expect(store.releases).toEqual([])
      expect(store.error).toBe('API Error')
    })

    it('should handle non-Error objects', async () => {
      mockReleaseService.getReleases.mockRejectedValue('String error')

      await store.initialize()

      expect(store.error).toBe('Unknown error occurred')
    })

    it('should set loading state correctly', async () => {
      let resolvePromise: (value: any) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      mockReleaseService.getReleases.mockReturnValue(promise)

      const initPromise = store.initialize()
      expect(store.isLoading).toBe(true)

      resolvePromise!([mockRelease])
      await initPromise

      expect(store.isLoading).toBe(false)
    })

    it('should fetch system stats if not available', async () => {
      mockSystemStatsStore.systemStats = null
      mockReleaseService.getReleases.mockResolvedValue([mockRelease])

      await store.initialize()

      expect(mockSystemStatsStore.fetchSystemStats).toHaveBeenCalled()
    })
  })

  describe('action handlers', () => {
    beforeEach(() => {
      store.releases = [mockRelease]
    })

    it('should handle skip release', async () => {
      await store.handleSkipRelease('1.2.0')

      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.Release.Version',
        '1.2.0'
      )
      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.Release.Status',
        'skipped'
      )
      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.Release.Timestamp',
        expect.any(Number)
      )
    })

    it('should handle show changelog', async () => {
      await store.handleShowChangelog('1.2.0')

      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.Release.Version',
        '1.2.0'
      )
      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.Release.Status',
        'changelog seen'
      )
      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.Release.Timestamp',
        expect.any(Number)
      )
    })

    it('should handle whats new seen', async () => {
      await store.handleWhatsNewSeen('1.2.0')

      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.Release.Version',
        '1.2.0'
      )
      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.Release.Status',
        "what's new seen"
      )
      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.Release.Timestamp',
        expect.any(Number)
      )
    })
  })

  describe('popup visibility', () => {
    it('should show toast for medium/high attention releases', async () => {
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.Release.Version') return null
        if (key === 'Comfy.Release.Status') return null
        return null
      })

      const { compareVersions } = await import('@/utils/formatUtil')
      vi.mocked(compareVersions).mockReturnValue(1)

      const mediumRelease = { ...mockRelease, attention: 'medium' as const }
      store.releases = [
        mockRelease,
        mediumRelease,
        { ...mockRelease, attention: 'low' as const }
      ]

      expect(store.shouldShowToast).toBe(true)
    })

    it('should show red dot for new versions', async () => {
      const { compareVersions } = await import('@/utils/formatUtil')
      vi.mocked(compareVersions).mockReturnValue(1)
      mockSettingStore.get.mockReturnValue(null)

      store.releases = [mockRelease]

      expect(store.shouldShowRedDot).toBe(true)
    })

    it('should show popup for latest version', async () => {
      mockSystemStatsStore.systemStats.system.comfyui_version = '1.2.0' // Same as release
      mockSettingStore.get.mockReturnValue(null)

      const { compareVersions } = await import('@/utils/formatUtil')
      vi.mocked(compareVersions).mockReturnValue(0) // versions are equal (latest version)

      store.releases = [mockRelease]

      expect(store.shouldShowPopup).toBe(true)
    })
  })
})
