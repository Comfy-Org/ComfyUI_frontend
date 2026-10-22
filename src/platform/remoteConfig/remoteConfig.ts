import { StorageSerializers, createGlobalState, useStorage } from '@vueuse/core'

import type { ServerFeatureFlag } from '@/platform/remoteConfig/serverFeatureFlag'

/**
 * Remote configuration service
 *
 * Fetches configuration from the server at runtime, enabling:
 * - Feature flags without rebuilding
 * - Server-side feature discovery
 * - Version compatibility management
 * - Avoiding vendor lock-in for native apps
 *
 * This module is tree-shaken in OSS builds.
 */

import { computed, ref } from 'vue'

import type { RemoteConfig } from './types'

/**
 * Load state for remote configuration.
 * - 'unloaded': No config loaded yet
 * - 'anonymous': Config loaded without auth (bootstrap)
 * - 'authenticated': Config loaded with auth (user-specific flags available)
 * - 'error': Failed to load config
 */
type RemoteConfigState = 'unloaded' | 'anonymous' | 'authenticated' | 'error'
export type AuthenticatedRemoteConfigState =
  | 'unloaded'
  | 'loading'
  | 'authenticated'
  | 'error'

/**
 * Current load state of remote configuration
 */
export const remoteConfigState = ref<RemoteConfigState>('unloaded')
export const authenticatedRemoteConfigState =
  ref<AuthenticatedRemoteConfigState>('unloaded')
export const remoteConfigRevision = ref(0)

export const remoteConfigErrorStatus = ref<number | null>(null)

/** Whether the authenticated config has been loaded. */
export const isAuthenticatedConfigLoaded = computed(
  () => authenticatedRemoteConfigState.value === 'authenticated'
)

/**
 * Reactive remote configuration
 * Updated whenever config is loaded from the server
 */
export const remoteConfig = ref<RemoteConfig>({})

export function configValueOrDefault<K extends keyof RemoteConfig>(
  remoteConfig: RemoteConfig,
  key: K,
  defaultValue: NonNullable<RemoteConfig[K]>
): NonNullable<RemoteConfig[K]> {
  const configValue = remoteConfig[key]
  return configValue || defaultValue
}

/** Last authenticated agent-allowlist answer, kept in memory for this session and never persisted. */
export const sessionAgentGrant = ref<boolean | undefined>()
export const sessionAgentGrantValidUntil = ref<number | undefined>()

function createRemoteConfigCache() {
  return {
    cachedBillingControlEnabled: useStorage<boolean | undefined>(
      'billing_control_enabled' satisfies `${ServerFeatureFlag.BILLING_CONTROL_ENABLED}`,
      undefined,
      undefined,
      { serializer: StorageSerializers.boolean }
    ),
    cachedV1PaymentRecovery: useStorage<boolean | undefined>(
      'v1_payment_recovery' satisfies `${ServerFeatureFlag.V1_PAYMENT_RECOVERY}`,
      undefined,
      undefined,
      { serializer: StorageSerializers.boolean }
    )
  }
}

/** Persisted server-flag cache, created on first use and shared by every caller. */
export const useRemoteConfigCache = createGlobalState(createRemoteConfigCache)
