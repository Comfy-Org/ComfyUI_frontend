import { StorageSerializers, useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type { ServerFeatureFlag } from '@/platform/remoteConfig/serverFeatureFlag'

import type { RemoteConfig } from './types'

type RemoteConfigLoadState =
  | 'unloaded'
  | 'anonymous'
  | 'authenticated'
  | 'error'
type AuthenticatedRemoteConfigLoadState =
  | 'unloaded'
  | 'loading'
  | 'authenticated'
  | 'error'

const AGENT_GRANT_FALLBACK_MS = 15 * 60_000

export function configValueOrDefault<K extends keyof RemoteConfig>(
  remoteConfig: RemoteConfig,
  key: K,
  defaultValue: NonNullable<RemoteConfig[K]>
): NonNullable<RemoteConfig[K]> {
  const configValue = remoteConfig[key]
  return configValue || defaultValue
}

/** Runtime configuration served by `/features`, changed only through its actions. */
export const useRemoteConfigStore = defineStore('remoteConfig', () => {
  const config = shallowRef<RemoteConfig>({})
  const loadState = ref<RemoteConfigLoadState>('unloaded')
  const authenticatedLoadState =
    ref<AuthenticatedRemoteConfigLoadState>('unloaded')
  const errorStatus = ref<number | null>(null)
  const agentGrant = ref<boolean>()
  const agentGrantValidUntil = ref<number>()
  let agentGrantExpiryTimer: ReturnType<typeof setTimeout> | undefined

  const cachedBillingControlEnabled = useStorage<boolean | undefined>(
    'billing_control_enabled' satisfies `${ServerFeatureFlag.BILLING_CONTROL_ENABLED}`,
    undefined,
    undefined,
    { serializer: StorageSerializers.boolean }
  )
  const cachedV1PaymentRecovery = useStorage<boolean | undefined>(
    'v1_payment_recovery' satisfies `${ServerFeatureFlag.V1_PAYMENT_RECOVERY}`,
    undefined,
    undefined,
    { serializer: StorageSerializers.boolean }
  )

  function publishConfig(next: RemoteConfig): void {
    window.__CONFIG__ = next
    config.value = next
  }

  function clearAgentGrant(): void {
    clearTimeout(agentGrantExpiryTimer)
    agentGrantExpiryTimer = undefined
    agentGrant.value = undefined
    agentGrantValidUntil.value = undefined
  }

  function grantAgentForSession(granted: boolean): void {
    clearTimeout(agentGrantExpiryTimer)
    agentGrant.value = granted
    const validUntil = Date.now() + AGENT_GRANT_FALLBACK_MS
    agentGrantValidUntil.value = validUntil
    agentGrantExpiryTimer = setTimeout(() => {
      if (agentGrantValidUntil.value !== validUntil) return
      clearAgentGrant()
    }, AGENT_GRANT_FALLBACK_MS)
  }

  function beginAuthenticatedLoad(): void {
    authenticatedLoadState.value = 'loading'
  }

  function abandonAuthenticatedLoad(
    previous: AuthenticatedRemoteConfigLoadState
  ): void {
    authenticatedLoadState.value = previous
  }

  function acceptConfig(next: RemoteConfig, authenticated: boolean): void {
    publishConfig(next)
    errorStatus.value = null
    loadState.value = authenticated ? 'authenticated' : 'anonymous'
    if (!authenticated) {
      authenticatedLoadState.value = 'unloaded'
      clearAgentGrant()
      return
    }
    authenticatedLoadState.value = 'authenticated'
    cachedBillingControlEnabled.value = Boolean(next.billing_control_enabled)
    cachedV1PaymentRecovery.value = Boolean(next.v1_payment_recovery)
    grantAgentForSession(next['agent-in-app-experience'] === true)
  }

  function acceptUnifiedWebSession(enabled: boolean): void {
    publishConfig({ ...config.value, unified_web_session: enabled })
  }

  function failLoad(authenticated: boolean, status?: number): void {
    const identityRejected = authenticated && (status === 401 || status === 403)
    errorStatus.value = identityRejected ? status : null
    if (identityRejected) {
      publishConfig({})
      clearAgentGrant()
    }
    if (authenticated) authenticatedLoadState.value = 'error'
    loadState.value = 'error'
  }

  function invalidate(): void {
    const {
      comfy_api_base_url,
      comfy_cloud_base_url,
      comfy_platform_base_url
    } = config.value
    publishConfig({
      ...(comfy_api_base_url && { comfy_api_base_url }),
      ...(comfy_cloud_base_url && { comfy_cloud_base_url }),
      ...(comfy_platform_base_url && { comfy_platform_base_url })
    })
    errorStatus.value = null
    loadState.value = 'unloaded'
    authenticatedLoadState.value = 'unloaded'
    clearAgentGrant()
  }

  return {
    config: computed(() => config.value),
    loadState: computed(() => loadState.value),
    authenticatedLoadState: computed(() => authenticatedLoadState.value),
    isAuthenticatedConfigLoaded: computed(
      () => authenticatedLoadState.value === 'authenticated'
    ),
    errorStatus: computed(() => errorStatus.value),
    agentGrant: computed(() => agentGrant.value),
    agentGrantValidUntil: computed(() => agentGrantValidUntil.value),
    cachedBillingControlEnabled: computed(
      () => cachedBillingControlEnabled.value
    ),
    cachedV1PaymentRecovery: computed(() => cachedV1PaymentRecovery.value),
    beginAuthenticatedLoad,
    abandonAuthenticatedLoad,
    acceptConfig,
    acceptUnifiedWebSession,
    failLoad,
    invalidate
  }
})
