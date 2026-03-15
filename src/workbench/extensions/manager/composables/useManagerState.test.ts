import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import * as serverCapabilities from '@/services/serverCapabilities'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import {
  ManagerUIState,
  useManagerState
} from '@/workbench/extensions/manager/composables/useManagerState'

vi.mock('@/scripts/api', () => ({
  api: {
    getClientFeatureFlags: vi.fn(),
    getSystemStats: vi.fn()
  }
}))

vi.mock('@/services/serverCapabilities', () => ({
  getServerCapability: vi.fn()
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

vi.mock('@/platform/updates/common/toastStore', () => {
  const add = vi.fn()
  return {
    useToastStore: vi.fn(() => ({
      add
    }))
  }
})

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

describe('useManagerState', () => {
  let systemStatsStore: ReturnType<typeof useSystemStatsStore>

  beforeEach(() => {
    setActivePinia(
      createTestingPinia({
        stubActions: false,
        createSpy: vi.fn
      })
    )

    systemStatsStore = useSystemStatsStore()

    vi.resetAllMocks()

    vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
    vi.mocked(serverCapabilities.getServerCapability).mockReturnValue(undefined)
  })

  describe('managerUIState property', () => {
    it('should return DISABLED state when --enable-manager is NOT present', () => {
      systemStatsStore.$patch({
        systemStats: {
          system: {
            os: 'Test OS',
            python_version: '3.10',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: ['python', 'main.py'],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        },
        isInitialized: true
      })

      const managerState = useManagerState()
      expect(managerState.managerUIState.value).toBe(ManagerUIState.DISABLED)
    })

    it('should return LEGACY_UI state when --enable-manager-legacy-ui is present', () => {
      systemStatsStore.$patch({
        systemStats: {
          system: {
            os: 'Test OS',
            python_version: '3.10',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: [
              'python',
              'main.py',
              '--enable-manager',
              '--enable-manager-legacy-ui'
            ],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        },
        isInitialized: true
      })

      const managerState = useManagerState()
      expect(managerState.managerUIState.value).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should return NEW_UI state when client and server both support v4', () => {
      systemStatsStore.$patch({
        systemStats: {
          system: {
            os: 'Test OS',
            python_version: '3.10',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: ['python', 'main.py', '--enable-manager'],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        },
        isInitialized: true
      })

      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      vi.mocked(serverCapabilities.getServerCapability).mockReturnValue(true)

      const managerState = useManagerState()
      expect(managerState.managerUIState.value).toBe(ManagerUIState.NEW_UI)
    })

    it('should return LEGACY_UI state when server supports v4 but client does not', () => {
      systemStatsStore.$patch({
        systemStats: {
          system: {
            os: 'Test OS',
            python_version: '3.10',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: ['python', 'main.py', '--enable-manager'],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        },
        isInitialized: true
      })

      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: false
      })
      vi.mocked(serverCapabilities.getServerCapability).mockReturnValue(true)

      const managerState = useManagerState()
      expect(managerState.managerUIState.value).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should return LEGACY_UI state when server does not support v4', () => {
      systemStatsStore.$patch({
        systemStats: {
          system: {
            os: 'Test OS',
            python_version: '3.10',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: ['python', 'main.py', '--enable-manager'],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        },
        isInitialized: true
      })

      vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
      vi.mocked(serverCapabilities.getServerCapability).mockReturnValue(false)

      const managerState = useManagerState()
      expect(managerState.managerUIState.value).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should return NEW_UI state when server capability is undefined', () => {
      systemStatsStore.$patch({
        systemStats: {
          system: {
            os: 'Test OS',
            python_version: '3.10',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: ['python', 'main.py', '--enable-manager'],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        },
        isInitialized: true
      })

      vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
      vi.mocked(serverCapabilities.getServerCapability).mockReturnValue(
        undefined
      )

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
      vi.mocked(serverCapabilities.getServerCapability).mockReturnValue(true)

      const managerState = useManagerState()
      expect(managerState.managerUIState.value).toBe(ManagerUIState.DISABLED)
    })
  })

  describe('helper properties', () => {
    it('isManagerEnabled should return true when state is not DISABLED', () => {
      systemStatsStore.$patch({
        systemStats: {
          system: {
            os: 'Test OS',
            python_version: '3.10',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: ['python', 'main.py', '--enable-manager'],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        },
        isInitialized: true
      })

      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      vi.mocked(serverCapabilities.getServerCapability).mockReturnValue(true)

      const managerState = useManagerState()
      expect(managerState.isManagerEnabled.value).toBe(true)
    })

    it('isManagerEnabled should return false when state is DISABLED', () => {
      systemStatsStore.$patch({
        systemStats: {
          system: {
            os: 'Test OS',
            python_version: '3.10',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: ['python', 'main.py'],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        },
        isInitialized: true
      })

      const managerState = useManagerState()
      expect(managerState.isManagerEnabled.value).toBe(false)
    })

    it('isNewManagerUI should return true when state is NEW_UI', () => {
      systemStatsStore.$patch({
        systemStats: {
          system: {
            os: 'Test OS',
            python_version: '3.10',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: ['python', 'main.py', '--enable-manager'],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        },
        isInitialized: true
      })

      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      vi.mocked(serverCapabilities.getServerCapability).mockReturnValue(true)

      const managerState = useManagerState()
      expect(managerState.isNewManagerUI.value).toBe(true)
    })

    it('isLegacyManagerUI should return true when state is LEGACY_UI', () => {
      systemStatsStore.$patch({
        systemStats: {
          system: {
            os: 'Test OS',
            python_version: '3.10',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: [
              'python',
              'main.py',
              '--enable-manager',
              '--enable-manager-legacy-ui'
            ],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        },
        isInitialized: true
      })

      const managerState = useManagerState()
      expect(managerState.isLegacyManagerUI.value).toBe(true)
    })

    it('shouldShowInstallButton should return true only for NEW_UI', () => {
      systemStatsStore.$patch({
        systemStats: {
          system: {
            os: 'Test OS',
            python_version: '3.10',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: ['python', 'main.py', '--enable-manager'],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        },
        isInitialized: true
      })

      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      vi.mocked(serverCapabilities.getServerCapability).mockReturnValue(true)

      const managerState = useManagerState()
      expect(managerState.shouldShowInstallButton.value).toBe(true)
    })

    it('shouldShowManagerButtons should return true when not DISABLED', () => {
      systemStatsStore.$patch({
        systemStats: {
          system: {
            os: 'Test OS',
            python_version: '3.10',
            embedded_python: false,
            comfyui_version: '1.0.0',
            pytorch_version: '2.0.0',
            argv: ['python', 'main.py', '--enable-manager'],
            ram_total: 16000000000,
            ram_free: 8000000000
          },
          devices: []
        },
        isInitialized: true
      })

      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      vi.mocked(serverCapabilities.getServerCapability).mockReturnValue(true)

      const managerState = useManagerState()
      expect(managerState.shouldShowManagerButtons.value).toBe(true)
    })
  })
})
