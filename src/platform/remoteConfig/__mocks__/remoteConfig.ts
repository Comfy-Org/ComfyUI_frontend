import { onTestFinished } from 'vitest'
import { computed, customRef } from 'vue'

import type * as realRemoteConfig from '../remoteConfig'

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

const remoteConfigModule: typeof realRemoteConfig = {
  remoteConfig: testScopedRef({}),
  remoteConfigState: remoteConfigStateRef,
  remoteConfigErrorStatus: testScopedRef(null),
  isAuthenticatedConfigLoaded: computed(
    () => remoteConfigStateRef.value === 'authenticated'
  ),
  configValueOrDefault(remoteConfig, key, defaultValue) {
    return remoteConfig[key] || defaultValue
  },
  cachedBillingControlEnabled: testScopedRemovableRef(undefined),
  cachedLegacyBillingMigrationEnabled: testScopedRef(undefined),
  cachedV1PaymentRecovery: testScopedRemovableRef(undefined)
}

export const {
  remoteConfigState,
  remoteConfigErrorStatus,
  isAuthenticatedConfigLoaded,
  remoteConfig,
  configValueOrDefault,
  cachedBillingControlEnabled,
  cachedLegacyBillingMigrationEnabled,
  cachedV1PaymentRecovery
} = remoteConfigModule
