import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { computed, isReactive, isReadonly, nextTick } from 'vue'

import {
  startFeatureFlagTelemetry,
  useFeatureFlags
} from '@/composables/useFeatureFlags'
import * as distributionTypes from '@/platform/distribution/types'
import {
  setLocalBillingNewUxEnabled,
  setLocalBillingWebEnabled
} from '@/platform/billing/localBillingWebEnabled'
import { refreshRemoteConfig } from '@/platform/remoteConfig/refreshRemoteConfig'
import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'
import { ServerFeatureFlag } from '@/platform/remoteConfig/serverFeatureFlag'
import { useTelemetry } from '@comfyorg/telemetry'
import { api } from '@/scripts/api'
import { getSessionOverride } from '@/utils/sessionFeatureFlagOverride'

vi.mock(import('@/scripts/api'))

vi.mock(import('@/utils/sessionFeatureFlagOverride'), () => ({
  getSessionOverride: vi.fn()
}))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: false,
  isDesktop: false,
  isNightly: false
}))

vi.mock(import('@comfyorg/telemetry'))

function persistFromAnotherTab(key: string, value: string) {
  localStorage.setItem(key, value)
  window.dispatchEvent(
    new StorageEvent('storage', {
      key,
      newValue: value,
      storageArea: localStorage
    })
  )
}

