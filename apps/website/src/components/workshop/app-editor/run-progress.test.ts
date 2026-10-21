import { describe, expect, it } from 'vitest'

import { clockProgress } from './run-progress'

describe('clockProgress', () => {
  it.for([
    { elapsed: 0, queue: 400, expected: { kind: 'queued' } },
    { elapsed: 399, queue: 400, expected: { kind: 'queued' } },
    { elapsed: 400, queue: 400, expected: { kind: 'running', percent: 0 } },
    { elapsed: 1400, queue: 400, expected: { kind: 'running', percent: 50 } },
    { elapsed: 1000, queue: 0, expected: { kind: 'running', percent: 41 } },
    { elapsed: 9000, queue: 400, expected: { kind: 'running', percent: 99 } }
  ])(
    'reads $elapsed ms of a 2400 ms run with a $queue ms queue',
    ({ elapsed, queue, expected }) => {
      expect(clockProgress(elapsed, 2400, queue)).toEqual(expected)
    }
  )
})
