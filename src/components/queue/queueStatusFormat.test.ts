import { describe, expect, it } from 'vitest'

import { executedNodesPercent, formatElapsed } from './queueStatusFormat'

describe('executedNodesPercent', () => {
  it('counts executed nodes of one job', () => {
    expect(executedNodesPercent({ a: true, b: false, c: true, d: false })).toBe(
      50
    )
  })

  it('falls back when the job has no node map yet', () => {
    expect(executedNodesPercent(undefined, 12.4)).toBe(12)
    expect(executedNodesPercent({}, 0)).toBe(0)
  })
})

describe('formatElapsed', () => {
  it('formats minutes and padded seconds', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(84_000)).toBe('1:24')
    expect(formatElapsed(605_999)).toBe('10:05')
  })

  it('never shows negative time', () => {
    expect(formatElapsed(-500)).toBe('0:00')
  })
})
