import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useReleaseStore } from '@/stores/releaseStore'

// Mock the dependencies
vi.mock('@/utils/formatUtil')
vi.mock('@/utils/envUtil')
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
    const { isElectron } = await import('@/utils/envUtil')

    vi.mocked(useReleaseService).mockReturnValue(mockReleaseService)
    vi.mocked(useSettingStore).mockReturnValue(mockSettingStore)
    vi.mocked(useSystemStatsStore).mockReturnValue(mockSystemStatsStore)
    vi.mocked(isElectron).mockReturnValue(true)

    // Default showVersionUpdates to true
    mockSettingStore.get.mockImplementation((key: string) => {
      if (key === 'Comfy.Notification.ShowVersionUpdates') return true
      return null
    })

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

  describe('showVersionUpdates setting', () => {
    beforeEach(() => {
      store.releases = [mockRelease]
    })

    describe('when notifications are enabled', () => {
      beforeEach(() => {
        mockSettingStore.get.mockImplementation((key: string) => {
          if (key === 'Comfy.Notification.ShowVersionUpdates') return true
          return null
        })
      })

      it('should show toast for medium/high attention releases', async () => {
        const { compareVersions } = await import('@/utils/formatUtil')
        vi.mocked(compareVersions).mockReturnValue(1)

        // Need multiple releases for hasMediumOrHighAttention to work
        const mediumRelease = {
          ...mockRelease,
          id: 2,
          attention: 'medium' as const
        }
        store.releases = [mockRelease, mediumRelease]

        expect(store.shouldShowToast).toBe(true)
      })

      it('should show red dot for new versions', async () => {
        const { compareVersions } = await import('@/utils/formatUtil')
        vi.mocked(compareVersions).mockReturnValue(1)

        expect(store.shouldShowRedDot).toBe(true)
      })

      it('should show popup for latest version', async () => {
        mockSystemStatsStore.systemStats.system.comfyui_version = '1.2.0'
        const { compareVersions } = await import('@/utils/formatUtil')
        vi.mocked(compareVersions).mockReturnValue(0)

        expect(store.shouldShowPopup).toBe(true)
      })

      it('should fetch releases during initialization', async () => {
        mockReleaseService.getReleases.mockResolvedValue([mockRelease])

        await store.initialize()

        expect(mockReleaseService.getReleases).toHaveBeenCalledWith({
          project: 'comfyui',
          current_version: '1.0.0',
          form_factor: 'git-windows'
        })
      })
    })

    describe('when notifications are disabled', () => {
      beforeEach(() => {
        mockSettingStore.get.mockImplementation((key: string) => {
          if (key === 'Comfy.Notification.ShowVersionUpdates') return false
          return null
        })
      })

      it('should not show toast even with new version available', async () => {
        const { compareVersions } = await import('@/utils/formatUtil')
        vi.mocked(compareVersions).mockReturnValue(1)

        expect(store.shouldShowToast).toBe(false)
      })

      it('should not show red dot even with new version available', async () => {
        const { compareVersions } = await import('@/utils/formatUtil')
        vi.mocked(compareVersions).mockReturnValue(1)

        expect(store.shouldShowRedDot).toBe(false)
      })

      it('should not show popup even for latest version', async () => {
        mockSystemStatsStore.systemStats.system.comfyui_version = '1.2.0'
        const { compareVersions } = await import('@/utils/formatUtil')
        vi.mocked(compareVersions).mockReturnValue(0)

        expect(store.shouldShowPopup).toBe(false)
      })

      it('should skip fetching releases during initialization', async () => {
        await store.initialize()

        expect(mockReleaseService.getReleases).not.toHaveBeenCalled()
      })

      it('should not fetch releases when calling fetchReleases directly', async () => {
        await store.fetchReleases()

        expect(mockReleaseService.getReleases).not.toHaveBeenCalled()
        expect(store.isLoading).toBe(false)
      })
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

    it('should skip fetching when --disable-api-nodes is present', async () => {
      mockSystemStatsStore.systemStats.system.argv = ['--disable-api-nodes']

      await store.initialize()

      expect(mockReleaseService.getReleases).not.toHaveBeenCalled()
      expect(store.isLoading).toBe(false)
    })

    it('should skip fetching when --disable-api-nodes is one of multiple args', async () => {
      mockSystemStatsStore.systemStats.system.argv = [
        '--port',
        '8080',
        '--disable-api-nodes',
        '--verbose'
      ]

      await store.initialize()

      expect(mockReleaseService.getReleases).not.toHaveBeenCalled()
      expect(store.isLoading).toBe(false)
    })

    it('should fetch normally when --disable-api-nodes is not present', async () => {
      mockSystemStatsStore.systemStats.system.argv = [
        '--port',
        '8080',
        '--verbose'
      ]
      mockReleaseService.getReleases.mockResolvedValue([mockRelease])

      await store.initialize()

      expect(mockReleaseService.getReleases).toHaveBeenCalled()
      expect(store.releases).toEqual([mockRelease])
    })

    it('should fetch normally when argv is undefined', async () => {
      mockSystemStatsStore.systemStats.system.argv = undefined
      mockReleaseService.getReleases.mockResolvedValue([mockRelease])

      await store.initialize()

      expect(mockReleaseService.getReleases).toHaveBeenCalled()
      expect(store.releases).toEqual([mockRelease])
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

    it('should not set loading state when notifications disabled', async () => {
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.Notification.ShowVersionUpdates') return false
        return null
      })

      await store.initialize()

      expect(store.isLoading).toBe(false)
    })
  })

  describe('--disable-api-nodes argument handling', () => {
    it('should skip fetchReleases when --disable-api-nodes is present', async () => {
      mockSystemStatsStore.systemStats.system.argv = ['--disable-api-nodes']

      await store.fetchReleases()

      expect(mockReleaseService.getReleases).not.toHaveBeenCalled()
      expect(store.isLoading).toBe(false)
    })

    it('should skip fetchReleases when --disable-api-nodes is among other args', async () => {
      mockSystemStatsStore.systemStats.system.argv = [
        '--port',
        '8080',
        '--disable-api-nodes',
        '--verbose'
      ]

      await store.fetchReleases()

      expect(mockReleaseService.getReleases).not.toHaveBeenCalled()
      expect(store.isLoading).toBe(false)
    })

    it('should proceed with fetchReleases when --disable-api-nodes is not present', async () => {
      mockSystemStatsStore.systemStats.system.argv = [
        '--port',
        '8080',
        '--verbose'
      ]
      mockReleaseService.getReleases.mockResolvedValue([mockRelease])

      await store.fetchReleases()

      expect(mockReleaseService.getReleases).toHaveBeenCalled()
    })

    it('should proceed with fetchReleases when argv is null', async () => {
      mockSystemStatsStore.systemStats.system.argv = null
      mockReleaseService.getReleases.mockResolvedValue([mockRelease])

      await store.fetchReleases()

      expect(mockReleaseService.getReleases).toHaveBeenCalled()
    })

    it('should proceed with fetchReleases when system stats are not available', async () => {
      mockSystemStatsStore.systemStats = null
      mockReleaseService.getReleases.mockResolvedValue([mockRelease])

      await store.fetchReleases()

      expect(mockSystemStatsStore.fetchSystemStats).toHaveBeenCalled()
      expect(mockReleaseService.getReleases).toHaveBeenCalled()
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
        if (key === 'Comfy.Notification.ShowVersionUpdates') return true
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
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.Notification.ShowVersionUpdates') return true
        return null
      })

      store.releases = [mockRelease]

      expect(store.shouldShowRedDot).toBe(true)
    })

    it('should show popup for latest version', async () => {
      mockSystemStatsStore.systemStats.system.comfyui_version = '1.2.0' // Same as release
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.Notification.ShowVersionUpdates') return true
        return null
      })

      const { compareVersions } = await import('@/utils/formatUtil')
      vi.mocked(compareVersions).mockReturnValue(0) // versions are equal (latest version)

      store.releases = [mockRelease]

      expect(store.shouldShowPopup).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle missing system stats gracefully', async () => {
      mockSystemStatsStore.systemStats = null
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.Notification.ShowVersionUpdates') return false
        return null
      })

      await store.initialize()

      // Should not fetch system stats when notifications disabled
      expect(mockSystemStatsStore.fetchSystemStats).not.toHaveBeenCalled()
    })

    it('should handle concurrent fetchReleases calls', async () => {
      mockReleaseService.getReleases.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve([mockRelease]), 100)
          )
      )

      // Start two concurrent calls
      const promise1 = store.fetchReleases()
      const promise2 = store.fetchReleases()

      await Promise.all([promise1, promise2])

      // Should only call API once due to loading check
      expect(mockReleaseService.getReleases).toHaveBeenCalledTimes(1)
    })
  })

  describe('isElectron environment checks', () => {
    beforeEach(() => {
      // Set up a new version available
      store.releases = [mockRelease]
      mockSettingStore.get.mockImplementation((key: string) => {
        if (key === 'Comfy.Notification.ShowVersionUpdates') return true
        return null
      })
    })

    describe('when running in Electron (desktop)', () => {
      beforeEach(async () => {
        const { isElectron } = await import('@/utils/envUtil')
        vi.mocked(isElectron).mockReturnValue(true)
      })

      it('should show toast when conditions are met', async () => {
        const { compareVersions } = await import('@/utils/formatUtil')
        vi.mocked(compareVersions).mockReturnValue(1)

        // Need multiple releases for hasMediumOrHighAttention
        const mediumRelease = {
          ...mockRelease,
          id: 2,
          attention: 'medium' as const
        }
        store.releases = [mockRelease, mediumRelease]

        expect(store.shouldShowToast).toBe(true)
      })

      it('should show red dot when new version available', async () => {
        const { compareVersions } = await import('@/utils/formatUtil')
        vi.mocked(compareVersions).mockReturnValue(1)

        expect(store.shouldShowRedDot).toBe(true)
      })

      it('should show popup for latest version', async () => {
        mockSystemStatsStore.systemStats.system.comfyui_version = '1.2.0'
        const { compareVersions } = await import('@/utils/formatUtil')
        vi.mocked(compareVersions).mockReturnValue(0)

        expect(store.shouldShowPopup).toBe(true)
      })
    })

    describe('when NOT running in Electron (web)', () => {
      beforeEach(async () => {
        const { isElectron } = await import('@/utils/envUtil')
        vi.mocked(isElectron).mockReturnValue(false)
      })

      it('should NOT show toast even when all other conditions are met', async () => {
        const { compareVersions } = await import('@/utils/formatUtil')
        vi.mocked(compareVersions).mockReturnValue(1)

        // Set up all conditions that would normally show toast
        const mediumRelease = {
          ...mockRelease,
          id: 2,
          attention: 'medium' as const
        }
        store.releases = [mockRelease, mediumRelease]

        expect(store.shouldShowToast).toBe(false)
      })

      it('should NOT show red dot even when new version available', async () => {
        const { compareVersions } = await import('@/utils/formatUtil')
        vi.mocked(compareVersions).mockReturnValue(1)

        expect(store.shouldShowRedDot).toBe(false)
      })

      it('should NOT show toast regardless of attention level', async () => {
        const { compareVersions } = await import('@/utils/formatUtil')
        vi.mocked(compareVersions).mockReturnValue(1)

        // Test with high attention releases
        const highRelease = {
          ...mockRelease,
          id: 2,
          attention: 'high' as const
        }
        const mediumRelease = {
          ...mockRelease,
          id: 3,
          attention: 'medium' as const
        }
        store.releases = [highRelease, mediumRelease]

        expect(store.shouldShowToast).toBe(false)
      })

      it('should NOT show red dot even with high attention release', async () => {
        const { compareVersions } = await import('@/utils/formatUtil')
        vi.mocked(compareVersions).mockReturnValue(1)

        store.releases = [{ ...mockRelease, attention: 'high' as const }]

        expect(store.shouldShowRedDot).toBe(false)
      })

      it('should NOT show popup even for latest version', async () => {
        mockSystemStatsStore.systemStats.system.comfyui_version = '1.2.0'
        const { compareVersions } = await import('@/utils/formatUtil')
        vi.mocked(compareVersions).mockReturnValue(0)

        expect(store.shouldShowPopup).toBe(false)
      })
    })
  })
})
