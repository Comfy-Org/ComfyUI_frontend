import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope } from 'vue'

import { onBillingRefresh } from '@/platform/billing/billingRefresh'
import { reserveBillingTab } from '@/platform/billing/billingTab'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useRefreshBillingOnReturn } from '@/platform/billing/composables/useRefreshBillingOnReturn'
import { hostedBillingRoute } from '@/platform/billing/hostedBillingRoutes'
import {
  disarmHostedBillingReturnRefresh,
  openHostedBillingTab
} from '@/platform/billing/openHostedBillingTab'

const distribution = vi.hoisted(() => ({ isCloud: false }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/billingTab'))
vi.mock(import('@/platform/billing/hostedBillingRoutes'))

const leave = () => window.dispatchEvent(new Event('blur'))
const comeBack = () => window.dispatchEvent(new Event('focus'))

function heldRead() {
  const settles: Array<() => void> = []
  const read = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        settles.push(resolve)
      })
  )
  const settle = async (index: number) => {
    settles[index]()
    await vi.advanceTimersByTimeAsync(0)
  }
  const settleAll = () => settles.forEach((resolve) => resolve())
  return { read, settle, settleAll }
}

function openBillingTab({
  isCloud = false,
  isInitialized = true,
  includeCloud = false
} = {}) {
  distribution.isCloud = isCloud
  onTestFinished(() => {
    distribution.isCloud = false
  })
  const account = heldRead()
  onTestFinished(onBillingRefresh(account.read))
  const capabilities = heldRead()
  const billing = useBillingContext()
  billing.isInitialized.value = isInitialized
  vi.mocked(useBillingContext).mockReturnValue(billing)
  vi.mocked(useBillingCapabilities().refresh).mockImplementation(
    capabilities.read
  )
  const scope = effectScope()
  scope.run(() => useRefreshBillingOnReturn({ includeCloud }))
  const finishReads = async () => {
    account.settleAll()
    capabilities.settleAll()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  onTestFinished(async () => {
    scope.stop()
    await finishReads()
    await finishReads()
  })
  return {
    readAccount: account.read,
    readCapabilities: capabilities.read,
    settleAccount: account.settle,
    settleCapabilities: capabilities.settle,
    close: () => scope.stop()
  }
}

describe('useRefreshBillingOnReturn', () => {
  it('re-reads plan, balance and capabilities once when the user returns to a local tab', () => {
    const { readAccount, readCapabilities } = openBillingTab()

    leave()
    comeBack()
    document.dispatchEvent(new Event('visibilitychange'))

    expect(readAccount).toHaveBeenCalledExactlyOnceWith('account')
    expect(readCapabilities).toHaveBeenCalledOnce()
  })

  it('reads once on a return when the hosted billing tab armed the same refresh', () => {
    const { readAccount, readCapabilities } = openBillingTab()
    vi.mocked(hostedBillingRoute).mockReturnValue({
      kind: 'billing_web',
      url: new URL('https://billing.example/v1/pricing')
    })
    vi.mocked(reserveBillingTab).mockReturnValue({
      navigate: vi.fn(),
      close: vi.fn()
    })
    onTestFinished(disarmHostedBillingReturnRefresh)
    expect(openHostedBillingTab('pricing')).toBe(true)

    leave()
    comeBack()

    expect(readAccount).toHaveBeenCalledExactlyOnceWith('account')
    expect(readCapabilities).toHaveBeenCalledOnce()
  })

  it('re-reads on every later return', async () => {
    const { readAccount, settleAccount, settleCapabilities } = openBillingTab()

    leave()
    comeBack()
    await settleAccount(0)
    await settleCapabilities(0)
    leave()
    comeBack()

    expect(readAccount).toHaveBeenCalledTimes(2)
  })

  it('re-reads plan, balance and capabilities once on a return to a Cloud tab that asked for it', () => {
    const { readAccount, readCapabilities } = openBillingTab({
      isCloud: true,
      includeCloud: true
    })

    leave()
    comeBack()
    document.dispatchEvent(new Event('visibilitychange'))

    expect(readAccount).toHaveBeenCalledExactlyOnceWith('account')
    expect(readCapabilities).toHaveBeenCalledOnce()
  })

  it('leaves the first load alone on a Cloud tab that asked for it while billing has not initialized', () => {
    const { readAccount, readCapabilities } = openBillingTab({
      isCloud: true,
      includeCloud: true,
      isInitialized: false
    })

    leave()
    comeBack()

    expect(readAccount).not.toHaveBeenCalled()
    expect(readCapabilities).not.toHaveBeenCalled()
  })

  it('reads nothing on Cloud by default', () => {
    const { readAccount, readCapabilities } = openBillingTab({ isCloud: true })

    leave()
    comeBack()

    expect(readAccount).not.toHaveBeenCalled()
    expect(readCapabilities).not.toHaveBeenCalled()
  })

  it('holds the read of a return that lands in flight until account and capabilities both settle', async () => {
    const { readAccount, readCapabilities, settleAccount, settleCapabilities } =
      openBillingTab()

    leave()
    comeBack()
    leave()
    comeBack()
    await settleAccount(0)

    expect(readAccount).toHaveBeenCalledOnce()
    expect(readCapabilities).toHaveBeenCalledOnce()

    await settleCapabilities(0)

    expect(readAccount).toHaveBeenCalledTimes(2)
    expect(readCapabilities).toHaveBeenCalledTimes(2)
  })

  it('leaves the first load alone while billing has not initialized', () => {
    const { readAccount, readCapabilities } = openBillingTab({
      isInitialized: false
    })

    leave()
    comeBack()

    expect(readAccount).not.toHaveBeenCalled()
    expect(readCapabilities).not.toHaveBeenCalled()
  })

  it('stops reading once the tab is closed', () => {
    const { readAccount, close } = openBillingTab()

    close()
    leave()
    comeBack()

    expect(readAccount).not.toHaveBeenCalled()
  })
})
