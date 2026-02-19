import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { ReleaseNote } from '../common/releaseService'
import { useReleaseFeatureFlagFilter } from './useReleaseFeatureFlagFilter'

// Mock the remoteConfig module
vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: ref({})
}))

// Mock the API module
vi.mock('@/scripts/api', () => ({
  api: {
    getServerFeature: vi.fn()
  }
}))

// Import mocked modules after vi.mock declarations
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { api } from '@/scripts/api'

function createMockRelease(overrides: Partial<ReleaseNote> = {}): ReleaseNote {
  return {
    id: 1,
    project: 'comfyui',
    version: '1.0.0',
    attention: 'medium',
    content: 'Test release notes',
    published_at: '2024-01-01T00:00:00Z',
    ...overrides
  }
}

describe('useReleaseFeatureFlagFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mocks to default behavior
    remoteConfig.value = {}
    vi.mocked(api.getServerFeature).mockImplementation(
      (_path, defaultValue) => defaultValue
    )
  })

  describe('shouldShowRelease', () => {
    it('shows releases without feature flag requirements (backward compatible)', () => {
      const releases = ref([createMockRelease()])
      const { shouldShowRelease } = useReleaseFeatureFlagFilter({ releases })

      expect(shouldShowRelease(releases.value[0])).toBe(true)
    })

    it('shows releases with empty feature flag arrays', () => {
      const releases = ref([
        createMockRelease({
          required_feature_flags: [],
          excluded_feature_flags: []
        })
      ])
      const { shouldShowRelease } = useReleaseFeatureFlagFilter({ releases })

      expect(shouldShowRelease(releases.value[0])).toBe(true)
    })

    describe('required_feature_flags', () => {
      it('shows release when all required flags are enabled in remote config', () => {
        remoteConfig.value = {
          model_upload_button_enabled: true,
          asset_deletion_enabled: true
        }

        const releases = ref([
          createMockRelease({
            required_feature_flags: [
              'model_upload_button_enabled',
              'asset_deletion_enabled'
            ]
          })
        ])
        const { shouldShowRelease } = useReleaseFeatureFlagFilter({ releases })

        expect(shouldShowRelease(releases.value[0])).toBe(true)
      })

      it('shows release when all required flags are enabled via server feature flags', () => {
        vi.mocked(api.getServerFeature).mockImplementation((path) => {
          if (path === 'custom_feature_a') return true
          if (path === 'custom_feature_b') return true
          return false
        })

        const releases = ref([
          createMockRelease({
            required_feature_flags: ['custom_feature_a', 'custom_feature_b']
          })
        ])
        const { shouldShowRelease } = useReleaseFeatureFlagFilter({ releases })

        expect(shouldShowRelease(releases.value[0])).toBe(true)
      })

      it('hides release when any required flag is disabled', () => {
        remoteConfig.value = {
          model_upload_button_enabled: true,
          asset_deletion_enabled: false
        }

        const releases = ref([
          createMockRelease({
            required_feature_flags: [
              'model_upload_button_enabled',
              'asset_deletion_enabled'
            ]
          })
        ])
        const { shouldShowRelease } = useReleaseFeatureFlagFilter({ releases })

        expect(shouldShowRelease(releases.value[0])).toBe(false)
      })

      it('hides release when required flag is not found', () => {
        const releases = ref([
          createMockRelease({
            required_feature_flags: ['non_existent_flag']
          })
        ])
        const { shouldShowRelease } = useReleaseFeatureFlagFilter({ releases })

        expect(shouldShowRelease(releases.value[0])).toBe(false)
      })
    })

    describe('excluded_feature_flags', () => {
      it('shows release when all excluded flags are disabled', () => {
        remoteConfig.value = {
          model_upload_button_enabled: false
        }

        const releases = ref([
          createMockRelease({
            excluded_feature_flags: ['model_upload_button_enabled']
          })
        ])
        const { shouldShowRelease } = useReleaseFeatureFlagFilter({ releases })

        expect(shouldShowRelease(releases.value[0])).toBe(true)
      })

      it('shows release when excluded flags are not found (treated as disabled)', () => {
        const releases = ref([
          createMockRelease({
            excluded_feature_flags: ['non_existent_flag']
          })
        ])
        const { shouldShowRelease } = useReleaseFeatureFlagFilter({ releases })

        expect(shouldShowRelease(releases.value[0])).toBe(true)
      })

      it('hides release when any excluded flag is enabled', () => {
        remoteConfig.value = {
          model_upload_button_enabled: true
        }

        const releases = ref([
          createMockRelease({
            excluded_feature_flags: ['model_upload_button_enabled']
          })
        ])
        const { shouldShowRelease } = useReleaseFeatureFlagFilter({ releases })

        expect(shouldShowRelease(releases.value[0])).toBe(false)
      })
    })

    describe('combined required and excluded flags', () => {
      it('shows release when required enabled AND excluded disabled', () => {
        remoteConfig.value = {
          model_upload_button_enabled: true,
          asset_deletion_enabled: false
        }

        const releases = ref([
          createMockRelease({
            required_feature_flags: ['model_upload_button_enabled'],
            excluded_feature_flags: ['asset_deletion_enabled']
          })
        ])
        const { shouldShowRelease } = useReleaseFeatureFlagFilter({ releases })

        expect(shouldShowRelease(releases.value[0])).toBe(true)
      })

      it('hides release when required enabled but excluded also enabled', () => {
        remoteConfig.value = {
          model_upload_button_enabled: true,
          asset_deletion_enabled: true
        }

        const releases = ref([
          createMockRelease({
            required_feature_flags: ['model_upload_button_enabled'],
            excluded_feature_flags: ['asset_deletion_enabled']
          })
        ])
        const { shouldShowRelease } = useReleaseFeatureFlagFilter({ releases })

        expect(shouldShowRelease(releases.value[0])).toBe(false)
      })

      it('hides release when required disabled even if excluded disabled', () => {
        remoteConfig.value = {
          model_upload_button_enabled: false,
          asset_deletion_enabled: false
        }

        const releases = ref([
          createMockRelease({
            required_feature_flags: ['model_upload_button_enabled'],
            excluded_feature_flags: ['asset_deletion_enabled']
          })
        ])
        const { shouldShowRelease } = useReleaseFeatureFlagFilter({ releases })

        expect(shouldShowRelease(releases.value[0])).toBe(false)
      })
    })
  })

  describe('evaluateFeatureFlag', () => {
    it('prefers remote config over server feature flags', () => {
      remoteConfig.value = {
        model_upload_button_enabled: true
      }
      vi.mocked(api.getServerFeature).mockReturnValue(false)

      const releases = ref<ReleaseNote[]>([])
      const { evaluateFeatureFlag } = useReleaseFeatureFlagFilter({ releases })

      expect(evaluateFeatureFlag('model_upload_button_enabled')).toBe(true)
      // Server feature should not be called when remote config has the value
      expect(api.getServerFeature).not.toHaveBeenCalled()
    })

    it('falls back to server feature flags when remote config is undefined', () => {
      vi.mocked(api.getServerFeature).mockImplementation((path) => {
        if (path === 'server_only_flag') return true
        return false
      })

      const releases = ref<ReleaseNote[]>([])
      const { evaluateFeatureFlag } = useReleaseFeatureFlagFilter({ releases })

      expect(evaluateFeatureFlag('server_only_flag')).toBe(true)
      expect(api.getServerFeature).toHaveBeenCalledWith(
        'server_only_flag',
        false
      )
    })

    it('returns false as default when flag not found in either source', () => {
      const releases = ref<ReleaseNote[]>([])
      const { evaluateFeatureFlag } = useReleaseFeatureFlagFilter({ releases })

      expect(evaluateFeatureFlag('unknown_flag')).toBe(false)
    })
  })

  describe('filteredReleases', () => {
    it('filters releases based on feature flags', () => {
      remoteConfig.value = {
        model_upload_button_enabled: true,
        asset_deletion_enabled: false
      }

      const releases = ref([
        createMockRelease({
          id: 1,
          version: '1.0.0',
          required_feature_flags: ['model_upload_button_enabled']
        }),
        createMockRelease({
          id: 2,
          version: '0.9.0',
          required_feature_flags: ['asset_deletion_enabled']
        }),
        createMockRelease({
          id: 3,
          version: '0.8.0'
        })
      ])

      const { filteredReleases } = useReleaseFeatureFlagFilter({ releases })

      expect(filteredReleases.value).toHaveLength(2)
      expect(filteredReleases.value.map((r) => r.id)).toEqual([1, 3])
    })

    it('maintains order of releases after filtering', () => {
      remoteConfig.value = {
        model_upload_button_enabled: true,
        linear_toggle_enabled: true
      }

      const releases = ref([
        createMockRelease({
          id: 1,
          required_feature_flags: ['model_upload_button_enabled']
        }),
        createMockRelease({
          id: 2,
          required_feature_flags: ['linear_toggle_enabled']
        }),
        createMockRelease({
          id: 3,
          required_feature_flags: ['model_upload_button_enabled']
        })
      ])

      const { filteredReleases } = useReleaseFeatureFlagFilter({ releases })

      expect(filteredReleases.value.map((r) => r.id)).toEqual([1, 2, 3])
    })

    it('returns empty array when no releases match', () => {
      const releases = ref([
        createMockRelease({
          required_feature_flags: ['non_existent_flag']
        })
      ])

      const { filteredReleases } = useReleaseFeatureFlagFilter({ releases })

      expect(filteredReleases.value).toEqual([])
    })

    it('returns all releases when none have feature flag requirements', () => {
      const releases = ref([
        createMockRelease({ id: 1 }),
        createMockRelease({ id: 2 }),
        createMockRelease({ id: 3 })
      ])

      const { filteredReleases } = useReleaseFeatureFlagFilter({ releases })

      expect(filteredReleases.value).toHaveLength(3)
    })
  })
})
