import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/stores/extensionStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import {
  ManagerUIState,
  useManagerState
} from '@/workbench/extensions/manager/composables/useManagerState'

// Mock dependencies
vi.mock('@/scripts/api', () => ({
  api: {
    getClientFeatureFlags: vi.fn(),
    getServerFeature: vi.fn()
  }
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: vi.fn(() => ({
    flags: { supportsManagerV4: false },
    featureFlag: vi.fn()
  }))
}))

vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: vi.fn()
}))

vi.mock('@/stores/systemStatsStore', () => ({
  useSystemStatsStore: vi.fn()
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => ({
    showManagerPopup: vi.fn(),
    showLegacyManagerPopup: vi.fn(),
    showSettingsDialog: vi.fn()
  }))
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: vi.fn(() => ({
    execute: vi.fn()
  }))
}))

vi.mock('@/stores/toastStore', () => ({
  useToastStore: vi.fn(() => ({
    add: vi.fn()
  }))
}))

describe('useManagerState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('managerUIState property', () => {
    it('should return DISABLED state when --enable-manager is NOT present', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: ref({
          system: { argv: ['python', 'main.py'] } // No --enable-manager flag
        }),
        isInitialized: ref(true)
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const managerState = useManagerState()

      expect(managerState.managerUIState.value).toBe(ManagerUIState.DISABLED)
    })

    it('should return LEGACY_UI state when --enable-manager-legacy-ui is present', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: ref({
          system: {
            argv: [
              'python',
              'main.py',
              '--enable-manager',
              '--enable-manager-legacy-ui'
            ]
          } // Both flags needed
        }),
        isInitialized: ref(true)
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const managerState = useManagerState()

      expect(managerState.managerUIState.value).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should return NEW_UI state when client and server both support v4', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: ref({
          system: { argv: ['python', 'main.py', '--enable-manager'] }
        }), // Need --enable-manager
        isInitialized: ref(true)
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      vi.mocked(api.getServerFeature).mockReturnValue(true)
      vi.mocked(useFeatureFlags).mockReturnValue({
        flags: { supportsManagerV4: true },
        featureFlag: vi.fn()
      } as any)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const managerState = useManagerState()

      expect(managerState.managerUIState.value).toBe(ManagerUIState.NEW_UI)
    })

    it('should return LEGACY_UI state when server supports v4 but client does not', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: ref({
          system: { argv: ['python', 'main.py', '--enable-manager'] }
        }), // Need --enable-manager
        isInitialized: ref(true)
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: false
      })
      vi.mocked(api.getServerFeature).mockReturnValue(true)
      vi.mocked(useFeatureFlags).mockReturnValue({
        flags: { supportsManagerV4: true },
        featureFlag: vi.fn()
      } as any)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const managerState = useManagerState()

      expect(managerState.managerUIState.value).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should return LEGACY_UI state when legacy manager extension exists', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: ref({
          system: { argv: ['python', 'main.py', '--enable-manager'] }
        }), // Need --enable-manager
        isInitialized: ref(true)
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
      vi.mocked(useFeatureFlags).mockReturnValue({
        flags: { supportsManagerV4: false },
        featureFlag: vi.fn()
      } as any)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: [{ name: 'Comfy.CustomNodesManager' }]
      } as any)

      const managerState = useManagerState()

      expect(managerState.managerUIState.value).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should return NEW_UI state when server feature flags are undefined', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: ref({
          system: { argv: ['python', 'main.py', '--enable-manager'] }
        }), // Need --enable-manager
        isInitialized: ref(true)
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
      vi.mocked(api.getServerFeature).mockReturnValue(undefined)
      vi.mocked(useFeatureFlags).mockReturnValue({
        flags: { supportsManagerV4: undefined },
        featureFlag: vi.fn()
      } as any)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const managerState = useManagerState()

      expect(managerState.managerUIState.value).toBe(ManagerUIState.NEW_UI)
    })

    it('should return LEGACY_UI state when server does not support v4', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: ref({
          system: { argv: ['python', 'main.py', '--enable-manager'] }
        }), // Need --enable-manager
        isInitialized: ref(true)
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
      vi.mocked(api.getServerFeature).mockReturnValue(false)
      vi.mocked(useFeatureFlags).mockReturnValue({
        flags: { supportsManagerV4: false },
        featureFlag: vi.fn()
      } as any)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const managerState = useManagerState()

      expect(managerState.managerUIState.value).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should handle null systemStats gracefully', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: ref(null),
        isInitialized: ref(true)
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      vi.mocked(api.getServerFeature).mockReturnValue(true)
      vi.mocked(useFeatureFlags).mockReturnValue({
        flags: { supportsManagerV4: true },
        featureFlag: vi.fn()
      } as any)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const managerState = useManagerState()

      // When systemStats is null, we can't check for --enable-manager flag, so manager is disabled
      expect(managerState.managerUIState.value).toBe(ManagerUIState.DISABLED)
    })
  })

  describe('helper properties', () => {
    it('isManagerEnabled should return true when state is not DISABLED', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: ref({
          system: { argv: ['python', 'main.py', '--enable-manager'] }
        }), // Need --enable-manager
        isInitialized: ref(true)
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      vi.mocked(api.getServerFeature).mockReturnValue(true)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const managerState = useManagerState()
      expect(managerState.isManagerEnabled.value).toBe(true)
    })

    it('isManagerEnabled should return false when state is DISABLED', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: ref({
          system: { argv: ['python', 'main.py'] } // No --enable-manager flag means disabled
        }),
        isInitialized: ref(true)
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const managerState = useManagerState()
      expect(managerState.isManagerEnabled.value).toBe(false)
    })

    it('isNewManagerUI should return true when state is NEW_UI', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: ref({
          system: { argv: ['python', 'main.py', '--enable-manager'] }
        }), // Need --enable-manager
        isInitialized: ref(true)
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      vi.mocked(api.getServerFeature).mockReturnValue(true)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const managerState = useManagerState()
      expect(managerState.isNewManagerUI.value).toBe(true)
    })

    it('isLegacyManagerUI should return true when state is LEGACY_UI', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: ref({
          system: {
            argv: [
              'python',
              'main.py',
              '--enable-manager',
              '--enable-manager-legacy-ui'
            ]
          } // Both flags needed
        }),
        isInitialized: ref(true)
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const managerState = useManagerState()
      expect(managerState.isLegacyManagerUI.value).toBe(true)
    })

    it('shouldShowInstallButton should return true only for NEW_UI', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: ref({
          system: { argv: ['python', 'main.py', '--enable-manager'] }
        }), // Need --enable-manager
        isInitialized: ref(true)
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      vi.mocked(api.getServerFeature).mockReturnValue(true)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const managerState = useManagerState()
      expect(managerState.shouldShowInstallButton.value).toBe(true)
    })

    it('shouldShowManagerButtons should return true when not DISABLED', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: ref({
          system: { argv: ['python', 'main.py', '--enable-manager'] }
        }), // Need --enable-manager
        isInitialized: ref(true)
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      vi.mocked(api.getServerFeature).mockReturnValue(true)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const managerState = useManagerState()
      expect(managerState.shouldShowManagerButtons.value).toBe(true)
    })
  })
})
