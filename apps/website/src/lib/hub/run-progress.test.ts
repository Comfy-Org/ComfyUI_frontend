import { describe, expect, it } from 'vitest'

import { runHint, runSaying } from './run-progress'

describe('runSaying', () => {
  // One line, and it is where the run stands now. Before the job exists the
  // page is doing the work and says so; after it, the job is.
  it.for([
    ['uploading', false, false, 'workshop.v2.run.uploading'],
    ['submitting', false, false, 'workshop.v2.run.sending'],
    ['reconnecting', false, false, 'workshop.v2.run.reconnecting'],
    ['tracking', true, false, 'workshop.v2.run.queued'],
    ['tracking', false, false, 'workshop.v2.run.generating'],
    ['idle', false, false, undefined],
    ['finished', false, false, undefined]
  ] as const)(
    'says where %s stands',
    ([phase, queued, coldStart, expected]) => {
      expect(runSaying(phase, queued, coldStart)).toBe(expected)
    }
  )

  // A workflow with a server of its own is not waiting in a queue, and a
  // reader told it is waiting for a server reads a slow first run correctly.
  it('waits on the server rather than on a queue when it has its own', () => {
    expect(runSaying('tracking', true, true)).toBe('workshop.v2.run.waking')
    expect(runSaying('tracking', false, true)).toBe(
      'workshop.v2.run.generating'
    )
  })
})

describe('runHint', () => {
  it('explains the long wait only while the server is being woken', () => {
    expect(runHint('tracking', true, true)).toBe('workshop.v2.run.wakingHint')
    expect(runHint('tracking', false, true)).toBeUndefined()
    expect(runHint('tracking', true, false)).toBeUndefined()
    expect(runHint('uploading', true, true)).toBeUndefined()
  })
})
