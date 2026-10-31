import { describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  onBillingRefresh,
  provideCheckoutOperationReader,
  readCheckoutOperation,
  refreshBilling
} from './billingRefresh'

describe('refreshBilling', () => {
  it('hands the scope to every registered reader', async () => {
    const first = vi.fn()
    const second = vi.fn()
    onTestFinished(onBillingRefresh(first))
    onTestFinished(onBillingRefresh(second))

    await refreshBilling('subscription')

    expect(first.mock.calls).toEqual([['subscription']])
    expect(second.mock.calls).toEqual([['subscription']])
  })

  it('settles even when a reader rejects', async () => {
    onTestFinished(onBillingRefresh(() => Promise.reject(new Error('offline'))))

    await expect(refreshBilling('account')).resolves.toBeDefined()
  })

  it('waits for every reader before settling', async () => {
    let finished = false
    onTestFinished(
      onBillingRefresh(async () => {
        await Promise.resolve()
        finished = true
      })
    )

    await refreshBilling('account')

    expect(finished).toBe(true)
  })

  it('stops reaching a reader once its registration is released', async () => {
    const reader = vi.fn()
    onBillingRefresh(reader)()

    await refreshBilling('account')

    expect(reader).not.toHaveBeenCalled()
  })
})

describe('readCheckoutOperation', () => {
  it('reports no operation while no reader is registered', async () => {
    await expect(readCheckoutOperation()).resolves.toBe(false)
  })

  it('answers with the registered reader until it is released', async () => {
    const release = provideCheckoutOperationReader(async () => true)

    await expect(readCheckoutOperation()).resolves.toBe(true)
    release()
    await expect(readCheckoutOperation()).resolves.toBe(false)
  })

  it('keeps a newer reader when an older registration is released', async () => {
    const releaseOlder = provideCheckoutOperationReader(async () => false)
    onTestFinished(provideCheckoutOperationReader(async () => true))

    releaseOlder()

    await expect(readCheckoutOperation()).resolves.toBe(true)
  })
})
