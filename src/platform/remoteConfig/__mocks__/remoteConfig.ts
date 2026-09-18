import { onTestFinished } from 'vitest'
import { computed, customRef } from 'vue'

import type * as realRemoteConfig from '../remoteConfig'

function testScopedRef<T>(defaultValue: T) {
  let value = defaultValue
  let restoring = false

  return customRef<T>((track, trigger) => ({
    get() {
      track()
      return value
    },
    set(nextValue) {
      value = nextValue
      trigger()
      if (restoring) return

      onTestFinished(() => {
        restoring = true
        value = defaultValue
        trigger()
        restoring = false
      })
    }
  }))
}

function testScopedRemovableRef<T>(defaultValue: T) {
  const scopedRef = testScopedRef(defaultValue)
  return Object.assign(scopedRef, {
    remove: () => {
      scopedRef.value = defaultValue
    }
  })
}

const state =
  testScopedRef<typeof realRemoteConfig.remoteConfigState.value>('unloaded')

const remoteConfigModule: typeof realRemoteConfig = {
  remoteConfig: testScopedRef({}),
  remoteConfigState: state,
  remoteConfigErrorStatus: testScopedRef(null),
  isAuthenticatedConfigLoaded: computed(() => state.value === 'authenticated'),
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
