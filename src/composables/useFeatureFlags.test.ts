import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isReactive, isReadonly } from 'vue'

import {
  ServerFeatureFlag,
  useFeatureFlags
} from '@/composables/useFeatureFlags'
import { api } from '@/scripts/api'

// Mock the API module
vi.mock('@/scripts/api', () => ({
  api: {
    getServerFeature: vi.fn()
  }
}))

describe('useFeatureFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('flags object', () => {
    it('should provide reactive readonly flags', () => {
      const { flags } = useFeatureFlags()

      expect(isReadonly(flags)).toBe(true)
      expect(isReactive(flags)).toBe(true)
    })

    it('should access supportsPreviewMetadata', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA)
            return true as any
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.supportsPreviewMetadata).toBe(true)
      expect(api.getServerFeature).toHaveBeenCalledWith(
        ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA
      )
    })

    it('should access maxUploadSize', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.MAX_UPLOAD_SIZE)
            return 209715200 as any // 200MB
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.maxUploadSize).toBe(209715200)
      expect(api.getServerFeature).toHaveBeenCalledWith(
        ServerFeatureFlag.MAX_UPLOAD_SIZE
      )
    })

    it('should access supportsManagerV4', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.MANAGER_SUPPORTS_V4) return true as any
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.supportsManagerV4).toBe(true)
      expect(api.getServerFeature).toHaveBeenCalledWith(
        ServerFeatureFlag.MANAGER_SUPPORTS_V4
      )
    })

    it('should return undefined when features are not available and no default provided', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue as any
      )

      const { flags } = useFeatureFlags()
      expect(flags.supportsPreviewMetadata).toBeUndefined()
      expect(flags.maxUploadSize).toBeUndefined()
      expect(flags.supportsManagerV4).toBeUndefined()
    })
  })

  describe('featureFlag', () => {
    it('should create reactive computed for custom feature flags', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) => {
          if (path === 'custom.feature') return 'custom-value' as any
          return defaultValue
        }
      )

      const { featureFlag } = useFeatureFlags()
      const customFlag = featureFlag('custom.feature', 'default')

      expect(customFlag.value).toBe('custom-value')
      expect(api.getServerFeature).toHaveBeenCalledWith(
        'custom.feature',
        'default'
      )
    })

    it('should handle nested paths', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) => {
          if (path === 'extension.custom.nested.feature') return true as any
          return defaultValue
        }
      )

      const { featureFlag } = useFeatureFlags()
      const nestedFlag = featureFlag('extension.custom.nested.feature', false)

      expect(nestedFlag.value).toBe(true)
    })

    it('should work with ServerFeatureFlag enum', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.MAX_UPLOAD_SIZE)
            return 104857600 as any
          return defaultValue
        }
      )

      const { featureFlag } = useFeatureFlags()
      const maxUploadSize = featureFlag(ServerFeatureFlag.MAX_UPLOAD_SIZE)

      expect(maxUploadSize.value).toBe(104857600)
    })
  })
})
