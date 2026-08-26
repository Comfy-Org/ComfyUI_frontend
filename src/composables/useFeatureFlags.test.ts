import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isReactive, isReadonly } from 'vue'

import {
  ServerFeatureFlag,
  useFeatureFlags
} from '@/composables/useFeatureFlags'
import * as distributionTypes from '@/platform/distribution/types'
import {
  cachedBillingControlEnabled,
  cachedLegacyBillingMigrationEnabled,
  cachedV1PaymentRecovery,
  remoteConfig,
  remoteConfigState
} from '@/platform/remoteConfig/remoteConfig'
import { api } from '@/scripts/api'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

// Mock the API module
vi.mock('@/scripts/api', () => ({
  api: {
    getServerFeature: vi.fn()
  }
}))

vi.mock('@/utils/sessionFeatureFlagOverride', () => ({
  getSessionOverride: vi.fn()
}))

// Mock the distribution types module
vi.mock('@/platform/distribution/types', () => ({
  isCloud: false,
  isNightly: false
}))

describe('useFeatureFlags', () => {
  describe('flags object', () => {
    it('should provide reactive readonly flags', () => {
      const { flags } = useFeatureFlags()

      expect(isReadonly(flags)).toBe(true)
      expect(isReactive(flags)).toBe(true)
    })

    it('should access supportsPreviewMetadata', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA) return true
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
          if (path === ServerFeatureFlag.MAX_UPLOAD_SIZE) return 209715200 // 200MB
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
          if (path === ServerFeatureFlag.MANAGER_SUPPORTS_V4) return true
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
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) => {
          if (path === 'custom.feature') return 'custom-value'
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
          if (path === 'extension.custom.nested.feature') return true
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
          if (path === ServerFeatureFlag.MAX_UPLOAD_SIZE) return 104857600
          return defaultValue
        }
      )

      const { featureFlag } = useFeatureFlags()
      const maxUploadSize = featureFlag(ServerFeatureFlag.MAX_UPLOAD_SIZE)

      expect(maxUploadSize.value).toBe(104857600)
    })
  })

  describe('embeddedCheckoutEnabled', () => {
    it.for([
      ['missing', undefined, false],
      ['false', false, false],
      ['malformed', 'true', false],
      ['true', true, true]
    ] as const)('is fail-closed for %s values', ([, value, expected]) => {
      vi.mocked(api.getServerFeature).mockReturnValue(value)

      const { flags } = useFeatureFlags()

      expect(flags.embeddedCheckoutEnabled).toBe(expected)
      expect(api.getServerFeature).toHaveBeenCalledWith(
        'embedded_checked_enabled',
        false
      )
    })

    it('is false when feature lookup throws', () => {
      vi.mocked(api.getServerFeature).mockImplementation(() => {
        throw new Error('feature service unavailable')
      })

      expect(useFeatureFlags().flags.embeddedCheckoutEnabled).toBe(false)
    })
  })

  describe('linearToggleEnabled', () => {
    afterEach(() => {
      vi.mocked(distributionTypes).isNightly = false
      remoteConfig.value = {}
    })

    it('should return true when isNightly is true', () => {
      vi.mocked(distributionTypes).isNightly = true
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()
      expect(flags.linearToggleEnabled).toBe(true)
      expect(api.getServerFeature).toHaveBeenCalledWith(
        ServerFeatureFlag.LINEAR_TOGGLE_ENABLED,
        true
      )
    })

    it('should check remote config and server feature when isNightly is false', () => {
      vi.mocked(distributionTypes).isNightly = false
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.LINEAR_TOGGLE_ENABLED) return true
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.linearToggleEnabled).toBe(true)
      expect(api.getServerFeature).toHaveBeenCalledWith(
        ServerFeatureFlag.LINEAR_TOGGLE_ENABLED,
        false
      )
    })

    it('should return false when isNightly is false and flag is disabled', () => {
      vi.mocked(distributionTypes).isNightly = false
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()
      expect(flags.linearToggleEnabled).toBe(false)
    })

    it('lets a remote config false turn off the nightly default', () => {
      vi.mocked(distributionTypes).isNightly = true
      remoteConfig.value = { linear_toggle_enabled: false }
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()
      expect(flags.linearToggleEnabled).toBe(false)
    })

    it('lets a served server false turn off the nightly default', () => {
      vi.mocked(distributionTypes).isNightly = true
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) =>
          path === ServerFeatureFlag.LINEAR_TOGGLE_ENABLED
            ? false
            : defaultValue
      )

      const { flags } = useFeatureFlags()
      expect(flags.linearToggleEnabled).toBe(false)
    })
  })

  describe('nodeLibraryEssentialsEnabled', () => {
    beforeEach(() => {
      vi.mocked(distributionTypes).isNightly = true
    })

    afterEach(() => {
      vi.mocked(distributionTypes).isNightly = false
      remoteConfig.value = {}
    })

    it('defaults on when nightly serves no value for the flag', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()
      expect(flags.nodeLibraryEssentialsEnabled).toBe(true)
    })

    it('lets a remote config false turn off the nightly default', () => {
      remoteConfig.value = { node_library_essentials_enabled: false }
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()
      expect(flags.nodeLibraryEssentialsEnabled).toBe(false)
    })

    it('lets a served server false turn off the nightly default', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) =>
          path === ServerFeatureFlag.NODE_LIBRARY_ESSENTIALS_ENABLED
            ? false
            : defaultValue
      )

      const { flags } = useFeatureFlags()
      expect(flags.nodeLibraryEssentialsEnabled).toBe(false)
    })
  })

  describe('partnerNodeGovernanceEnabled', () => {
    afterEach(() => {
      remoteConfig.value = {}
    })

    it('uses the workspace eligibility flag', () => {
      remoteConfig.value = { partner_node_governance_enabled: true }

      const { flags } = useFeatureFlags()

      expect(flags.partnerNodeGovernanceEnabled).toBe(true)
    })

    it('defaults to false when the remote flag is unset', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()

      expect(flags.partnerNodeGovernanceEnabled).toBe(false)
    })
  })

  describe('legacyBillingMigrationEnabled', () => {
    beforeEach(() => {
      vi.mocked(distributionTypes).isCloud = true
      remoteConfigState.value = 'authenticated'
    })

    afterEach(() => {
      vi.mocked(distributionTypes).isCloud = false
      remoteConfigState.value = 'unloaded'
      remoteConfig.value = {}
      cachedLegacyBillingMigrationEnabled.value = undefined
    })

    it('migrates legacy billing when enabled by remote config', () => {
      remoteConfig.value = { legacy_billing_migration_enabled: true }

      const { flags } = useFeatureFlags()

      expect(flags.legacyBillingMigrationEnabled).toBe(true)
    })

    it('keeps migration off when remote config explicitly disables it', () => {
      remoteConfig.value = { legacy_billing_migration_enabled: false }
      vi.mocked(api.getServerFeature).mockReturnValue(true)

      const { flags } = useFeatureFlags()

      expect(flags.legacyBillingMigrationEnabled).toBe(false)
    })

    it('uses the server feature when authenticated config leaves it unset', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) =>
          path === ServerFeatureFlag.LEGACY_BILLING_MIGRATION_ENABLED
            ? true
            : defaultValue
      )

      const { flags } = useFeatureFlags()

      expect(flags.legacyBillingMigrationEnabled).toBe(true)
      expect(api.getServerFeature).toHaveBeenCalledWith(
        ServerFeatureFlag.LEGACY_BILLING_MIGRATION_ENABLED,
        false
      )
    })

    it('keeps legacy billing when the rollout flag is unset', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()

      expect(flags.legacyBillingMigrationEnabled).toBe(false)
    })
  })

  describe('onboardingTourEnabled', () => {
    afterEach(() => {
      remoteConfig.value = {}
    })

    it('defaults to false when nothing enables it', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()

      expect(
        flags.onboardingTourEnabled,
        'This flag gates a full-screen first-run takeover; defaulting it on would ship the takeover to every user the moment config is unreachable'
      ).toBe(false)
    })

    it('turns on from remote config', () => {
      remoteConfig.value = { onboarding_tour_enabled: true }

      const { flags } = useFeatureFlags()

      expect(flags.onboardingTourEnabled).toBe(true)
    })
  })

  describe('dev override via localStorage', () => {
    it('resolveFlag returns localStorage override over remoteConfig and server value', () => {
      vi.mocked(api.getServerFeature).mockReturnValue(false)
      localStorage.setItem('ff:model_upload_button_enabled', 'true')

      const { flags } = useFeatureFlags()
      expect(flags.modelUploadButtonEnabled).toBe(true)
    })

    it('resolveFlag falls through to server when no override is set', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.ASSET_RENAME_ENABLED) return true
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.assetRenameEnabled).toBe(true)
    })

    it('direct server flags delegate override to api.getServerFeature', () => {
      vi.mocked(api.getServerFeature).mockImplementation((path) => {
        if (path === ServerFeatureFlag.SUPPORTS_PREVIEW_METADATA)
          return 'overridden'
        return undefined
      })

      const { flags } = useFeatureFlags()
      expect(flags.supportsPreviewMetadata).toBe('overridden')
    })

    it('billingControlEnabled override bypasses isCloud and isAuthenticatedConfigLoaded guards', () => {
      vi.mocked(distributionTypes).isCloud = false
      localStorage.setItem('ff:billing_control_enabled', 'true')

      const { flags } = useFeatureFlags()
      expect(flags.billingControlEnabled).toBe(true)
    })

    it('v1PaymentRecovery uses the normal local development override', () => {
      vi.mocked(distributionTypes).isCloud = false
      localStorage.setItem('ff:v1_payment_recovery', 'true')

      const { flags } = useFeatureFlags()
      expect(flags.v1PaymentRecovery).toBe(true)
    })

    it('billingControlEnabled is false off-cloud even without an override', () => {
      vi.mocked(distributionTypes).isCloud = false

      const { flags } = useFeatureFlags()
      expect(flags.billingControlEnabled).toBe(false)
    })
  })

  describe('auth-gated flags on cloud', () => {
    beforeEach(() => {
      vi.mocked(distributionTypes).isCloud = true
      remoteConfigState.value = 'unloaded'
      remoteConfig.value = {}
      cachedBillingControlEnabled.value = undefined
      cachedLegacyBillingMigrationEnabled.value = undefined
      cachedV1PaymentRecovery.value = undefined
    })

    afterEach(() => {
      vi.mocked(distributionTypes).isCloud = false
      remoteConfigState.value = 'unloaded'
      remoteConfig.value = {}
      cachedBillingControlEnabled.value = undefined
      cachedLegacyBillingMigrationEnabled.value = undefined
      cachedV1PaymentRecovery.value = undefined
    })

    it('returns the cached session value during the auth window', () => {
      cachedBillingControlEnabled.value = true
      cachedLegacyBillingMigrationEnabled.value = true
      cachedV1PaymentRecovery.value = true

      const { flags } = useFeatureFlags()
      expect(flags.billingControlEnabled).toBe(true)
      expect(flags.legacyBillingMigrationEnabled).toBe(true)
      expect(flags.v1PaymentRecovery).toBe(true)
    })

    it('defaults to false during the auth window when nothing is cached', () => {
      const { flags } = useFeatureFlags()
      expect(flags.billingControlEnabled).toBe(false)
      expect(flags.legacyBillingMigrationEnabled).toBe(false)
      expect(flags.v1PaymentRecovery).toBe(false)
    })

    it('prefers authenticated remoteConfig over the server feature fallback', () => {
      remoteConfigState.value = 'authenticated'
      remoteConfig.value = {
        billing_control_enabled: false,
        v1_payment_recovery: true
      }
      vi.mocked(api.getServerFeature).mockReturnValue(false)

      const { flags } = useFeatureFlags()
      expect(flags.billingControlEnabled).toBe(false)
      expect(flags.v1PaymentRecovery).toBe(true)
    })

    it('falls back to api.getServerFeature when authenticated config omits the flag', () => {
      remoteConfigState.value = 'authenticated'
      remoteConfig.value = {}
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.BILLING_CONTROL_ENABLED) return true
          if (path === ServerFeatureFlag.V1_PAYMENT_RECOVERY) return true
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.billingControlEnabled).toBe(true)
      expect(flags.v1PaymentRecovery).toBe(true)
    })
  })

  describe('signupTurnstileMode', () => {
    it('falls back to the server feature flag with default off', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.SIGNUP_TURNSTILE) return 'enforce'
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.signupTurnstileMode).toBe('enforce')
      expect(api.getServerFeature).toHaveBeenCalledWith(
        ServerFeatureFlag.SIGNUP_TURNSTILE,
        'off'
      )
    })

    it('lets a dev override beat the server value', () => {
      vi.mocked(api.getServerFeature).mockReturnValue('off')
      localStorage.setItem(
        `ff:${ServerFeatureFlag.SIGNUP_TURNSTILE}`,
        '"shadow"'
      )

      const { flags } = useFeatureFlags()
      expect(flags.signupTurnstileMode).toBe('shadow')
    })
  })

  describe('supportsModelTypeTags', () => {
    afterEach(() => {
      remoteConfig.value = {}
    })

    it('uses the remote config value', () => {
      remoteConfig.value = { supports_model_type_tags: true }

      const { flags } = useFeatureFlags()

      expect(flags.supportsModelTypeTags).toBe(true)
    })

    it('falls back to the server feature flag when remote config omits it', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.SUPPORTS_MODEL_TYPE_TAGS) return true
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()

      expect(flags.supportsModelTypeTags).toBe(true)
      expect(api.getServerFeature).toHaveBeenCalledWith(
        ServerFeatureFlag.SUPPORTS_MODEL_TYPE_TAGS,
        false
      )
    })

    it('defaults to false when neither source has the flag', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()

      expect(flags.supportsModelTypeTags).toBe(false)
    })
  })

  describe('churnkeyAppId', () => {
    afterEach(() => {
      vi.mocked(distributionTypes).isCloud = false
      remoteConfig.value = {}
    })

    it('is disabled outside the cloud distribution', () => {
      remoteConfig.value = { churnkey_app_id: 'app_test' }

      expect(useFeatureFlags().flags.churnkeyAppId).toBe('')
    })

    it('reads and trims the cloud remote-config value', () => {
      vi.mocked(distributionTypes).isCloud = true
      remoteConfig.value = { churnkey_app_id: ' app_test ' }

      expect(useFeatureFlags().flags.churnkeyAppId).toBe('app_test')
    })

    it('falls back to the trimmed server feature value', () => {
      vi.mocked(distributionTypes).isCloud = true
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) =>
          path === ServerFeatureFlag.CHURNKEY_APP_ID
            ? ' app_server '
            : defaultValue
      )

      expect(useFeatureFlags().flags.churnkeyAppId).toBe('app_server')
    })
  })

  describe('unifiedCloudAuthEnabled', () => {
    it('reads the unified_cloud_auth server feature when set', () => {
      vi.mocked(distributionTypes).isCloud = true
      vi.mocked(api.getServerFeature).mockImplementation(
        (path, defaultValue) => {
          if (path === ServerFeatureFlag.UNIFIED_CLOUD_AUTH) return true
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.unifiedCloudAuthEnabled).toBe(true)
    })

    it('lets a dev override beat the server value', () => {
      vi.mocked(distributionTypes).isCloud = true
      vi.mocked(api.getServerFeature).mockReturnValue(false)
      localStorage.setItem('ff:unified_cloud_auth', 'true')

      const { flags } = useFeatureFlags()
      expect(flags.unifiedCloudAuthEnabled).toBe(true)
    })

    it('is disabled outside the cloud distribution', () => {
      vi.mocked(distributionTypes).isCloud = false
      remoteConfig.value = { unified_cloud_auth: true }

      expect(useFeatureFlags().flags.unifiedCloudAuthEnabled).toBe(false)
    })
  })

  describe('session override precedence', () => {
    afterEach(() => {
      vi.mocked(getSessionOverride).mockReset()
      vi.mocked(distributionTypes).isCloud = false
      vi.mocked(distributionTypes).isNightly = false
      remoteConfigState.value = 'unloaded'
      cachedBillingControlEnabled.value = undefined
      remoteConfig.value = {}
    })

    it('beats the dev override, remote config and the server value', () => {
      vi.mocked(getSessionOverride).mockImplementation((flagKey) =>
        flagKey === ServerFeatureFlag.SIGNUP_TURNSTILE ? 'enforce' : undefined
      )
      localStorage.setItem(
        `ff:${ServerFeatureFlag.SIGNUP_TURNSTILE}`,
        '"shadow"'
      )
      remoteConfig.value = { signup_turnstile: 'off' }
      vi.mocked(api.getServerFeature).mockReturnValue('off')

      const { flags } = useFeatureFlags()
      expect(flags.signupTurnstileMode).toBe('enforce')
    })

    it('applies a false override instead of falling through to an enabled server value', () => {
      vi.mocked(getSessionOverride).mockImplementation((flagKey) =>
        flagKey === ServerFeatureFlag.WORKFLOW_SHARING_ENABLED
          ? false
          : undefined
      )
      vi.mocked(api.getServerFeature).mockReturnValue(true)

      const { flags } = useFeatureFlags()
      expect(flags.workflowSharingEnabled).toBe(false)
    })

    it('turns the linear toggle off against an enabled remote config', () => {
      vi.mocked(distributionTypes).isNightly = true
      vi.mocked(getSessionOverride).mockImplementation((flagKey) =>
        flagKey === ServerFeatureFlag.LINEAR_TOGGLE_ENABLED ? false : undefined
      )
      remoteConfig.value = { linear_toggle_enabled: true }
      vi.mocked(api.getServerFeature).mockReturnValue(true)

      const { flags } = useFeatureFlags()
      expect(flags.linearToggleEnabled).toBe(false)
    })

    it('turns the node library essentials tab off against an enabled remote config', () => {
      vi.mocked(getSessionOverride).mockImplementation((flagKey) =>
        flagKey === ServerFeatureFlag.NODE_LIBRARY_ESSENTIALS_ENABLED
          ? false
          : undefined
      )
      remoteConfig.value = { node_library_essentials_enabled: true }
      vi.mocked(api.getServerFeature).mockReturnValue(true)

      const { flags } = useFeatureFlags()
      expect(flags.nodeLibraryEssentialsEnabled).toBe(false)
    })

    it('beats the auth-window fallback on auth-gated flags', () => {
      vi.mocked(distributionTypes).isCloud = true
      remoteConfigState.value = 'unloaded'
      cachedBillingControlEnabled.value = false
      vi.mocked(getSessionOverride).mockImplementation((flagKey) =>
        flagKey === ServerFeatureFlag.BILLING_CONTROL_ENABLED ? true : undefined
      )

      const { flags } = useFeatureFlags()
      expect(flags.billingControlEnabled).toBe(true)
    })
  })
})
