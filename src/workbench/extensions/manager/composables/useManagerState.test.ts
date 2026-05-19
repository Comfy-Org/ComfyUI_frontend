import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import {
  ManagerUIState,
  __resetIncompatibleToastGuard,
  useManagerState
} from '@/workbench/extensions/manager/composables/useManagerState'

// Mock dependencies that are not stores
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

vi.mock('@/scripts/api', () => ({
  api: {
    getClientFeatureFlags: vi.fn(),
    getServerFeature: vi.fn(),
    getSystemStats: vi.fn()
  }
}))

vi.mock('@/composables/useFeatureFlags', () => {
  const featureFlag = vi.fn()
  return {
    useFeatureFlags: vi.fn(() => ({
      flags: { supportsManagerV4: false },
      featureFlag
    }))
  }
})

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: vi.fn(() => ({
    show: vi.fn(),
    hide: vi.fn(),
    showAbout: vi.fn()
  }))
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: vi.fn(() => ({
    execute: vi.fn()
  }))
}))

const { toastAddMock } = vi.hoisted(() => ({
  toastAddMock: vi.fn()
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: vi.fn(() => ({
    add: toastAddMock
  }))
}))

vi.mock('@/workbench/extensions/manager/composables/useManagerDialog', () => {
  const show = vi.fn()
  const hide = vi.fn()
  return {
    useManagerDialog: vi.fn(() => ({
      show,
      hide
    }))
  }
})

/**
 * Helper to build a minimal systemStats argv-only fixture.
 * Feature-flag values are supplied separately via mocked `api`.
 */
const systemStatsFixture = (argv: string[]) => ({
  system: {
    os: 'Test OS',
    python_version: '3.10',
    embedded_python: false,
    comfyui_version: '1.0.0',
    pytorch_version: '2.0.0',
    argv,
    ram_total: 16000000000,
    ram_free: 8000000000
  },
  devices: []
})

/**
 * Mocks the two server feature flags queried by useManagerState.
 * `supports_v4`        → `extension.manager.supports_v4`
 * `supports_csrf_post` → `extension.manager.supports_csrf_post`
 */
const mockServerFeatures = (flags: {
  supports_v4?: boolean
  supports_csrf_post?: boolean
}) => {
  vi.mocked(api.getServerFeature).mockImplementation((name: string) => {
    if (name === 'extension.manager.supports_v4') return flags.supports_v4
    if (name === 'extension.manager.supports_csrf_post')
      return flags.supports_csrf_post
    return undefined
  })
}

