import { describe, expect, it } from 'vitest'

import type { JobState } from '@/types/queue'

import { buildJobDisplay, iconForJobState } from './queueDisplay'
import type { BuildJobDisplayCtx } from './queueDisplay'

describe('iconForJobState', () => {
  it.each([
    ['pending', 'icon-[lucide--loader-circle]'],
    ['initialization', 'icon-[lucide--server-crash]'],
    ['running', 'icon-[lucide--zap]'],
    ['completed', 'icon-[lucide--check-check]'],
    ['failed', 'icon-[lucide--alert-circle]']
  ] as [JobState, string][])(
    'returns correct icon for %s state',
    (state, expected) => {
      expect(iconForJobState(state)).toBe(expected)
    }
  )

  it('returns default icon for unknown state', () => {
    expect(iconForJobState('unknown' as JobState)).toBe('icon-[lucide--circle]')
  })
})

describe('buildJobDisplay', () => {
  const mockT = (key: string, vars?: Record<string, unknown>) => {
    if (vars) return `${key}:${JSON.stringify(vars)}`
    return key
  }

  const mockFormatClock = (ts: number) => `clock:${ts}`

  function makeTask(overrides: Record<string, unknown> = {}) {
    return {
      jobId: 'abc-123',
      createTime: 1000,
      executionTimeInSeconds: 2.5,
      executionTime: 2500,
      previewOutput: null,
      job: { priority: 1 },
      ...overrides
    } as never
  }

  function makeCtx(
    overrides: Partial<BuildJobDisplayCtx> = {}
  ): BuildJobDisplayCtx {
    return {
      t: mockT,
      locale: 'en',
      formatClockTimeFn: mockFormatClock,
      isActive: false,
      ...overrides
    }
  }

  it('returns queued display for pending state', () => {
    const result = buildJobDisplay(makeTask(), 'pending', makeCtx())
    expect(result.primary).toBe('queue.inQueue')
    expect(result.showClear).toBe(true)
  })

  it('returns added hint for pending with showAddedHint', () => {
    const result = buildJobDisplay(
      makeTask(),
      'pending',
      makeCtx({ showAddedHint: true })
    )
    expect(result.primary).toBe('queue.jobAddedToQueue')
    expect(result.iconName).toBe('icon-[lucide--check]')
  })

  it('returns initialization display', () => {
    const result = buildJobDisplay(makeTask(), 'initialization', makeCtx())
    expect(result.primary).toBe('queue.initializingAlmostReady')
  })

  it('returns running display with progress when active', () => {
    const result = buildJobDisplay(
      makeTask(),
      'running',
      makeCtx({
        isActive: true,
        totalPercent: 50,
        currentNodePercent: 75,
        currentNodeName: 'KSampler'
      })
    )
    expect(result.primary).toContain('sideToolbar.queueProgressOverlay.total')
    expect(result.secondary).toContain('KSampler')
  })

  it('returns simple running display when not active', () => {
    const result = buildJobDisplay(makeTask(), 'running', makeCtx())
    expect(result.primary).toBe('g.running')
  })

  it('returns completed display with execution time', () => {
    const result = buildJobDisplay(makeTask(), 'completed', makeCtx())
    expect(result.secondary).toBe('2.50s')
    expect(result.showClear).toBe(false)
  })

  it('returns failed display', () => {
    const result = buildJobDisplay(makeTask(), 'failed', makeCtx())
    expect(result.primary).toBe('g.failed')
    expect(result.showClear).toBe(true)
  })
})
