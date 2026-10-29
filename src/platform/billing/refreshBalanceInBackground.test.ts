import { reportError } from '@comfyorg/telemetry/reportError'
import { beforeEach, describe, expect, it } from 'vitest'

import { refreshBalanceInBackground } from '@/platform/billing/refreshBalanceInBackground'

const fail = () => Promise.reject(new Error('Balance temporarily unavailable'))
const settle = () => new Promise((resolve) => setTimeout(resolve))

describe('refreshBalanceInBackground', () => {
  beforeEach(async () => {
    // A success ends any run of failures an earlier test left behind.
    refreshBalanceInBackground(() => Promise.resolve())
    await settle()
  })

  it('reports nothing when the read succeeds', async () => {
    refreshBalanceInBackground(() => Promise.resolve())
    await settle()

    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a failed read as a billing warning', async () => {
    const failure = new Error('Balance temporarily unavailable')

    refreshBalanceInBackground(() => Promise.reject(failure))
    await settle()

    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
      surface: 'billing',
      errorType: 'error_refreshing_balance',
      level: 'warning'
    })
  })

  it('reports a run of failures once, and again after a success', async () => {
    refreshBalanceInBackground(fail)
    refreshBalanceInBackground(fail)
    await settle()
    expect(reportError).toHaveBeenCalledOnce()

    refreshBalanceInBackground(() => Promise.resolve())
    await settle()
    refreshBalanceInBackground(fail)
    await settle()

    expect(reportError).toHaveBeenCalledTimes(2)
  })
})
