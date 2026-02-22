import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isReactive, isReadonly } from 'vue'

import {
  ServerFeatureFlag,
  useFeatureFlags
} from '@/composables/useFeatureFlags'
import * as distributionTypes from '@/platform/distribution/types'
import * as serverCapabilities from '@/services/serverCapabilities'

vi.mock('@/services/serverCapabilities', () => ({
  getServerCapability: vi.fn()
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false,
  isNightly: false
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
      vi.mocked(serverCapabilities.getServerCapability).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA) return true
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.supportsPreviewMetadata).toBe(true)
      expect(serverCapabilities.getServerCapability).toHaveBeenCalledWith(
        ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA
      )
    })

    it('should access maxUploadSize', () => {
      vi.mocked(serverCapabilities.getServerCapability).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.MAX_UPLOAD_SIZE) return 209715200
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.maxUploadSize).toBe(209715200)
      expect(serverCapabilities.getServerCapability).toHaveBeenCalledWith(
        ServerFeatureFlag.MAX_UPLOAD_SIZE
      )
    })

    it('should access supportsManagerV4', () => {
      vi.mocked(serverCapabilities.getServerCapability).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.MANAGER_SUPPORTS_V4) return true
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.supportsManagerV4).toBe(true)
      expect(serverCapabilities.getServerCapability).toHaveBeenCalledWith(
        ServerFeatureFlag.MANAGER_SUPPORTS_V4
      )
    })

    it('should return undefined when features are not available and no default provided', () => {
      vi.mocked(serverCapabilities.getServerCapability).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()
      expect(flags.supportsPreviewMetadata).toBeUndefined()
      expect(flags.maxUploadSize).toBeUndefined()
      expect(flags.supportsManagerV4).toBeUndefined()
    })
  })

  describe('featureFlag', () => {
    it('should create reactive computed for custom feature flags', () => {
      vi.mocked(serverCapabilities.getServerCapability).mockImplementation(
        (path, defaultValue) => {
          if (path === 'custom.feature') return 'custom-value'
          return defaultValue
        }
      )

      const { featureFlag } = useFeatureFlags()
      const customFlag = featureFlag('custom.feature', 'default')

      expect(customFlag.value).toBe('custom-value')
      expect(serverCapabilities.getServerCapability).toHaveBeenCalledWith(
        'custom.feature',
        'default'
      )
    })

    it('should handle nested paths', () => {
      vi.mocked(serverCapabilities.getServerCapability).mockImplementation(
        (path, defaultValue) => {
          if (path === 'extension.custom.nested.feature') return true
          return defaultValue
        }
      )

      const { featureFlag } = useFeatureFlags()
      const nestedFlag = featureFlag('extension.custom.nested.feature', false)

      expect(nestedFlag.value).toBe(true)
    })

    it('should work with ServerFeatureFlag enum', () => {
      vi.mocked(serverCapabilities.getServerCapability).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.MAX_UPLOAD_SIZE) return 104857600
          return defaultValue
        }
      )

      const { featureFlag } = useFeatureFlags()
      const maxUploadSize = featureFlag(ServerFeatureFlag.MAX_UPLOAD_SIZE)

      expect(maxUploadSize.value).toBe(104857600)
    })
  })

  describe('linearToggleEnabled', () => {
    it('should return true when isNightly is true', () => {
      vi.mocked(distributionTypes).isNightly = true

      const { flags } = useFeatureFlags()
      expect(flags.linearToggleEnabled).toBe(true)
      expect(serverCapabilities.getServerCapability).not.toHaveBeenCalled()
    })

    it('should check remote config and server capability when isNightly is false', () => {
      vi.mocked(distributionTypes).isNightly = false
      vi.mocked(serverCapabilities.getServerCapability).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.LINEAR_TOGGLE_ENABLED) return true
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.linearToggleEnabled).toBe(true)
      expect(serverCapabilities.getServerCapability).toHaveBeenCalledWith(
        ServerFeatureFlag.LINEAR_TOGGLE_ENABLED,
        false
      )
    })

    it('should return false when isNightly is false and flag is disabled', () => {
      vi.mocked(distributionTypes).isNightly = false
      vi.mocked(serverCapabilities.getServerCapability).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()
      expect(flags.linearToggleEnabled).toBe(false)
    })
  })

  describe('dev override via localStorage', () => {
    afterEach(() => {
      localStorage.clear()
    })

    it('resolveFlag returns localStorage override over remoteConfig and server value', () => {
      vi.mocked(serverCapabilities.getServerCapability).mockReturnValue(false)
      localStorage.setItem('ff:model_upload_button_enabled', 'true')

      const { flags } = useFeatureFlags()
      expect(flags.modelUploadButtonEnabled).toBe(true)
    })

    it('resolveFlag falls through to server when no override is set', () => {
      vi.mocked(serverCapabilities.getServerCapability).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.ASSET_RENAME_ENABLED) return true
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.assetRenameEnabled).toBe(true)
    })

    it('direct server flags use getServerCapability which handles override', () => {
      vi.mocked(serverCapabilities.getServerCapability).mockImplementation(
        (path) => {
          if (path === ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA)
            return 'overridden'
          return undefined
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.supportsPreviewMetadata).toBe('overridden')
    })

    it('teamWorkspacesEnabled override bypasses isCloud and isAuthenticatedConfigLoaded guards', () => {
      vi.mocked(distributionTypes).isCloud = false
      localStorage.setItem('ff:team_workspaces_enabled', 'true')

      const { flags } = useFeatureFlags()
      expect(flags.teamWorkspacesEnabled).toBe(true)
    })
  })
})