describe('useFeatureFlags', () => {
  it.for([
    { value: undefined, enabled: false },
    { value: false, enabled: false },
    { value: true, enabled: true }
  ])(
    'resolves CRDT diagnostics from the flag: $value',
    ({ value, enabled }) => {
      useRemoteConfigStore().acceptConfig(
        { 'Comfy.Agent.CrdtDebug': value },
        false
      )
      localStorage.setItem('Comfy.Agent.CrdtDebug.enabled', 'true')
      expect(useFeatureFlags().flags.agentCrdtDebugEnabled).toBe(enabled)
    }
  )

  afterEach(() => {
    vi.mocked(distributionTypes).isCloud = false
    vi.mocked(distributionTypes).isNightly = false
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
          if (path === ServerFeatureFlag.MAX_UPLOAD_SIZE) return 209715200
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

  describe('hostedBillingDestination', () => {
    it('stays on stripe when the server reports nothing, even with a development URL configured', () => {
      vi.stubEnv('VITE_BILLING_WEB_URL', 'http://localhost:5174')
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()

      expect(flags.hostedBillingDestination).toBe('stripe')
      expect(flags.hostedBillingWebEnabled).toBe(false)
      expect(api.getServerFeature).toHaveBeenCalledWith(
        ServerFeatureFlag.HOSTED_BILLING_DESTINATION,
        'stripe'
      )
    })

    it('enables the hosted app only on the billing_web variant', () => {
      const { flags } = useFeatureFlags()

      useRemoteConfigStore().acceptConfig(
        { hosted_billing_destination: 'billing_web' },
        false
      )
      expect(flags.hostedBillingDestination).toBe('billing_web')
      expect(flags.hostedBillingWebEnabled).toBe(true)

      useRemoteConfigStore().acceptConfig(
        { hosted_billing_destination: 'true' },
        false
      )
      expect(flags.hostedBillingDestination).toBe('stripe')
      expect(flags.hostedBillingWebEnabled).toBe(false)
    })
  })

  describe('billingNewUxEnabled', () => {
    it.for([
      { label: 'absent', value: undefined, enabled: false },
      { label: 'false', value: false, enabled: false },
      { label: 'a string', value: 'true', enabled: false },
      { label: 'true', value: true, enabled: true }
    ])(
      'enables the 1.61 billing UX only for literal true ($label)',
      ({ value, enabled }) => {
        useRemoteConfigStore().acceptConfig({}, false)
        vi.mocked(api.getServerFeature).mockReturnValue(value)

        expect(useFeatureFlags().flags.billingNewUxEnabled).toBe(enabled)
      }
    )

    it('reads the billing rollout from /features', () => {
      useRemoteConfigStore().acceptConfig(
        { billing_new_ux_enabled: true },
        false
      )
      vi.mocked(api.getServerFeature).mockReturnValue(false)

      expect(useFeatureFlags().flags.billingNewUxEnabled).toBe(true)
    })

    describe('off cloud, from the flags local reads from Cloud', () => {
      beforeEach(() => {
        vi.mocked(api.getServerFeature).mockReturnValue(false)
      })

      afterEach(() => {
        setLocalBillingWebEnabled(false)
        setLocalBillingNewUxEnabled(false)
      })

      it('follows Cloud while the handoff is open', () => {
        const { flags } = useFeatureFlags()
        const shown = computed(() => flags.billingNewUxEnabled)
        setLocalBillingWebEnabled(true)

        expect(shown.value).toBe(false)
        setLocalBillingNewUxEnabled(true)
        expect(shown.value).toBe(true)
        setLocalBillingWebEnabled(false)
        expect(shown.value).toBe(false)
      })

      it('ignores those flags on Cloud', () => {
        vi.mocked(distributionTypes).isCloud = true
        setLocalBillingWebEnabled(true)
        setLocalBillingNewUxEnabled(true)

        expect(useFeatureFlags().flags.billingNewUxEnabled).toBe(false)
      })
    })
  })

  describe('billingSdkRailEnabled', () => {
    it.for([
      { build: 'the Cloud build', cloud: true, expected: true },
      { build: 'any other build', cloud: false, expected: false }
    ])('is $expected on $build', ({ cloud, expected }) => {
      vi.mocked(distributionTypes).isCloud = cloud

      expect(useFeatureFlags().flags.billingSdkRailEnabled).toBe(expected)
    })
  })

  describe('ssoEnabled', () => {
    it.for([
      {
        case: 'missing on cloud',
        cloud: true,
        value: undefined,
        expected: false
      },
      { case: 'false on cloud', cloud: true, value: false, expected: false },
      {
        case: 'malformed on cloud',
        cloud: true,
        value: 'true',
        expected: false
      },
      { case: 'true on cloud', cloud: true, value: true, expected: true },
      { case: 'true off cloud', cloud: false, value: true, expected: false }
    ])('is $expected when $case', ({ cloud, value, expected }) => {
      vi.mocked(distributionTypes).isCloud = cloud
      vi.mocked(api.getServerFeature).mockReturnValue(value)

      expect(useFeatureFlags().flags.ssoEnabled).toBe(expected)
    })

    it('is false on cloud when feature lookup throws', () => {
      vi.mocked(distributionTypes).isCloud = true
      vi.mocked(api.getServerFeature).mockImplementation(() => {
        throw new Error('feature service unavailable')
      })

      expect(useFeatureFlags().flags.ssoEnabled).toBe(false)
    })
  })

  describe.for([
    {
      flag: 'unifiedBillingSettingsEnabled' as const,
      offCloudTrue: false
    }
  ])('$flag', ({ flag, offCloudTrue }) => {
    it.for([
      {
        case: 'missing on cloud',
        cloud: true,
        value: undefined,
        expected: false
      },
      { case: 'false on cloud', cloud: true, value: false, expected: false },
      {
        case: 'malformed on cloud',
        cloud: true,
        value: 'true',
        expected: false
      },
      { case: 'true on cloud', cloud: true, value: true, expected: true },
      {
        case: 'missing off cloud',
        cloud: false,
        value: undefined,
        expected: false
      },
      { case: 'false off cloud', cloud: false, value: false, expected: false },
      {
        case: 'malformed off cloud',
        cloud: false,
        value: 'true',
        expected: false
      },
      {
        case: 'true off cloud',
        cloud: false,
        value: true,
        expected: offCloudTrue
      }
    ])('is $expected when $case', ({ cloud, value, expected }) => {
      vi.mocked(distributionTypes).isCloud = cloud
      vi.mocked(api.getServerFeature).mockReturnValue(value)

      expect(useFeatureFlags().flags[flag]).toBe(expected)
    })

    it('is false on cloud when feature lookup throws', () => {
      vi.mocked(distributionTypes).isCloud = true
      vi.mocked(api.getServerFeature).mockImplementation(() => {
        throw new Error('feature service unavailable')
      })

      expect(useFeatureFlags().flags[flag]).toBe(false)
    })

    it('honours a session override on cloud', () => {
      vi.mocked(distributionTypes).isCloud = true
      vi.mocked(getSessionOverride).mockReturnValue(true)

      expect(useFeatureFlags().flags[flag]).toBe(true)
    })
  })

  describe('unifiedBillingSettingsEnabled off cloud', () => {
    afterEach(() => {
      setLocalBillingWebEnabled(false)
    })

    it.for([
      {
        case: 'local web with local_billing_web on',
        desktop: false,
        flag: true,
        expected: true
      },
      {
        case: 'local web with local_billing_web off',
        desktop: false,
        flag: false,
        expected: false
      },
      {
        case: 'Desktop with local_billing_web on',
        desktop: true,
        flag: true,
        expected: false
      }
    ])('is $expected on $case', ({ desktop, flag, expected }) => {
      vi.stubGlobal('__comfyDesktop2', desktop ? {} : undefined)
      setLocalBillingWebEnabled(flag)
      vi.mocked(api.getServerFeature).mockReturnValue(true)

      expect(useFeatureFlags().flags.unifiedBillingSettingsEnabled).toBe(
        expected
      )
    })

    it('follows the flag as it changes on local web', () => {
      const { flags } = useFeatureFlags()
      const shown = computed(() => flags.unifiedBillingSettingsEnabled)

      expect(shown.value).toBe(false)
      setLocalBillingWebEnabled(true)
      expect(shown.value).toBe(true)
      setLocalBillingWebEnabled(false)
      expect(shown.value).toBe(false)
    })
  })

  describe('localWebSsoEnabled', () => {
    it.for([
      {
        case: 'missing locally',
        cloud: false,
        value: undefined,
        expected: false
      },
      {
        case: 'malformed locally',
        cloud: false,
        value: 'true',
        expected: false
      },
      { case: 'true locally', cloud: false, value: true, expected: true },
      { case: 'true on cloud', cloud: true, value: true, expected: false }
    ])('is $expected when $case', ({ cloud, value, expected }) => {
      vi.mocked(distributionTypes).isCloud = cloud
      vi.mocked(api.getServerFeature).mockReturnValue(value)

      expect(useFeatureFlags().flags.localWebSsoEnabled).toBe(expected)
    })
  })

  describe('nodeLibraryEssentialsEnabled', () => {
    beforeEach(() => {
      vi.mocked(distributionTypes).isNightly = true
    })

    it('defaults on when nightly serves no value for the flag', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()
      expect(flags.nodeLibraryEssentialsEnabled).toBe(true)
    })

    it('lets a remote config false turn off the nightly default', () => {
      useRemoteConfigStore().acceptConfig(
        { node_library_essentials_enabled: false },
        false
      )
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()
      expect(flags.nodeLibraryEssentialsEnabled).toBe(false)
    })

    it('lets a served server false turn off the nightly default', () => {
      vi.mocked(api.getServerFeature).mockImplementation((path, defaultValue) =>
        path === ServerFeatureFlag.NODE_LIBRARY_ESSENTIALS_ENABLED
          ? false
          : defaultValue
      )

      const { flags } = useFeatureFlags()
      expect(flags.nodeLibraryEssentialsEnabled).toBe(false)
    })
  })

  describe('openOnCloudEnabled', () => {
    beforeEach(() => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )
    })

    it('stays off in a production build that serves no value', () => {
      vi.stubEnv('DEV', false)

      expect(useFeatureFlags().flags.openOnCloudEnabled).toBe(false)
    })

    it('stays off in a development build that serves no value', () => {
      vi.stubEnv('DEV', true)

      expect(useFeatureFlags().flags.openOnCloudEnabled).toBe(false)
    })

    it('keeps local controls off while the Cloud account decision is unavailable', () => {
      useRemoteConfigStore().acceptConfig(
        {
          open_on_cloud_enabled: true,
          open_on_cloud_use_local_agent_enabled: true
        },
        false
      )

      const { flags } = useFeatureFlags()
      expect(flags.openOnCloudEnabled).toBe(false)
      expect(flags.openOnCloudUseLocalAgentEnabled).toBe(false)
    })

    it.for([
      { dev: false, served: true, expected: true },
      { dev: true, served: false, expected: false }
    ])(
      'follows a remote config $served over the dev=$dev default',
      ({ dev, served, expected }) => {
        vi.mocked(distributionTypes).isCloud = true
        onTestFinished(() => {
          vi.mocked(distributionTypes).isCloud = false
        })
        vi.stubEnv('DEV', dev)
        useRemoteConfigStore().acceptConfig(
          { open_on_cloud_enabled: served },
          false
        )

        expect(useFeatureFlags().flags.openOnCloudEnabled).toBe(expected)
      }
    )
  })

  describe('openOnCloudUseLocalAgentEnabled', () => {
    beforeEach(() => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )
    })

    it.for([false, true])('defaults off in dev=%s', (dev) => {
      vi.stubEnv('DEV', dev)

      expect(useFeatureFlags().flags.openOnCloudUseLocalAgentEnabled).toBe(
        false
      )
    })

    it.for([
      { case: 'boolean true', served: true, expected: true },
      { case: 'boolean false', served: false, expected: false },
      { case: 'string "true"', served: 'true', expected: false }
    ])(
      'uses only a boolean true from remote config: $case',
      async ({ served, expected }) => {
        vi.mocked(distributionTypes).isCloud = true
        onTestFinished(() => {
          vi.mocked(distributionTypes).isCloud = false
        })
        const previousConfig = window.__CONFIG__
        onTestFinished(() => {
          window.__CONFIG__ = previousConfig
        })
        vi.mocked(api.apiURL).mockReturnValue('/api/features')
        vi.mocked(fetch).mockResolvedValue(
          Response.json({ open_on_cloud_use_local_agent_enabled: served })
        )

        await refreshRemoteConfig({ useAuth: false })

        expect(useRemoteConfigStore().loadState).toBe('anonymous')
        expect(useFeatureFlags().flags.openOnCloudUseLocalAgentEnabled).toBe(
          expected
        )
      }
    )
  })

  describe('assetsEnabled', () => {
    it.for([
      ['stable cohort without the flag', undefined, false],
      ['beta cohort with the flag', true, true],
      ['beta cohort after the kill switch', false, false]
    ] as const)(
      'maps the %s response to the expected state',
      ([, servedValue, expected]) => {
        vi.mocked(api.getServerFeature).mockImplementation(
          (path, defaultValue) =>
            path === 'assets' && servedValue !== undefined
              ? servedValue
              : defaultValue
        )

        expect(useFeatureFlags().flags.assetsEnabled).toBe(expected)
      }
    )
  })

  describe('partnerNodeGovernanceEnabled', () => {
    it('uses the workspace eligibility flag', () => {
      useRemoteConfigStore().acceptConfig(
        { partner_node_governance_enabled: true },
        false
      )

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

  describe('deploymentCompatibilityMarksEnabled', () => {
    it('turns on from remote config', () => {
      useRemoteConfigStore().acceptConfig(
        { deployment_compatibility_marks_enabled: true },
        false
      )

      const { flags } = useFeatureFlags()

      expect(flags.deploymentCompatibilityMarksEnabled).toBe(true)
    })

    it('falls back to the server feature of the same key', () => {
      vi.mocked(api.getServerFeature).mockImplementation((path, defaultValue) =>
        path === 'deployment_compatibility_marks_enabled' ? true : defaultValue
      )

      const { flags } = useFeatureFlags()

      expect(flags.deploymentCompatibilityMarksEnabled).toBe(true)
    })

    it('defaults to false when the remote flag is unset', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()

      expect(flags.deploymentCompatibilityMarksEnabled).toBe(false)
    })
  })

  describe('runtimeLibraryModelsEnabled', () => {
    it('turns on from remote config', () => {
      useRemoteConfigStore().acceptConfig(
        { runtime_library_models_enabled: true },
        false
      )

      const { flags } = useFeatureFlags()

      expect(flags.runtimeLibraryModelsEnabled).toBe(true)
    })

    it('falls back to the server feature of the same key', () => {
      vi.mocked(api.getServerFeature).mockImplementation((path, defaultValue) =>
        path === 'runtime_library_models_enabled' ? true : defaultValue
      )

      const { flags } = useFeatureFlags()

      expect(flags.runtimeLibraryModelsEnabled).toBe(true)
    })

    it('defaults to false when the remote flag is unset', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()

      expect(flags.runtimeLibraryModelsEnabled).toBe(false)
    })
  })

  describe('customDeploymentsEditorEnabled', () => {
    it('turns on from remote config', () => {
      useRemoteConfigStore().acceptConfig(
        { custom_deployments_editor_enabled: true },
        false
      )

      expect(useFeatureFlags().flags.customDeploymentsEditorEnabled).toBe(true)
    })

    it.for([
      { served: undefined, label: 'unset' },
      { served: 'true', label: 'a string' },
      { served: 1, label: 'a number' }
    ])('stays off when the served value is $label', ({ served }) => {
      vi.mocked(api.getServerFeature).mockImplementation((path, defaultValue) =>
        path === 'custom_deployments_editor_enabled'
          ? (served ?? defaultValue)
          : defaultValue
      )

      expect(useFeatureFlags().flags.customDeploymentsEditorEnabled).toBe(false)
    })

    it('stays off when the lookup throws', () => {
      vi.mocked(api.getServerFeature).mockImplementation(() => {
        throw new Error('features not loaded')
      })

      expect(useFeatureFlags().flags.customDeploymentsEditorEnabled).toBe(false)
    })

    it.for([
      { served: 'true', label: 'a string' },
      { served: 1, label: 'a number' }
    ])('stays off when remote config serves $label', ({ served }) => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )
      useRemoteConfigStore().acceptConfig(
        { custom_deployments_editor_enabled: served },
        false
      )

      expect(useFeatureFlags().flags.customDeploymentsEditorEnabled).toBe(false)
    })
  })

  describe('modelUploadFolders', () => {
    it('lists the folders the server accepts uploads into', () => {
      useRemoteConfigStore().acceptConfig(
        { model_upload_folders: ['checkpoints', 'loras'] },
        false
      )

      const { flags } = useFeatureFlags()

      expect(flags.modelUploadFolders).toEqual(['checkpoints', 'loras'])
    })

    it('is empty when the server sends no list', () => {
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const { flags } = useFeatureFlags()

      expect(flags.modelUploadFolders).toEqual([])
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
          if (path === ServerFeatureFlag.ASSET_DELETION_ENABLED) return true
          return defaultValue
        }
      )

      const { flags } = useFeatureFlags()
      expect(flags.assetDeletionEnabled).toBe(true)
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
    })

    it.for([
      { stored: 'false', expected: false },
      { stored: 'true', expected: true }
    ])(
      'resolves a persisted $stored as a boolean during the auth window',
      ({ stored, expected }) => {
        onTestFinished(() => {
          localStorage.removeItem('billing_control_enabled')
          localStorage.removeItem('v1_payment_recovery')
        })
        persistFromAnotherTab('billing_control_enabled', stored)
        persistFromAnotherTab('v1_payment_recovery', stored)

        const { flags } = useFeatureFlags()

        expect(flags.billingControlEnabled).toBe(expected)
        expect(flags.v1PaymentRecovery).toBe(expected)
      }
    )

    it('returns the cached session value during the auth window', () => {
      const store = useRemoteConfigStore()
      store.acceptConfig(
        { billing_control_enabled: true, v1_payment_recovery: true },
        true
      )
      store.invalidate()

      const { flags } = useFeatureFlags()
      expect(flags.billingControlEnabled).toBe(true)
      expect(flags.v1PaymentRecovery).toBe(true)
    })

    it('defaults to false during the auth window when nothing is cached', () => {
      const { flags } = useFeatureFlags()
      expect(flags.billingControlEnabled).toBe(false)
      expect(flags.v1PaymentRecovery).toBe(false)
    })

    it('prefers authenticated remoteConfig over the server feature fallback', () => {
      useRemoteConfigStore().acceptConfig(
        {
          billing_control_enabled: false,
          v1_payment_recovery: true
        },
        true
      )
      vi.mocked(api.getServerFeature).mockReturnValue(false)

      const { flags } = useFeatureFlags()
      expect(flags.billingControlEnabled).toBe(false)
      expect(flags.v1PaymentRecovery).toBe(true)
    })

    it('falls back to api.getServerFeature when authenticated config omits the flag', () => {
      useRemoteConfigStore().acceptConfig({}, true)
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
    it('uses the remote config value', () => {
      useRemoteConfigStore().acceptConfig(
        { supports_model_type_tags: true },
        false
      )

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

  describe('feature flag telemetry', () => {
    it('synchronizes resolved values when their sources change', async () => {
      vi.mocked(distributionTypes).isCloud = true
      useRemoteConfigStore().acceptConfig(
        {
          partner_node_governance_enabled: false
        },
        true
      )
      vi.mocked(api.getServerFeature).mockImplementation(
        (_path, defaultValue) => defaultValue
      )

      const stop = startFeatureFlagTelemetry()
      onTestFinished(stop)
      expect(useTelemetry()?.trackFeatureFlagEvaluation).toHaveBeenCalledWith(
        ServerFeatureFlag.PARTNER_NODE_GOVERNANCE_ENABLED,
        false
      )
      expect(useTelemetry()?.trackFeatureFlagEvaluation).toHaveBeenCalledWith(
        'assets',
        true
      )

      const currentTelemetry = useTelemetry()
      if (!currentTelemetry) throw new Error('Expected telemetry mock')
      vi.mocked(currentTelemetry.trackFeatureFlagEvaluation).mockClear()
      useRemoteConfigStore().acceptConfig(
        { partner_node_governance_enabled: true },
        false
      )
      await nextTick()

      expect(useTelemetry()?.trackFeatureFlagEvaluation).toHaveBeenCalledWith(
        ServerFeatureFlag.PARTNER_NODE_GOVERNANCE_ENABLED,
        true
      )
    })

    it('does not report when getters are only read', () => {
      vi.mocked(api.getServerFeature).mockReturnValue(false)

      const { flags } = useFeatureFlags()
      expect(flags.nodeLibraryEssentialsEnabled).toBe(false)
      expect(flags.nodeLibraryEssentialsEnabled).toBe(false)

      expect(useTelemetry()?.trackFeatureFlagEvaluation).not.toHaveBeenCalled()
    })

    it('is a no-op without a telemetry dispatcher', () => {
      const trackFeatureFlagEvaluation =
        useTelemetry()?.trackFeatureFlagEvaluation
      vi.mocked(useTelemetry).mockReturnValue(null)
      vi.mocked(api.getServerFeature).mockReturnValue(false)

      const stop = startFeatureFlagTelemetry()
      onTestFinished(stop)

      expect(trackFeatureFlagEvaluation).not.toHaveBeenCalled()
    })
  })

  describe('session override precedence', () => {
    it('beats the dev override, remote config and the server value', () => {
      vi.mocked(getSessionOverride).mockImplementation((flagKey) =>
        flagKey === ServerFeatureFlag.SIGNUP_TURNSTILE ? 'enforce' : undefined
      )
      localStorage.setItem(
        `ff:${ServerFeatureFlag.SIGNUP_TURNSTILE}`,
        '"shadow"'
      )
      useRemoteConfigStore().acceptConfig({ signup_turnstile: 'off' }, false)
      vi.mocked(api.getServerFeature).mockReturnValue('off')

      const { flags } = useFeatureFlags()
      expect(flags.signupTurnstileMode).toBe('enforce')
    })

    it('applies a false override instead of falling through to an enabled server value', () => {
      vi.mocked(getSessionOverride).mockImplementation((flagKey) =>
        flagKey === ServerFeatureFlag.NODE_LIBRARY_ESSENTIALS_ENABLED
          ? false
          : undefined
      )
      vi.mocked(api.getServerFeature).mockReturnValue(true)

      const { flags } = useFeatureFlags()
      expect(flags.nodeLibraryEssentialsEnabled).toBe(false)
    })

    it('turns the node library essentials tab off against an enabled remote config', () => {
      vi.mocked(getSessionOverride).mockImplementation((flagKey) =>
        flagKey === ServerFeatureFlag.NODE_LIBRARY_ESSENTIALS_ENABLED
          ? false
          : undefined
      )
      useRemoteConfigStore().acceptConfig(
        { node_library_essentials_enabled: true },
        false
      )
      vi.mocked(api.getServerFeature).mockReturnValue(true)

      const { flags } = useFeatureFlags()
      expect(flags.nodeLibraryEssentialsEnabled).toBe(false)
    })

    it('beats the auth-window fallback on auth-gated flags', () => {
      vi.mocked(distributionTypes).isCloud = true
      const store = useRemoteConfigStore()
      store.acceptConfig({ billing_control_enabled: false }, true)
      store.invalidate()
      vi.mocked(getSessionOverride).mockImplementation((flagKey) =>
        flagKey === ServerFeatureFlag.BILLING_CONTROL_ENABLED ? true : undefined
      )

      const { flags } = useFeatureFlags()
      expect(flags.billingControlEnabled).toBe(true)
    })
  })
  describe('agentInAppExperienceEnabled', () => {
    beforeEach(() => {
      vi.mocked(distributionTypes).isCloud = true
    })

    it('is false off-cloud even when the authenticated config grants it', () => {
      vi.mocked(distributionTypes).isCloud = false
      useRemoteConfigStore().acceptConfig(
        { 'agent-in-app-experience': true },
        true
      )

      const { flags } = useFeatureFlags()
      expect(flags.agentInAppExperienceEnabled).toBe(false)
    })

    it('is false during the anonymous window even when the config already grants it', () => {
      useRemoteConfigStore().acceptConfig(
        { 'agent-in-app-experience': true },
        false
      )

      const { flags } = useFeatureFlags()
      expect(flags.agentInAppExperienceEnabled).toBe(false)
    })

    it('is true once the authenticated config grants it', () => {
      useRemoteConfigStore().acceptConfig(
        { 'agent-in-app-experience': true },
        true
      )

      const { flags } = useFeatureFlags()
      expect(flags.agentInAppExperienceEnabled).toBe(true)
    })

    it('is false when the authenticated config omits the key', () => {
      useRemoteConfigStore().acceptConfig({}, true)

      const { flags } = useFeatureFlags()
      expect(flags.agentInAppExperienceEnabled).toBe(false)
    })

    it('keeps this session granted when a later refresh fails transiently', () => {
      const store = useRemoteConfigStore()
      store.acceptConfig({ 'agent-in-app-experience': true }, true)
      const { flags } = useFeatureFlags()
      expect(flags.agentInAppExperienceEnabled).toBe(true)

      store.failLoad(true)

      expect(flags.agentInAppExperienceEnabled).toBe(true)
    })

    it('expires the transient session grant after its bounded fallback window', () => {
      const store = useRemoteConfigStore()
      store.acceptConfig({ 'agent-in-app-experience': true }, true)
      store.failLoad(true)
      vi.advanceTimersByTime(15 * 60_000)

      const { flags } = useFeatureFlags()
      expect(flags.agentInAppExperienceEnabled).toBe(false)
    })

    it('drops the grant when the session itself is gone', () => {
      const store = useRemoteConfigStore()
      store.acceptConfig({ 'agent-in-app-experience': true }, true)
      store.failLoad(true, 401)

      const { flags } = useFeatureFlags()
      expect(flags.agentInAppExperienceEnabled).toBe(false)
    })

    it('treats an explicitly revoked grant as off during a refresh failure', () => {
      const store = useRemoteConfigStore()
      store.acceptConfig({}, true)
      store.failLoad(true)

      const { flags } = useFeatureFlags()
      expect(flags.agentInAppExperienceEnabled).toBe(false)
    })

    it('honours a session override ahead of the cloud and auth guards', () => {
      vi.mocked(distributionTypes).isCloud = false
      vi.mocked(getSessionOverride).mockImplementation((flagKey) =>
        flagKey === ServerFeatureFlag.AGENT_IN_APP_EXPERIENCE ? true : undefined
      )

      const { flags } = useFeatureFlags()
      expect(flags.agentInAppExperienceEnabled).toBe(true)
    })
  })
})
