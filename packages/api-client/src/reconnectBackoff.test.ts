import { describe, expect, it, vi } from 'vitest'

import { reconnectDelayMs } from './reconnectBackoff'

const delayBounds = [
  { attempt: 0, min: 300, max: 300 },
  { attempt: 1, min: 600, max: 749 },
  { attempt: 2, min: 1200, max: 1499 },
  { attempt: 6, min: 19_200, max: 23_999 },
  { attempt: 7, min: 30_000, max: 37_499 },
  { attempt: 1000, min: 30_000, max: 37_499 }
]

describe(reconnectDelayMs, () => {
  it.for(delayBounds)(
    'attempt $attempt waits at least $min ms',
    ({ attempt, min }) => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      expect(reconnectDelayMs(attempt)).toBe(min)
    }
  )

  it.for(delayBounds)(
    'attempt $attempt waits at most $max ms',
    ({ attempt, max }) => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9999)
      expect(reconnectDelayMs(attempt)).toBe(max)
    }
  )
})
