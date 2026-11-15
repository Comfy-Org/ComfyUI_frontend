import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { refreshBillingAccount } from '@/platform/billing/billingAccountRefresh'
import { onBillingRefresh } from '@/platform/billing/billingRefresh'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

describe('refreshBillingAccount', () => {
  it('shares one read between calls that overlap, then reads again', async () => {
    let settle: () => void = () => {}
    const readAccount = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve
        })
    )
    onTestFinished(onBillingRefresh(readAccount))

    const first = refreshBillingAccount()
    const second = refreshBillingAccount()

    expect(readAccount).toHaveBeenCalledExactlyOnceWith('account')
    expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()

    settle()
    await Promise.all([first, second])
    const third = refreshBillingAccount()

    expect(readAccount).toHaveBeenCalledTimes(2)
    settle()
    await third
  })
})
