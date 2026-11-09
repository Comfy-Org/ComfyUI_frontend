import { describe, expect, it } from 'vitest'

import {
  ownedQueueEntries,
  runWithCollectedCleanup
} from '@e2e/fixtures/utils/customNodeSuite'

describe('runWithCollectedCleanup', () => {
  it('preserves the test failure while every cleanup runs', async () => {
    const calls: string[] = []
    const testError = new Error('original test failure')
    const guardError = new Error('guard teardown failure')

    await expect(
      runWithCollectedCleanup(async () => {
        calls.push('test')
        throw testError
      }, [
        async () => {
          calls.push('guard')
          throw guardError
        },
        async () => {
          calls.push('perf')
        }
      ])
    ).rejects.toEqual(
      new AggregateError(
        [testError, guardError],
        'test and fixture teardown failed'
      )
    )
    expect(calls).toEqual(['test', 'guard', 'perf'])
  })

  it('rethrows a sole run or cleanup error by identity', async () => {
    const runError = new Error('run failed')
    const cleanupError = new Error('cleanup failed')

    await expect(
      runWithCollectedCleanup(async () => {
        throw runError
      }, [])
    ).rejects.toBe(runError)
    await expect(
      runWithCollectedCleanup(async () => {}, [
        async () => {
          throw cleanupError
        }
      ])
    ).rejects.toBe(cleanupError)
  })
})

describe('ownedQueueEntries', () => {
  it('selects only running and pending entries submitted by this page', () => {
    expect(
      ownedQueueEntries(
        {
          running: ['ours-running', 'foreign-running'],
          pending: ['foreign-pending', 'ours-pending']
        },
        new Set(['ours-running', 'ours-pending'])
      )
    ).toEqual({
      running: ['ours-running'],
      pending: ['ours-pending']
    })
  })

  it('tracks an owned entry when the backend promotes it to running', () => {
    const owned = new Set(['ours'])
    expect(
      ownedQueueEntries({ running: [], pending: ['ours'] }, owned)
    ).toEqual({ running: [], pending: ['ours'] })
    expect(
      ownedQueueEntries({ running: ['ours'], pending: [] }, owned)
    ).toEqual({ running: ['ours'], pending: [] })
  })
})
