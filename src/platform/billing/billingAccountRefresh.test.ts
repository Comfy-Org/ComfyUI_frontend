import { createSharedComposable } from '@vueuse/core'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { onScopeDispose } from 'vue'

import { refreshBillingAccount } from '@/platform/billing/billingAccountRefresh'
import { onBillingRefresh } from '@/platform/billing/billingRefresh'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

function heldRead() {
  const settles: Array<() => void> = []
  const read = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        settles.push(resolve)
      })
  )
  onTestFinished(() => settles.forEach((settle) => settle()))
  return { read, settle: (index: number) => settles[index]() }
}

function heldAccountRead() {
  const account = heldRead()
  onTestFinished(onBillingRefresh(account.read))
  return account
}

const leave = () => window.dispatchEvent(new Event('blur'))
const comeBack = () => window.dispatchEvent(new Event('focus'))

describe('refreshBillingAccount', () => {
  it('reads once for a return, however many listeners saw it', async () => {
    const account = heldAccountRead()
    const returned = new Event('focus')

    const first = refreshBillingAccount(returned)
    const second = refreshBillingAccount(returned)

    expect(account.read).toHaveBeenCalledExactlyOnceWith('account')
    expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()
    account.settle(0)
    await Promise.all([first, second])
  })

  it('reads again for a later return while the earlier read is still pending', () => {
    const account = heldAccountRead()

    void refreshBillingAccount(new Event('focus'))
    void refreshBillingAccount(new Event('focus'))

    expect(account.read).toHaveBeenCalledTimes(2)
  })

  it('reads on the return of a second trip that re-armed the refresh mid-read', () => {
    const account = heldAccountRead()
    const stopFirstTrip = registerRefreshOnReturn(refreshBillingAccount)
    comeBack()
    stopFirstTrip()
    onTestFinished(registerRefreshOnReturn(refreshBillingAccount))

    leave()
    comeBack()

    expect(account.read).toHaveBeenCalledTimes(2)
  })

  it('holds capabilities only until the read settles', async () => {
    const released = vi.fn()
    const capabilities = useBillingCapabilities()
    const capabilitiesRead = heldRead()
    vi.mocked(capabilities.refresh).mockImplementation(capabilitiesRead.read)
    vi.mocked(useBillingCapabilities).mockImplementation(
      createSharedComposable(() => {
        onScopeDispose(released)
        return capabilities
      })
    )

    const read = refreshBillingAccount(new Event('focus'))
    expect(released).not.toHaveBeenCalled()
    capabilitiesRead.settle(0)
    await read

    expect(released).toHaveBeenCalledOnce()
  })
})
