import { describe, expect, it } from 'vitest'

import {
  executedNodesPercent,
  formatElapsed,
  formatRunningSubtitle
} from './queueStatusFormat'

describe('executedNodesPercent', () => {
  it('counts executed nodes of one job', () => {
    expect(executedNodesPercent({ a: true, b: false, c: true, d: false })).toBe(
      50
    )
  })

  it('counts nodes whose progress state says finished, per job', () => {
    expect(
      executedNodesPercent({ a: false, b: false, c: false, d: false }, 0, {
        a: { state: 'finished' },
        b: { state: 'running' }
      })
    ).toBe(25)
  })

  it('reads progress states when the job has no node map', () => {
    expect(
      executedNodesPercent(undefined, 0, {
        a: { state: 'finished' },
        b: { state: 'pending' }
      })
    ).toBe(50)
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

describe('formatRunningSubtitle', () => {
  it('puts the percent before the elapsed time', () => {
    expect(formatRunningSubtitle(64, 84_000)).toBe('64% · 1:24')
  })

  it('shows only the percent before a start time is known', () => {
    expect(formatRunningSubtitle(64)).toBe('64%')
  })

  it('rounds the percent', () => {
    expect(formatRunningSubtitle(41.6, 0)).toBe('42% · 0:00')
  })
})
