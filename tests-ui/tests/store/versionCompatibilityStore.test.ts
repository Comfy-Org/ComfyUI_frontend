import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { useVersionCompatibilityStore } from '@/stores/versionCompatibilityStore'

vi.mock('@/config', () => ({
  default: {
    app_version: '1.24.0'
  }
}))

vi.mock('@/stores/systemStatsStore')

// Mock useStorage from VueUse
const mockDismissalStorage = ref({} as Record<string, number>)
vi.mock('@vueuse/core', () => ({
  useStorage: vi.fn(() => mockDismissalStorage)
}))

describe('useVersionCompatibilityStore', () => {
  let store: ReturnType<typeof useVersionCompatibilityStore>
  let mockSystemStatsStore: any

  beforeEach(() => {
    setActivePinia(createPinia())

    // Clear the mock dismissal storage
    mockDismissalStorage.value = {}

    mockSystemStatsStore = {
      systemStats: null,
      fetchSystemStats: vi.fn()
    }

    vi.mocked(useSystemStatsStore).mockReturnValue(mockSystemStatsStore)

    store = useVersionCompatibilityStore()
  })

  afterEach(() => {
    vi.clearAllMocks()
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

    it('should not warn when frontend is newer than backend', async () => {
      // Frontend: 1.24.0, Backend: 1.23.0, Required: 1.23.0
      // Frontend meets required version, no warning needed
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.23.0',
          required_frontend_version: '1.23.0'
        }
      }

      await store.checkVersionCompatibility()

      expect(store.isFrontendOutdated).toBe(false)
      expect(store.isFrontendNewer).toBe(false)
      expect(store.hasVersionMismatch).toBe(false)
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

    it('should not detect mismatch when versions are not valid semver', async () => {
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '080e6d4af809a46852d1c4b7ed85f06e8a3a72be', // git hash
          required_frontend_version: 'not-a-version' // invalid semver format
        }
      }

      await store.checkVersionCompatibility()

      expect(store.isFrontendOutdated).toBe(false)
      expect(store.isFrontendNewer).toBe(false)
      expect(store.hasVersionMismatch).toBe(false)
    })

    it('should not warn when frontend exceeds required version', async () => {
      // Frontend: 1.24.0 (from mock config)
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.22.0', // Backend is older
          required_frontend_version: '1.23.0' // Required is 1.23.0, frontend 1.24.0 meets this
        }
      }

      await store.checkVersionCompatibility()

      expect(store.isFrontendOutdated).toBe(false) // Frontend 1.24.0 >= Required 1.23.0
      expect(store.isFrontendNewer).toBe(false) // Never warns about being newer
      expect(store.hasVersionMismatch).toBe(false)
    })
  })

  describe('warning display logic', () => {
    it('should show warning when there is a version mismatch and not dismissed', async () => {
      // No dismissals in storage
      mockDismissalStorage.value = {}
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
      const futureTime = Date.now() + 1000000
      // Set dismissal in reactive storage
      mockDismissalStorage.value = {
        '1.24.0-1.25.0-1.25.0': futureTime
      }

      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.25.0',
          required_frontend_version: '1.25.0'
        }
      }

      await store.checkVersionCompatibility()

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
    it('should save dismissal to reactive storage with expiration', async () => {
      const mockNow = 1000000
      vi.spyOn(Date, 'now').mockReturnValue(mockNow)

      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.25.0',
          required_frontend_version: '1.25.0'
        }
      }

      await store.checkVersionCompatibility()
      store.dismissWarning()

      // Check that the dismissal was added to reactive storage
      expect(mockDismissalStorage.value).toEqual({
        '1.24.0-1.25.0-1.25.0': mockNow + 7 * 24 * 60 * 60 * 1000
      })
    })

    it('should check dismissal state from reactive storage', async () => {
      const futureTime = Date.now() + 1000000 // Still valid
      mockDismissalStorage.value = {
        '1.24.0-1.25.0-1.25.0': futureTime
      }

      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.25.0',
          required_frontend_version: '1.25.0'
        }
      }

      await store.initialize()

      expect(store.shouldShowWarning).toBe(false)
    })

    it('should show warning if dismissal has expired', async () => {
      const pastTime = Date.now() - 1000 // Expired
      mockDismissalStorage.value = {
        '1.24.0-1.25.0-1.25.0': pastTime
      }

      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '1.25.0',
          required_frontend_version: '1.25.0'
        }
      }

      await store.initialize()

      expect(store.shouldShowWarning).toBe(true)
    })

    it('should show warning for different version combinations even if previous was dismissed', async () => {
      const futureTime = Date.now() + 1000000
      // Dismissed for different version combination (1.25.0) but current is 1.26.0
      mockDismissalStorage.value = {
        '1.24.0-1.25.0-1.25.0': futureTime // Different version was dismissed
      }

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
