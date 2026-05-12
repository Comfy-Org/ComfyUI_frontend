import { describe, expect, it } from 'vitest'

import type { TaskItemImpl } from '@/stores/queueStore'
import type { JobState } from '@/types/queue'

import type { BuildJobDisplayCtx } from './queueDisplay'
import { buildJobDisplay, iconForJobState } from './queueDisplay'

const noopFormatClockTime = (ts: number) => `t:${ts}`

const baseCtx = (
  overrides: Partial<BuildJobDisplayCtx> = {}
): BuildJobDisplayCtx => ({
  t: (key: string) => key,
  locale: 'en-US',
  formatClockTimeFn: noopFormatClockTime,
  isActive: false,
  ...overrides
})

const taskFor = (overrides: Partial<TaskItemImpl> = {}): TaskItemImpl =>
  ({
    jobId: 'job-1',
    job: { priority: 1 },
    createTime: 0,
    ...overrides
  }) as unknown as TaskItemImpl

describe('iconForJobState', () => {
  it('returns a distinct icon for cancelled vs failed', () => {
    expect(iconForJobState('cancelled')).toBe('icon-[lucide--ban]')
    expect(iconForJobState('failed')).toBe('icon-[lucide--alert-circle]')
    expect(iconForJobState('cancelled')).not.toBe(iconForJobState('failed'))
  })

  it('returns expected icons for in-progress and completed states', () => {
    expect(iconForJobState('running')).toBe('icon-[lucide--zap]')
    expect(iconForJobState('completed')).toBe('icon-[lucide--check-check]')
    expect(iconForJobState('pending')).toBe('icon-[lucide--loader-circle]')
  })
})

describe('buildJobDisplay - cancelled state', () => {
  it('uses g.cancelled labels (not g.failed) for cancelled jobs', () => {
    const seen: string[] = []
    const t = (key: string) => {
      seen.push(key)
      return key
    }

    const display = buildJobDisplay(taskFor(), 'cancelled', baseCtx({ t }))

    expect(display.primary).toBe('g.cancelled')
    expect(display.secondary).toBe('g.cancelled')
    expect(seen).toContain('g.cancelled')
    expect(seen).not.toContain('g.failed')
  })

  it('uses the cancelled icon, not the failed icon', () => {
    const display = buildJobDisplay(taskFor(), 'cancelled', baseCtx())
    expect(display.iconName).toBe(iconForJobState('cancelled'))
    expect(display.iconName).not.toBe(iconForJobState('failed'))
  })

  it('keeps the failed branch using g.failed and the failed icon', () => {
    const display = buildJobDisplay(taskFor(), 'failed', baseCtx())
    expect(display.primary).toBe('g.failed')
    expect(display.iconName).toBe(iconForJobState('failed'))
  })

  it('allows the row to be cleared (showClear true) for cancelled', () => {
    const display = buildJobDisplay(taskFor(), 'cancelled', baseCtx())
    expect(display.showClear).toBe(true)
  })
})

describe('buildJobDisplay - exhaustive state handling', () => {
  const states: JobState[] = [
    'pending',
    'initialization',
    'running',
    'completed',
    'failed',
    'cancelled'
  ]

  it.each(states)('returns a non-empty display for %s state', (state) => {
    const display = buildJobDisplay(taskFor(), state, baseCtx())
    expect(display.iconName).toBeTruthy()
    expect(display.primary).toBeTruthy()
  })
})
