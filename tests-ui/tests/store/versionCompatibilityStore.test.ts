import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/stores/settingStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { useVersionCompatibilityStore } from '@/stores/versionCompatibilityStore'

vi.mock('@/config', () => ({
  default: {
    app_version: '1.24.0'
  }
}))

vi.mock('@/stores/systemStatsStore')
vi.mock('@/stores/settingStore')

describe('useVersionCompatibilityStore', () => {
  let store: ReturnType<typeof useVersionCompatibilityStore>
  let mockSystemStatsStore: any
  let mockSettingStore: any

  beforeEach(() => {
    setActivePinia(createPinia())

    mockSystemStatsStore = {
      systemStats: null,
      fetchSystemStats: vi.fn()
    }

    mockSettingStore = {
      get: vi.fn(),
      set: vi.fn()
    }

    vi.mocked(useSystemStatsStore).mockReturnValue(mockSystemStatsStore)
    vi.mocked(useSettingStore).mockReturnValue(mockSettingStore)

    store = useVersionCompatibilityStore()
  })

  describe('version compatibility detection', () => {
    it('should detect frontend is outdated when required version is higher', async () => {
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.25.0',
          required_frontend_version: '1.25.0'
        }
      }

      await store.checkVersionCompatibility()

      expect(store.isFrontendOutdated).toBe(true)
      expect(store.isFrontendNewer).toBe(false)
      expect(store.hasVersionMismatch).toBe(true)
    })

    it('should detect frontend is newer when frontend version is higher than backend', async () => {
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.23.0',
          required_frontend_version: '1.23.0'
        }
      }

      await store.checkVersionCompatibility()

      expect(store.isFrontendOutdated).toBe(false)
      expect(store.isFrontendNewer).toBe(true)
      expect(store.hasVersionMismatch).toBe(true)
    })

    it('should not detect mismatch when versions are compatible', async () => {
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.24.0',
          required_frontend_version: '1.24.0'
        }
      }

      await store.checkVersionCompatibility()

      expect(store.isFrontendOutdated).toBe(false)
      expect(store.isFrontendNewer).toBe(false)
      expect(store.hasVersionMismatch).toBe(false)
    })

    it('should handle missing version information gracefully', async () => {
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '',
          required_frontend_version: ''
        }
      }

      await store.checkVersionCompatibility()

      expect(store.isFrontendOutdated).toBe(false)
      expect(store.isFrontendNewer).toBe(false)
      expect(store.hasVersionMismatch).toBe(false)
    })
  })

  describe('warning display logic', () => {
    beforeEach(() => {
      mockSettingStore.get.mockReturnValue('')
    })

    it('should show warning when there is a version mismatch and not dismissed', async () => {
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.25.0',
          required_frontend_version: '1.25.0'
        }
      }

      await store.checkVersionCompatibility()

      expect(store.shouldShowWarning).toBe(true)
    })

    it('should not show warning when dismissed', async () => {
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.25.0',
          required_frontend_version: '1.25.0'
        }
      }

      await store.checkVersionCompatibility()
      void store.dismissWarning()

      expect(store.shouldShowWarning).toBe(false)
    })

    it('should not show warning when no version mismatch', async () => {
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.24.0',
          required_frontend_version: '1.24.0'
        }
      }

      await store.checkVersionCompatibility()

      expect(store.shouldShowWarning).toBe(false)
    })
  })

  describe('warning messages', () => {
    it('should generate outdated message when frontend is outdated', async () => {
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.25.0',
          required_frontend_version: '1.25.0'
        }
      }

      await store.checkVersionCompatibility()

      expect(store.warningMessage).toEqual({
        type: 'outdated',
        frontendVersion: '1.24.0',
        requiredVersion: '1.25.0'
      })
    })

    it('should generate newer message when frontend is newer', async () => {
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.23.0',
          required_frontend_version: '1.23.0'
        }
      }

      await store.checkVersionCompatibility()

      expect(store.warningMessage).toEqual({
        type: 'newer',
        frontendVersion: '1.24.0',
        backendVersion: '1.23.0'
      })
    })

    it('should return null when no mismatch', async () => {
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.24.0',
          required_frontend_version: '1.24.0'
        }
      }

      await store.checkVersionCompatibility()

      expect(store.warningMessage).toBeNull()
    })
  })

  describe('dismissal persistence', () => {
    it('should save dismissal to settings', async () => {
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.25.0',
          required_frontend_version: '1.25.0'
        }
      }

      await store.checkVersionCompatibility()
      await store.dismissWarning()

      expect(mockSettingStore.set).toHaveBeenCalledWith(
        'Comfy.VersionMismatch.DismissedVersion',
        '1.24.0-1.25.0-1.25.0'
      )
    })

    it('should restore dismissal state from settings', async () => {
      mockSettingStore.get.mockReturnValue('1.24.0-1.25.0-1.25.0')
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.25.0',
          required_frontend_version: '1.25.0'
        }
      }

      await store.initialize()

      expect(store.shouldShowWarning).toBe(false)
    })

    it('should show warning for different version combinations even if previous was dismissed', async () => {
      mockSettingStore.get.mockReturnValue('1.24.0-1.25.0-1.25.0')
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.26.0',
          required_frontend_version: '1.26.0'
        }
      }

      await store.initialize()

      expect(store.shouldShowWarning).toBe(true)
    })
  })

  describe('initialization', () => {
    it('should fetch system stats if not available', async () => {
      mockSystemStatsStore.systemStats = null

      await store.initialize()

      expect(mockSystemStatsStore.fetchSystemStats).toHaveBeenCalled()
    })

    it('should not fetch system stats if already available', async () => {
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.24.0',
          required_frontend_version: '1.24.0'
        }
      }

      await store.initialize()

      expect(mockSystemStatsStore.fetchSystemStats).not.toHaveBeenCalled()
    })
  })
})
