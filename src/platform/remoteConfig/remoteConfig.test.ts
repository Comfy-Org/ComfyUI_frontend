import { describe, expect, it, onTestFinished } from 'vitest'

import { useRemoteConfigCache } from './remoteConfig'

describe('useRemoteConfigCache', () => {
  it('reads persisted flags on first use, not at import, and shares one cache', () => {
    localStorage.setItem('billing_control_enabled', 'true')
    localStorage.setItem('v1_payment_recovery', 'false')
    onTestFinished(() => {
      localStorage.removeItem('billing_control_enabled')
      localStorage.removeItem('v1_payment_recovery')
    })

    const cache = useRemoteConfigCache()

    expect(cache.cachedBillingControlEnabled.value).toBe(true)
    expect(cache.cachedV1PaymentRecovery.value).toBe(false)
    expect(useRemoteConfigCache()).toBe(cache)
  })
})
