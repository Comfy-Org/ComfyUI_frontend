import { onTestFinished } from 'vitest'
import { computed, customRef } from 'vue'

import type * as realRemoteConfig from '@/platform/remoteConfig/remoteConfig'

function testScopedRef<T>(defaultValue: T) {
  let value = defaultValue

  return customRef<T>((track, trigger) => ({
    get() {
      track()
      return value
    },
    set(nextValue) {
      value = nextValue
      trigger()

      onTestFinished(() => {
        value = defaultValue
        trigger()
      })
    }
  }))
}

function testScopedRemovableRef<T>(defaultValue: T) {
  const scopedRef = testScopedRef(defaultValue)
  return Object.assign(scopedRef, {
    remove() {
      scopedRef.value = defaultValue
    }
  })
}

const remoteConfigStateRef =
  testScopedRef<typeof realRemoteConfig.remoteConfigState.value>('unloaded')
const authenticatedRemoteConfigStateRef =
  testScopedRef<typeof realRemoteConfig.authenticatedRemoteConfigState.value>(
    'unloaded'
  )

const remoteConfigCache: ReturnType<
  typeof realRemoteConfig.useRemoteConfigCache
> = {
  cachedBillingControlEnabled: testScopedRemovableRef(undefined),
  cachedV1PaymentRecovery: testScopedRemovableRef(undefined)
}

const remoteConfigModule: typeof realRemoteConfig = {
  remoteConfig: testScopedRef({}),
  remoteConfigState: remoteConfigStateRef,
  authenticatedRemoteConfigState: authenticatedRemoteConfigStateRef,
  remoteConfigRevision: testScopedRef(0),
  remoteConfigErrorStatus: testScopedRef(null),
  isAuthenticatedConfigLoaded: computed(
    () =>
      authenticatedRemoteConfigStateRef.value === 'authenticated' ||
      remoteConfigStateRef.value === 'authenticated'
  ),
  configValueOrDefault(remoteConfig, key, defaultValue) {
    return remoteConfig[key] || defaultValue
  },
  useRemoteConfigCache: () => remoteConfigCache,
  sessionAgentGrant: testScopedRef(undefined),
  sessionAgentGrantValidUntil: testScopedRef(undefined)
}

export const {
  remoteConfigState,
  authenticatedRemoteConfigState,
  remoteConfigRevision,
  remoteConfigErrorStatus,
  isAuthenticatedConfigLoaded,
  remoteConfig,
  configValueOrDefault,
  sessionAgentGrant,
  sessionAgentGrantValidUntil,
  useRemoteConfigCache
} = remoteConfigModule
