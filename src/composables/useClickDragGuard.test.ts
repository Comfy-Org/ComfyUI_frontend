import { describe, expect, it } from 'vitest'

import {
  exceedsClickThreshold,
  useClickDragGuard
} from '@/composables/useClickDragGuard'

describe('exceedsClickThreshold', () => {
  it('returns false when distance is within threshold', () => {
    expect(exceedsClickThreshold({ x: 0, y: 0 }, { x: 2, y: 2 }, 5)).toBe(false)
  })

  it('returns true when distance exceeds threshold', () => {
    expect(exceedsClickThreshold({ x: 0, y: 0 }, { x: 3, y: 5 }, 5)).toBe(true)
  })

  it('returns false when distance exactly equals threshold', () => {
    expect(exceedsClickThreshold({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(false)
  })

  it('handles negative deltas', () => {
    expect(exceedsClickThreshold({ x: 10, y: 10 }, { x: 4, y: 2 }, 5)).toBe(
      true
    )
  })
})

describe('useClickDragGuard', () => {
  it('reports no drag when pointer has not moved', () => {
    const guard = useClickDragGuard(5)
    guard.recordStart({ clientX: 100, clientY: 200 })
    expect(guard.wasDragged({ clientX: 100, clientY: 200 })).toBe(false)
  })

  it('reports no drag when movement is within threshold', () => {
    const guard = useClickDragGuard(5)
    guard.recordStart({ clientX: 100, clientY: 200 })
    expect(guard.wasDragged({ clientX: 103, clientY: 204 })).toBe(false)
  })

  it('reports drag when movement exceeds threshold', () => {
    const guard = useClickDragGuard(5)
    guard.recordStart({ clientX: 100, clientY: 200 })
    expect(guard.wasDragged({ clientX: 106, clientY: 200 })).toBe(true)
  })

  it('returns false when no start has been recorded', () => {
    const guard = useClickDragGuard(5)
    expect(guard.wasDragged({ clientX: 100, clientY: 200 })).toBe(false)
  })

  it('returns false after reset', () => {
    const guard = useClickDragGuard(5)
    guard.recordStart({ clientX: 100, clientY: 200 })
    guard.reset()
    expect(guard.wasDragged({ clientX: 200, clientY: 300 })).toBe(false)
  })

  it('respects custom threshold', () => {
    const guard = useClickDragGuard(3)
    guard.recordStart({ clientX: 0, clientY: 0 })
    expect(guard.wasDragged({ clientX: 3, clientY: 0 })).toBe(false)
    expect(guard.wasDragged({ clientX: 4, clientY: 0 })).toBe(true)
  })
})
