import { onTestFinished } from 'vitest'
import { computed, customRef } from 'vue'

import * as realRemoteConfig from '../remoteConfig'

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

const remoteConfigRef = testScopedRef<
  typeof realRemoteConfig.remoteConfig.value
>({})
const remoteConfigStateRef =
  testScopedRef<typeof realRemoteConfig.remoteConfigState.value>('unloaded')
const remoteConfigErrorStatusRef = testScopedRef<number | null>(null)
const cachedBillingControlEnabledRef = testScopedRemovableRef<
  boolean | undefined
>(undefined)
const cachedLegacyBillingMigrationEnabledRef = testScopedRef<
  boolean | undefined
>(undefined)
const cachedV1PaymentRecoveryRef = testScopedRemovableRef<boolean | undefined>(
  undefined
)

const remoteConfigModule: typeof realRemoteConfig = {
  ...realRemoteConfig,
  remoteConfig: remoteConfigRef,
  remoteConfigState: remoteConfigStateRef,
  remoteConfigErrorStatus: remoteConfigErrorStatusRef,
  isAuthenticatedConfigLoaded: computed(
    () => remoteConfigStateRef.value === 'authenticated'
  ),
  cachedBillingControlEnabled: cachedBillingControlEnabledRef,
  cachedLegacyBillingMigrationEnabled: cachedLegacyBillingMigrationEnabledRef,
  cachedV1PaymentRecovery: cachedV1PaymentRecoveryRef
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
