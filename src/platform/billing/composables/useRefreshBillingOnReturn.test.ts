import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { onBillingRefresh } from '@/platform/billing/billingRefresh'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useRefreshBillingOnReturn } from '@/platform/billing/composables/useRefreshBillingOnReturn'

const distribution = vi.hoisted(() => ({ isCloud: false }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

const leave = () => window.dispatchEvent(new Event('blur'))
const comeBack = () => window.dispatchEvent(new Event('focus'))

function openBillingTab({ isCloud = false, isInitialized = true } = {}) {
  distribution.isCloud = isCloud
  onTestFinished(() => {
    distribution.isCloud = false
  })
  const settles: Array<() => void> = []
  const readAccount = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        settles.push(resolve)
      })
  )
  onTestFinished(onBillingRefresh(readAccount))
  const readCapabilities = vi.fn(async () => {})
  vi.mocked(useBillingContext).mockReturnValue(
    fromPartial({ isInitialized: ref(isInitialized) })
  )
  vi.mocked(useBillingCapabilities).mockReturnValue(
    fromPartial({ refresh: readCapabilities })
  )
  const scope = effectScope()
  scope.run(useRefreshBillingOnReturn)
  onTestFinished(() => scope.stop())
  const settle = async (index: number) => {
    settles[index]()
    await new Promise((resolve) => setTimeout(resolve))
  }
  return { readAccount, readCapabilities, settle, close: () => scope.stop() }
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

  it('re-reads on every later return', async () => {
    const { readAccount, settle } = openBillingTab()

    leave()
    comeBack()
    await settle(0)
    leave()
    comeBack()

    expect(readAccount).toHaveBeenCalledTimes(2)
  })

  it('reads nothing on Cloud', () => {
    const { readAccount, readCapabilities } = openBillingTab({ isCloud: true })

    leave()
    comeBack()

    expect(readAccount).not.toHaveBeenCalled()
    expect(readCapabilities).not.toHaveBeenCalled()
  })

  it('does not start a second read while the first is in flight', () => {
    const { readAccount } = openBillingTab()

    leave()
    comeBack()
    leave()
    comeBack()

    expect(readAccount).toHaveBeenCalledOnce()
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
