import { describe, expect, it, vi } from 'vitest'

import { onBillingRefresh, refreshBilling } from './billingRefresh'

describe('refreshBilling', () => {
  it('hands the scope to every registered reader', async () => {
    const context = vi.fn(async () => {})
    const capabilities = vi.fn(async () => {})
    const stopContext = onBillingRefresh(context)
    const stopCapabilities = onBillingRefresh(capabilities)

    await refreshBilling('subscription')

    expect(context).toHaveBeenCalledWith('subscription')
    expect(capabilities).toHaveBeenCalledWith('subscription')
    stopContext()
    stopCapabilities()
  })

  it('settles even when a reader rejects', async () => {
    const stop = onBillingRefresh(() => Promise.reject(new Error('offline')))

    await expect(refreshBilling('account')).resolves.toBeUndefined()
    stop()
  })

  it('waits for every reader before settling', async () => {
    let finished = false
    const stop = onBillingRefresh(async () => {
      await Promise.resolve()
      finished = true
    })

    await refreshBilling('account')

    expect(finished).toBe(true)
    stop()
  })

  it('stops reaching a reader once its registration is released', async () => {
    const reader = vi.fn()
    const stop = onBillingRefresh(reader)
    stop()

    await refreshBilling('capabilities')

    expect(reader).not.toHaveBeenCalled()
  })
})
