import { reportError } from '@comfyorg/telemetry/reportError'
import { describe, expect, it, vi } from 'vitest'

import { refreshBalanceInBackground } from '@/platform/billing/refreshBalanceInBackground'

describe('refreshBalanceInBackground', () => {
  it('reports nothing when the read succeeds', async () => {
    const fetchBalance = vi.fn().mockResolvedValue(undefined)

    refreshBalanceInBackground(fetchBalance)
    await vi.waitFor(() => expect(fetchBalance).toHaveBeenCalledOnce())
    await Promise.resolve()

    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a failed read once as a billing warning', async () => {
    const failure = new Error('Balance temporarily unavailable')

    refreshBalanceInBackground(() => Promise.reject(failure))

    await vi.waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(failure, {
        surface: 'billing',
        errorType: 'error_refreshing_balance',
        level: 'warning'
      })
    )
    expect(reportError).toHaveBeenCalledOnce()
  })
})
