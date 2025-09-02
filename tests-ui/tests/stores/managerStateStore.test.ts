import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useExtensionStore } from '@/stores/extensionStore'
import { useFeatureFlagsStore } from '@/stores/featureFlagsStore'
import {
  ManagerUIState,
  useManagerStateStore
} from '@/stores/managerStateStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'

// Mock dependencies
vi.mock('@/stores/featureFlagsStore', () => ({
  useFeatureFlagsStore: vi.fn()
}))

vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: vi.fn()
}))

vi.mock('@/stores/systemStatsStore', () => ({
  useSystemStatsStore: vi.fn()
}))

describe('useManagerStateStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('managerUIState computed', () => {
    it('should return DISABLED state when --disable-manager is present', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: {
          system: { argv: ['python', 'main.py', '--disable-manager'] }
        }
      } as any)
      vi.mocked(useFeatureFlagsStore).mockReturnValue({
        clientSupportsManagerV4UI: false,
        supportsManagerV4: false,
        isReady: false
      } as any)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const store = useManagerStateStore()

      expect(store.managerUIState).toBe(ManagerUIState.DISABLED)
    })

    it('should return LEGACY_UI state when --enable-manager-legacy-ui is present', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: {
          system: { argv: ['python', 'main.py', '--enable-manager-legacy-ui'] }
        }
      } as any)
      vi.mocked(useFeatureFlagsStore).mockReturnValue({
        clientSupportsManagerV4UI: false,
        supportsManagerV4: false,
        isReady: false
      } as any)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const store = useManagerStateStore()

      expect(store.managerUIState).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should return NEW_UI state when client and server both support v4', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: { system: { argv: ['python', 'main.py'] } }
      } as any)
      vi.mocked(useFeatureFlagsStore).mockReturnValue({
        clientSupportsManagerV4UI: true,
        supportsManagerV4: true,
        isReady: true
      } as any)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const store = useManagerStateStore()

      expect(store.managerUIState).toBe(ManagerUIState.NEW_UI)
    })

    it('should return LEGACY_UI state when server supports v4 but client does not', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: { system: { argv: ['python', 'main.py'] } }
      } as any)
      vi.mocked(useFeatureFlagsStore).mockReturnValue({
        clientSupportsManagerV4UI: false,
        supportsManagerV4: true,
        isReady: true
      } as any)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const store = useManagerStateStore()

      expect(store.managerUIState).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should return LEGACY_UI state when legacy manager extension exists', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: { system: { argv: ['python', 'main.py'] } }
      } as any)
      vi.mocked(useFeatureFlagsStore).mockReturnValue({
        clientSupportsManagerV4UI: false,
        supportsManagerV4: false,
        isReady: true
      } as any)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: [{ name: 'Comfy.CustomNodesManager' }]
      } as any)

      const store = useManagerStateStore()

      expect(store.managerUIState).toBe(ManagerUIState.LEGACY_UI)
    })

    it('should return DISABLED state when feature flags are undefined', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: { system: { argv: ['python', 'main.py'] } }
      } as any)
      vi.mocked(useFeatureFlagsStore).mockReturnValue({
        clientSupportsManagerV4UI: false,
        supportsManagerV4: undefined,
        isReady: true
      } as any)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const store = useManagerStateStore()

      expect(store.managerUIState).toBe(ManagerUIState.DISABLED)
    })

    it('should return DISABLED state when no manager is available', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: { system: { argv: ['python', 'main.py'] } }
      } as any)
      vi.mocked(useFeatureFlagsStore).mockReturnValue({
        clientSupportsManagerV4UI: false,
        supportsManagerV4: false,
        isReady: true
      } as any)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const store = useManagerStateStore()

      expect(store.managerUIState).toBe(ManagerUIState.DISABLED)
    })

    it('should handle null systemStats gracefully', () => {
      vi.mocked(useSystemStatsStore).mockReturnValue({
        systemStats: null
      } as any)
      vi.mocked(useFeatureFlagsStore).mockReturnValue({
        clientSupportsManagerV4UI: true,
        supportsManagerV4: true,
        isReady: true
      } as any)
      vi.mocked(useExtensionStore).mockReturnValue({
        extensions: []
      } as any)

      const store = useManagerStateStore()

      expect(store.managerUIState).toBe(ManagerUIState.NEW_UI)
    })
  })
})
