import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { api } from '@/scripts/api'
import { useComfyManagerService } from '@/services/comfyManagerService'
import {
  ManagerUIState,
  useManagerStateStore
} from '@/stores/managerStateStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'

// Mock dependencies
vi.mock('@/scripts/api', () => ({
  api: {
    getClientFeatureFlags: vi.fn()
  }
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: vi.fn(() => ({
    flags: { supportsManagerV4: false },
    featureFlag: vi.fn()
  }))
}))

vi.mock('@/services/comfyManagerService', () => ({
  useComfyManagerService: vi.fn()
}))

vi.mock('@/stores/systemStatsStore', () => ({
  useSystemStatsStore: vi.fn()
}))

describe('useManagerStateStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('getManagerUIState', () => {
    it('should set DISABLED state when --disable-manager is present', async () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: {
          system: { argv: ['python', 'main.py', '--disable-manager'] }
        }
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({})

      const store = useManagerStateStore()
      const state = await store.getManagerUIState()

      expect(state).toBe(ManagerUIState.DISABLED)
    })

    it('should set LEGACY_UI state when --enable-manager-legacy-ui is present and legacy manager is installed', async () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: {
          system: { argv: ['python', 'main.py', '--enable-manager-legacy-ui'] }
        }
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
      vi.mocked(useComfyManagerService).mockReturnValue({
        isLegacyManagerUI: vi.fn().mockResolvedValue({})
      } as any)

      const store = useManagerStateStore()
      const state = await store.getManagerUIState()

      expect(state).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should set DISABLED state when --enable-manager-legacy-ui is present but legacy manager is NOT installed', async () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: {
          system: { argv: ['python', 'main.py', '--enable-manager-legacy-ui'] }
        }
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
      vi.mocked(useComfyManagerService).mockReturnValue({
        isLegacyManagerUI: vi.fn().mockRejectedValue(new Error('404'))
      } as any)

      const store = useManagerStateStore()
      const state = await store.getManagerUIState()

      expect(state).toBe(ManagerUIState.DISABLED)
    })

    it('should set NEW_UI state when client and server both support v4', async () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: { system: { argv: ['python', 'main.py'] } }
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      vi.mocked(useFeatureFlags).mockReturnValue({
        flags: { supportsManagerV4: true },
        featureFlag: vi.fn()
      } as any)
      vi.mocked(useComfyManagerService).mockReturnValue({
        isLegacyManagerUI: vi.fn().mockResolvedValue({})
      } as any)

      const store = useManagerStateStore()
      const state = await store.getManagerUIState()

      expect(state).toBe(ManagerUIState.NEW_UI)
    })

    it('should set LEGACY_UI state when client does not support v4', async () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: { system: { argv: ['python', 'main.py'] } }
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: false
      })
      vi.mocked(useFeatureFlags).mockReturnValue({
        flags: { supportsManagerV4: true },
        featureFlag: vi.fn()
      } as any)
      vi.mocked(useComfyManagerService).mockReturnValue({
        isLegacyManagerUI: vi.fn().mockResolvedValue({})
      } as any)

      const store = useManagerStateStore()
      const state = await store.getManagerUIState()

      expect(state).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should set LEGACY_UI state when server does not support v4', async () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: { system: { argv: ['python', 'main.py'] } }
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      vi.mocked(useFeatureFlags).mockReturnValue({
        flags: { supportsManagerV4: false },
        featureFlag: vi.fn()
      } as any)
      vi.mocked(useComfyManagerService).mockReturnValue({
        isLegacyManagerUI: vi.fn().mockResolvedValue({})
      } as any)

      const store = useManagerStateStore()
      const state = await store.getManagerUIState()

      expect(state).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should set LEGACY_UI state when isLegacyManagerUI route does not exist', async () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: { system: { argv: ['python', 'main.py'] } }
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({})
      vi.mocked(useFeatureFlags).mockReturnValue({
        flags: { supportsManagerV4: false },
        featureFlag: vi.fn()
      } as any)
      vi.mocked(useComfyManagerService).mockReturnValue({
        isLegacyManagerUI: vi.fn().mockRejectedValue(new Error('404'))
      } as any)

      const store = useManagerStateStore()
      const state = await store.getManagerUIState()

      expect(state).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should not re-initialize if already initialized', async () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: {
          system: { argv: ['python', 'main.py', '--disable-manager'] }
        }
      } as any)

      const store = useManagerStateStore()
      const state1 = await store.getManagerUIState()
      expect(state1).toBe(ManagerUIState.DISABLED)

      // Change the mock to return different value
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: { system: { argv: ['python', 'main.py'] } }
      } as any)

      // Try to get state again
      const state2 = await store.getManagerUIState()

      // Should still be DISABLED from first initialization
      expect(state2).toBe(ManagerUIState.DISABLED)
    })

    it('should handle null systemStats gracefully', async () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: null
      } as any)
      vi.mocked(api.getClientFeatureFlags).mockReturnValue({
        supports_manager_v4_ui: true
      })
      vi.mocked(useFeatureFlags).mockReturnValue({
        flags: { supportsManagerV4: true },
        featureFlag: vi.fn()
      } as any)
      vi.mocked(useComfyManagerService).mockReturnValue({
        isLegacyManagerUI: vi.fn().mockResolvedValue({})
      } as any)

      const store = useManagerStateStore()
      const state = await store.getManagerUIState()

      expect(state).toBe(ManagerUIState.NEW_UI)
    })
  })
})
