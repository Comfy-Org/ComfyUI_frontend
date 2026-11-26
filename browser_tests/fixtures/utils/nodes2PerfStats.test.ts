import { describe, expect, it } from 'vitest'

import { gestureFrameStats } from '@e2e/fixtures/utils/nodes2PerfStats'

describe('gesture frame evidence', () => {
  it('accepts fast measured frames without filtering diagnostic costs', () => {
    const stats = gestureFrameStats({
      steps: 1,
      frames: [1],
      intervals: [16.67]
    })

    expect(stats.mainThreadP95).toBe(1)
    expect(stats.p95).toBe(16.67)
  })

  it.for([
    { frames: [], intervals: [16] },
    { frames: [1], intervals: [] }
  ])('rejects missing evidence: %o', (sample) => {
    expect(() => gestureFrameStats({ steps: 1, ...sample })).toThrow(
      'the gesture produced no measurable frames'
    )
  })

  it.for([33.04, 40, 58])(
    'preserves the measured duration %s ms for threshold comparisons',
    (duration) => {
      const stats = gestureFrameStats({
        steps: 1,
        frames: [3],
        intervals: [duration]
      })

      expect(stats.p95).toBe(duration)
      expect(stats.max).toBe(duration)
    }
  )
})
