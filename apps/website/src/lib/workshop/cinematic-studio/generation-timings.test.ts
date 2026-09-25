import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readGenerationTimings,
  recordGenerationTiming,
  startGenerationTiming
} from './generation-timings'

beforeEach(() => {
  localStorage.clear()
})
describe('local generation timings', () => {
  it('isolates accounts, workspaces and models, deduplicates and stores only numeric observations plus identifiers', () => {
    recordGenerationTiming('user/workspace-a', 'model-a', {
      id: 'one',
      elapsedMs: 500
    })
    recordGenerationTiming('user/workspace-a', 'model-a', {
      id: 'one',
      elapsedMs: 900
    })
    recordGenerationTiming('user/workspace-b', 'model-a', {
      id: 'two',
      elapsedMs: 1000
    })
    expect(readGenerationTimings('user/workspace-a', 'model-a')).toMatchObject([
      { id: 'one', elapsedMs: 500 }
    ])
    expect(readGenerationTimings('user/workspace-a', 'model-b')).toEqual([])
    expect(readGenerationTimings('other/workspace-a', 'model-a')).toEqual([])
    expect(readGenerationTimings('user/workspace-b', 'model-a')).toMatchObject([
      { elapsedMs: 1000 }
    ])
    const persisted = JSON.parse(localStorage.getItem(localStorage.key(0)!)!)
    expect(Object.keys(persisted.samples[0]).sort()).toEqual([
      'completedAt',
      'elapsedMs',
      'id',
      'modelSlug'
    ])
  })
  it('bounds history to twenty samples per model, sixty models and thirty days', () => {
    const now = Date.now()
    for (let n = 0; n < 25; n++)
      recordGenerationTiming('scope', 'model', {
        id: `sample-${n}`,
        elapsedMs: 500,
        completedAt: now - n
      })
    expect(readGenerationTimings('scope', 'model')).toHaveLength(20)
    recordGenerationTiming('scope', 'model', {
      id: 'expired',
      elapsedMs: 500,
      completedAt: now - 31 * 86400000
    })
    expect(
      readGenerationTimings('scope', 'model').some(
        (sample) => sample.id === 'expired'
      )
    ).toBe(false)
    for (let n = 0; n < 65; n++)
      recordGenerationTiming('scope', `model-${n}`, {
        id: `other-${n}`,
        elapsedMs: 500
      })
    const persisted = JSON.parse(
      localStorage.getItem(localStorage.key(0)!)!
    ) as { samples: { modelSlug: string }[] }
    expect(
      new Set(persisted.samples.map((sample) => sample.modelSlug)).size
    ).toBe(60)
  })
  it('rejects demo, unreasonable timing, future observations and corrupt storage without throwing', () => {
    for (const elapsedMs of [0, -1, NaN, Infinity, 7200001])
      recordGenerationTiming('scope', 'model', { id: 'invalid', elapsedMs })
    recordGenerationTiming('demo', 'model', { id: 'demo', elapsedMs: 100 })
    recordGenerationTiming('scope', 'model', {
      id: 'future',
      elapsedMs: 100,
      completedAt: Date.now() + 60000
    })
    expect(readGenerationTimings('scope', 'model')).toEqual([])
    expect(readGenerationTimings('demo', 'model')).toEqual([])
    localStorage.setItem(localStorage.key(0)!, '{broken')
    expect(readGenerationTimings('scope', 'model')).toEqual([])
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Quota')
    })
    expect(() =>
      recordGenerationTiming('scope', 'model', { id: 'ok', elapsedMs: 100 })
    ).not.toThrow()
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Denied')
    })
    expect(readGenerationTimings('scope', 'model')).toEqual([])
  })
})
describe('foreground generation timer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  })
  it('measures uninterrupted foreground time and cleans up after finishing', () => {
    const timer = startGenerationTiming()
    vi.advanceTimersByTime(2500)
    expect(timer.finish()).toBe(2500)
    expect(timer.finish()).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('discards hidden starts and any hidden interval even after becoming visible', () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')
    const hidden = startGenerationTiming()
    visibility.mockReturnValue('visible')
    vi.advanceTimersByTime(1000)
    expect(hidden.finish()).toBeUndefined()
    const timer = startGenerationTiming()
    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    visibility.mockReturnValue('visible')
    vi.advanceTimersByTime(1000)
    expect(timer.finish()).toBeUndefined()
  })
  it('discards suspension or clock discontinuity and disposed attempts', () => {
    const timer = startGenerationTiming()
    vi.setSystemTime(Date.now() + 6000)
    expect(timer.finish()).toBeUndefined()
    const disposed = startGenerationTiming()
    vi.advanceTimersByTime(1000)
    disposed.dispose()
    expect(disposed.finish()).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })
})
