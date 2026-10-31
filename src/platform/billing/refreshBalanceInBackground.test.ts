import { reportError } from '@comfyorg/telemetry/reportError'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { refreshBalanceInBackground } from '@/platform/billing/refreshBalanceInBackground'

const FIVE_MINUTES_MS = 5 * 60_000

function fail() {
  return Promise.reject(new Error('Balance temporarily unavailable'))
}

function succeed() {
  return Promise.resolve()
}

describe('refreshBalanceInBackground', () => {
  let testStart = Date.now()

  beforeEach(() => {
    testStart += 2 * FIVE_MINUTES_MS
    vi.setSystemTime(testStart)
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

  it('reports at most one failure every five minutes, whatever succeeds in between', async () => {
    await Promise.all([
      refreshBalanceInBackground(fail),
      refreshBalanceInBackground(fail)
    ])
    await refreshBalanceInBackground(succeed)
    await refreshBalanceInBackground(fail)
    expect(reportError).toHaveBeenCalledOnce()

    vi.setSystemTime(Date.now() + FIVE_MINUTES_MS)
    await refreshBalanceInBackground(fail)

    expect(reportError).toHaveBeenCalledTimes(2)
  })
})
