import { describe, expect, it } from 'vitest'

import { allowance, pruneRuns } from './reshoot-limits'

const HOUR = 60 * 60 * 1000
const limit = { runs: 3, windowMs: HOUR }
const now = 10 * HOUR

describe('allowance', () => {
  it.for([
    { runs: [], left: 3 },
    { runs: [now - 1000], left: 2 },
    { runs: [now - HOUR - 1, now - 2 * HOUR], left: 3 },
    { runs: [now - 10, now - 20], left: 1 }
  ])('leaves $left of 3 runs', ({ runs, left }) => {
    expect(allowance(runs, limit, now)).toEqual({ left, runs: 3 })
  })

  it('says when the next run frees up once none are left', () => {
    const runs = [now - 40 * 60 * 1000, now - 10_000, now - 5_000]
    expect(allowance(runs, limit, now)).toEqual({
      left: 0,
      runs: 3,
      nextAt: now + 20 * 60 * 1000
    })
  })

  it('drops runs that fell out of the window', () => {
    expect(pruneRuns([now - HOUR - 1, now - 1], limit, now)).toEqual([now - 1])
  })
})
