import { reportError } from '@comfyorg/telemetry/reportError'
import { beforeEach, describe, expect, it } from 'vitest'

import { refreshBalanceInBackground } from '@/platform/billing/refreshBalanceInBackground'

function fail() {
  return Promise.reject(new Error('Balance temporarily unavailable'))
}

function succeed() {
  return Promise.resolve()
}

describe('refreshBalanceInBackground', () => {
  beforeEach(async () => {
    await refreshBalanceInBackground(succeed)
  })

  it('reports nothing when the read succeeds', async () => {
    await refreshBalanceInBackground(succeed)

    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a failed read as a billing warning', async () => {
    const failure = new Error('Balance temporarily unavailable')

    await refreshBalanceInBackground(() => Promise.reject(failure))

    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
      surface: 'billing',
      errorType: 'error_refreshing_balance',
      level: 'warning'
    })
  })

  it('reports a run of failures once, and again after a success', async () => {
    await Promise.all([
      refreshBalanceInBackground(fail),
      refreshBalanceInBackground(fail)
    ])
    expect(reportError).toHaveBeenCalledOnce()

    await refreshBalanceInBackground(succeed)
    await refreshBalanceInBackground(fail)

    expect(reportError).toHaveBeenCalledTimes(2)
  })
})
