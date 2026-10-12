import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BALANCE_WATCH_LIFETIME_MS,
  BALANCE_WATCH_MAX_SCHEDULED_RUNS,
  BALANCE_WATCH_RETRY_GAPS_MS,
  createBalanceWatch
} from './balanceWatch.js'
import type { BillingResult } from './billingContracts.js'
import type { CreditsSnapshot } from './credits.js'

const NOW = 1_000_000
const SCOPE = { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' } as const
const FULL_RUN_MS = BALANCE_WATCH_RETRY_GAPS_MS.reduce<number>(
  (sum, gap) => sum + gap,
  0
)

/** Answers are consumed in order; the last one repeats. */
function fakeCredits(answers: (number | 'error')[]) {
  const readAt: number[] = []
  const read = vi.fn(async (): Promise<BillingResult<CreditsSnapshot>> => {
    const answer = answers[Math.min(readAt.length, answers.length - 1)]
    readAt.push(Date.now())
    if (answer === 'error') return { status: 'error', code: 'REQUEST_FAILED' }
    return {
      status: 'ok',
      value: {
        balance: { amount_micros: answer, currency: 'USD' },
        scope: SCOPE,
        readAt: Date.now()
      }
    }
  })
  return { credits: { read }, read, readAt }
}

async function runSchedule() {
  await vi.advanceTimersByTimeAsync(FULL_RUN_MS)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe('createBalanceWatch', () => {
  it('reads on the retry schedule after a wake and settles once the balance rises above the baseline', async () => {
    const { credits, readAt } = fakeCredits([100, 100, 100, 200])
    const watch = createBalanceWatch({ credits, baselineMicros: 100 })

    watch.wake()
    await runSchedule()

    await expect(watch.outcome).resolves.toBe('reconciled')
    expect(readAt).toEqual([NOW, NOW + 2_000, NOW + 7_000, NOW + 17_000])
  })

  it('learns the baseline from the first read when none is given, which never counts as the rise', async () => {
    const { credits, read } = fakeCredits([100, 100, 200])
    const watch = createBalanceWatch({ credits })

    watch.wake()
    await runSchedule()

    await expect(watch.outcome).resolves.toBe('reconciled')
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('treats a failed read as no verdict and keeps the schedule', async () => {
    const { credits, read } = fakeCredits(['error', 200])
    const watch = createBalanceWatch({ credits, baselineMicros: 100 })

    watch.wake()
    await runSchedule()

    await expect(watch.outcome).resolves.toBe('reconciled')
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('joins a wake to the run in progress instead of starting a second', async () => {
    const { credits, read } = fakeCredits([100])
    const watch = createBalanceWatch({ credits, baselineMicros: 100 })

    watch.wake()
    await vi.advanceTimersByTimeAsync(1_000)
    watch.wake()
    await runSchedule()

    expect(read).toHaveBeenCalledTimes(BALANCE_WATCH_RETRY_GAPS_MS.length)
  })

  it('reads once per wake after the scheduled runs are used up', async () => {
    const { credits, read } = fakeCredits([100])
    const watch = createBalanceWatch({ credits, baselineMicros: 100 })

    for (let run = 0; run < BALANCE_WATCH_MAX_SCHEDULED_RUNS; run++) {
      watch.wake()
      await runSchedule()
    }
    const scheduledReads = read.mock.calls.length
    watch.wake()
    await runSchedule()

    expect(scheduledReads).toBe(
      BALANCE_WATCH_MAX_SCHEDULED_RUNS * BALANCE_WATCH_RETRY_GAPS_MS.length
    )
    expect(read).toHaveBeenCalledTimes(scheduledReads + 1)
  })

  it('expires after its lifetime and ignores later wakes', async () => {
    const { credits, read } = fakeCredits([100])
    const watch = createBalanceWatch({ credits, baselineMicros: 100 })

    await vi.advanceTimersByTimeAsync(BALANCE_WATCH_LIFETIME_MS)
    await expect(watch.outcome).resolves.toBe('expired')

    watch.wake()
    await runSchedule()
    expect(read).not.toHaveBeenCalled()
  })

  it('stops on request and cancels the pending reads', async () => {
    const { credits, read } = fakeCredits([100])
    const watch = createBalanceWatch({ credits, baselineMicros: 100 })

    watch.wake()
    await vi.advanceTimersByTimeAsync(0)
    watch.stop()
    await runSchedule()

    await expect(watch.outcome).resolves.toBe('stopped')
    expect(read).toHaveBeenCalledTimes(1)
  })
})
