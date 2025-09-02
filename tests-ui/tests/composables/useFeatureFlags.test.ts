import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isReactive, isReadonly } from 'vue'

import {
  ServerFeatureFlag,
  useFeatureFlags
} from '@/composables/useFeatureFlags'
import { useFeatureFlagsStore } from '@/stores/featureFlagsStore'

// Mock the store module
vi.mock('@/stores/featureFlagsStore', () => ({
  useFeatureFlagsStore: vi.fn()
}))

describe('useFeatureFlags', () => {
  let mockStore: any

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())

    // Create mock store
    mockStore = {
      getServerFeature: vi.fn(),
      getClientFeature: vi.fn(),
      serverSupportsFeature: vi.fn(),
      supportsManagerV4: false,
      clientSupportsManagerV4UI: false,
      isReady: false
    }

    vi.mocked(useFeatureFlagsStore).mockReturnValue(mockStore)
  })

  describe('flags object', () => {
    it('should provide reactive readonly flags', () => {
      const { flags } = useFeatureFlags()

      expect(isReadonly(flags)).toBe(true)
      expect(isReactive(flags)).toBe(true)
    })

    it('should access supportsPreviewMetadata', () => {
      mockStore.getServerFeature.mockImplementation(
        (path: string, defaultValue?: any) => {
          if (path === ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA) return true
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.value.supportsPreviewMetadata).toBe(true)
      expect(mockStore.getServerFeature).toHaveBeenCalledWith(
        ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA,
        false
      )
    })

    it('should access maxUploadSize', () => {
      mockStore.getServerFeature.mockImplementation(
        (path: string, defaultValue?: any) => {
          if (path === ServerFeatureFlag.MAX_UPLOAD_SIZE) return 209715200 // 200MB
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.value.maxUploadSize).toBe(209715200)
      expect(mockStore.getServerFeature).toHaveBeenCalledWith(
        ServerFeatureFlag.MAX_UPLOAD_SIZE
      )
    })

    it('should access supportsManagerV4', () => {
      mockStore.supportsManagerV4 = true

      const { flags } = useFeatureFlags()
      expect(flags.value.supportsManagerV4).toBe(true)
    })

    it('should access clientSupportsManagerV4UI', () => {
      mockStore.clientSupportsManagerV4UI = true

      const { flags } = useFeatureFlags()
      expect(flags.value.clientSupportsManagerV4UI).toBe(true)
    })

    it('should access isReady state', () => {
      mockStore.isReady = true

      const { flags } = useFeatureFlags()
      expect(flags.value.isReady).toBe(true)
    })

    it('should return default values when features are not available', () => {
      mockStore.getServerFeature.mockImplementation(
        (_path: string, defaultValue?: any) => defaultValue
      )

      const { flags } = useFeatureFlags()
      expect(flags.value.supportsPreviewMetadata).toBe(false) // default value is false
      expect(flags.value.maxUploadSize).toBeUndefined()
      expect(flags.value.supportsManagerV4).toBe(false) // store mock returns false
    })
  })

  describe('featureFlag', () => {
    it('should create reactive computed for custom feature flags', () => {
      mockStore.getServerFeature.mockImplementation(
        (path: string, defaultValue?: any) => {
          if (path === 'custom.feature') return 'custom-value'
          return defaultValue
        }
      )

      const { featureFlag } = useFeatureFlags()
      const customFlag = featureFlag('custom.feature', 'default')

      expect(customFlag.value).toBe('custom-value')
      expect(mockStore.getServerFeature).toHaveBeenCalledWith(
        'custom.feature',
        'default'
      )
    })

    it('should handle nested paths', () => {
      mockStore.getServerFeature.mockImplementation(
        (path: string, defaultValue?: any) => {
          if (path === 'extension.custom.nested.feature') return true
          return defaultValue
        }
      )

      const { featureFlag } = useFeatureFlags()
      const nestedFlag = featureFlag('extension.custom.nested.feature', false)

      expect(nestedFlag.value).toBe(true)
    })

    it('should work with ServerFeatureFlag enum', () => {
      mockStore.getServerFeature.mockImplementation(
        (path: string, defaultValue?: any) => {
          if (path === ServerFeatureFlag.MAX_UPLOAD_SIZE) return 104857600
          return defaultValue
        }
      )

      const { featureFlag } = useFeatureFlags()
      const maxUploadSize = featureFlag(ServerFeatureFlag.MAX_UPLOAD_SIZE)

      expect(maxUploadSize.value).toBe(104857600)
    })
  })

  describe('serverSupportsFeature', () => {
    it('should create reactive computed for feature support check', () => {
      mockStore.serverSupportsFeature.mockImplementation(
        (path: string) => path === 'supported.feature'
      )

      const { serverSupportsFeature } = useFeatureFlags()
      const isSupported = serverSupportsFeature('supported.feature')

      expect(isSupported.value).toBe(true)
      expect(mockStore.serverSupportsFeature).toHaveBeenCalledWith(
        'supported.feature'
      )
    })
  })

  describe('direct store methods', () => {
    it('should expose getServerFeature method', () => {
      const { getServerFeature } = useFeatureFlags()
      expect(getServerFeature).toBe(mockStore.getServerFeature)
    })

    it('should expose getClientFeature method', () => {
      const { getClientFeature } = useFeatureFlags()
      expect(getClientFeature).toBe(mockStore.getClientFeature)
    })
  })
})