describe('useManagerState', () => {
  let systemStatsStore: ReturnType<typeof useSystemStatsStore>

  beforeEach(() => {
    // Create a fresh testing pinia and activate it for each test
    setActivePinia(
      createTestingPinia({
        stubActions: false,
        createSpy: vi.fn
      })
    )

    // Initialize stores
    systemStatsStore = useSystemStatsStore()

    // Reset all mocks
    vi.clearAllMocks()
    __resetIncompatibleToastGuard()

    // Set default mock returns
    vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
    vi.mocked(api.getServerFeature).mockReturnValue(undefined)
  })

  describe('managerUIState property', () => {
    it('should return DISABLED state when --enable-manager is NOT present', () => {
      systemStatsStore.$patch({
        systemStats: systemStatsFixture(['python', 'main.py']),
        isInitialized: true
      })

      const managerState = useManagerState()
      expect(managerState.managerUIState.value).toBe(ManagerUIState.DISABLED)
    })

    it('should return LEGACY_UI state when --enable-manager-legacy-ui is present', () => {
      systemStatsStore.$patch({
        systemStats: systemStatsFixture([
          'python',
          'main.py',
          '--enable-manager',
          '--enable-manager-legacy-ui'
        ]),
        isInitialized: true
      })

      const managerState = useManagerState()
      expect(managerState.managerUIState.value).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should return NEW_UI state when client and server both support v4 AND csrf_post', () => {
      systemStatsStore.$patch({
        systemStats: systemStatsFixture([
          'python',
          'main.py',
          '--enable-manager'
        ]),
        isInitialized: true
      })

      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      mockServerFeatures({ supports_v4: true, supports_csrf_post: true })

      const managerState = useManagerState()
      expect(managerState.managerUIState.value).toBe(ManagerUIState.NEW_UI)
    })

    it('should return LEGACY_UI state when server supports v4 but client does not (and csrf_post present)', () => {
      systemStatsStore.$patch({
        systemStats: systemStatsFixture([
          'python',
          'main.py',
          '--enable-manager'
        ]),
        isInitialized: true
      })

      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: false
      })
      mockServerFeatures({ supports_v4: true, supports_csrf_post: true })

      const managerState = useManagerState()
      expect(managerState.managerUIState.value).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should return LEGACY_UI state when server does not support v4', () => {
      systemStatsStore.$patch({
        systemStats: systemStatsFixture([
          'python',
          'main.py',
          '--enable-manager'
        ]),
        isInitialized: true
      })

      vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
      mockServerFeatures({ supports_v4: false })

      const managerState = useManagerState()
      expect(managerState.managerUIState.value).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should return NEW_UI state when server feature flags are undefined (transient fallback)', () => {
      systemStatsStore.$patch({
        systemStats: systemStatsFixture([
          'python',
          'main.py',
          '--enable-manager'
        ]),
        isInitialized: true
      })

      vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
      vi.mocked(api.getServerFeature).mockReturnValue(undefined)

      const managerState = useManagerState()
      expect(managerState.managerUIState.value).toBe(ManagerUIState.NEW_UI)
    })

    it('should handle null systemStats gracefully', () => {
      systemStatsStore.$patch({
        systemStats: null,
        isInitialized: true
      })

      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      mockServerFeatures({ supports_v4: true, supports_csrf_post: true })

      const managerState = useManagerState()
      expect(managerState.managerUIState.value).toBe(ManagerUIState.DISABLED)
    })
  })

  describe('INCOMPATIBLE state (missing supports_csrf_post)', () => {
    const enabledManagerStats = () =>
      systemStatsFixture(['python', 'main.py', '--enable-manager'])

    it('returns INCOMPATIBLE when server supports v4 but csrf_post is false', () => {
      systemStatsStore.$patch({
        systemStats: enabledManagerStats(),
        isInitialized: true
      })
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      mockServerFeatures({ supports_v4: true, supports_csrf_post: false })

      const managerState = useManagerState()
      expect(managerState.managerUIState.value).toBe(
        ManagerUIState.INCOMPATIBLE
      )
    })

    it('returns INCOMPATIBLE when server supports v4 but csrf_post is undefined', () => {
      systemStatsStore.$patch({
        systemStats: enabledManagerStats(),
        isInitialized: true
      })
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      mockServerFeatures({ supports_v4: true, supports_csrf_post: undefined })

      const managerState = useManagerState()
      expect(managerState.managerUIState.value).toBe(
        ManagerUIState.INCOMPATIBLE
      )
    })

    it('isIncompatibleManager is true only in INCOMPATIBLE state', () => {
      systemStatsStore.$patch({
        systemStats: enabledManagerStats(),
        isInitialized: true
      })
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      mockServerFeatures({ supports_v4: true, supports_csrf_post: false })

      const managerState = useManagerState()
      expect(managerState.isIncompatibleManager.value).toBe(true)
      expect(managerState.isNewManagerUI.value).toBe(false)
      expect(managerState.isLegacyManagerUI.value).toBe(false)
    })

    it('shouldShowManagerButtons is false in INCOMPATIBLE state (hide UI)', () => {
      systemStatsStore.$patch({
        systemStats: enabledManagerStats(),
        isInitialized: true
      })
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      mockServerFeatures({ supports_v4: true, supports_csrf_post: false })

      const managerState = useManagerState()
      expect(managerState.shouldShowManagerButtons.value).toBe(false)
      expect(managerState.isManagerEnabled.value).toBe(false)
    })

    it('fires warn-severity toast exactly once across multiple consumers', () => {
      systemStatsStore.$patch({
        systemStats: enabledManagerStats(),
        isInitialized: true
      })
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      mockServerFeatures({ supports_v4: true, supports_csrf_post: false })

      useManagerState()
      useManagerState()
      useManagerState()

      expect(toastAddMock).toHaveBeenCalledTimes(1)
      expect(toastAddMock).toHaveBeenCalledWith({
        severity: 'warn',
        summary: 'manager.incompatibleVersion.title',
        detail: 'manager.incompatibleVersion.message',
        life: 15000
      })
    })

    it('openManager on INCOMPATIBLE re-emits the upgrade toast without settings redirect', async () => {
      systemStatsStore.$patch({
        systemStats: enabledManagerStats(),
        isInitialized: true
      })
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      mockServerFeatures({ supports_v4: true, supports_csrf_post: false })

      const managerState = useManagerState()
      expect(toastAddMock).toHaveBeenCalledTimes(1)

      await managerState.openManager()
      expect(toastAddMock).toHaveBeenCalledTimes(2)
      // second call must still be the upgrade toast, not an error toast
      expect(toastAddMock).toHaveBeenLastCalledWith({
        severity: 'warn',
        summary: 'manager.incompatibleVersion.title',
        detail: 'manager.incompatibleVersion.message',
        life: 15000
      })
    })

    it('does not fire upgrade toast when state is NEW_UI', () => {
      systemStatsStore.$patch({
        systemStats: enabledManagerStats(),
        isInitialized: true
      })
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      mockServerFeatures({ supports_v4: true, supports_csrf_post: true })

      useManagerState()
      expect(toastAddMock).not.toHaveBeenCalled()
    })
  })

  describe('helper properties', () => {
    const enabledManagerStats = () =>
      systemStatsFixture(['python', 'main.py', '--enable-manager'])

    it('isManagerEnabled should return true when state is not DISABLED / INCOMPATIBLE', () => {
      systemStatsStore.$patch({
        systemStats: enabledManagerStats(),
        isInitialized: true
      })
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      mockServerFeatures({ supports_v4: true, supports_csrf_post: true })

      const managerState = useManagerState()
      expect(managerState.isManagerEnabled.value).toBe(true)
    })

    it('isManagerEnabled should return false when state is DISABLED', () => {
      systemStatsStore.$patch({
        systemStats: systemStatsFixture(['python', 'main.py']),
        isInitialized: true
      })

      const managerState = useManagerState()
      expect(managerState.isManagerEnabled.value).toBe(false)
    })

    it('isNewManagerUI should return true when state is NEW_UI', () => {
      systemStatsStore.$patch({
        systemStats: enabledManagerStats(),
        isInitialized: true
      })
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      mockServerFeatures({ supports_v4: true, supports_csrf_post: true })

      const managerState = useManagerState()
      expect(managerState.isNewManagerUI.value).toBe(true)
    })

    it('isLegacyManagerUI should return true when state is LEGACY_UI', () => {
      systemStatsStore.$patch({
        systemStats: systemStatsFixture([
          'python',
          'main.py',
          '--enable-manager',
          '--enable-manager-legacy-ui'
        ]),
        isInitialized: true
      })

      const managerState = useManagerState()
      expect(managerState.isLegacyManagerUI.value).toBe(true)
    })

    it('shouldShowInstallButton should return true only for NEW_UI', () => {
      systemStatsStore.$patch({
        systemStats: enabledManagerStats(),
        isInitialized: true
      })
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      mockServerFeatures({ supports_v4: true, supports_csrf_post: true })

      const managerState = useManagerState()
      expect(managerState.shouldShowInstallButton.value).toBe(true)
    })

    it('shouldShowManagerButtons should return true when state is NEW_UI', () => {
      systemStatsStore.$patch({
        systemStats: enabledManagerStats(),
        isInitialized: true
      })
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      mockServerFeatures({ supports_v4: true, supports_csrf_post: true })

      const managerState = useManagerState()
      expect(managerState.shouldShowManagerButtons.value).toBe(true)
    })
  })
})
