import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GraphReplayQueue } from './graphReplayQueue'
import type { GraphReplayState, GraphReplayStep } from './graphReplayQueue'

describe('GraphReplayQueue', () => {
  let steps: GraphReplayStep[]
  let states: GraphReplayState[]

  const make = (opts: { nodeExists?: (id: string) => boolean } = {}) =>
    new GraphReplayQueue({
      stepMs: 120,
      maxTotalMs: 2000,
      nodeExists: opts.nodeExists,
      onStep: (s) => steps.push(s),
      onStateChange: (s) => states.push(s)
    })

  beforeEach(() => {
    vi.useFakeTimers()
    steps = []
    states = []
  })

  it('starts idle and stays idle for an empty batch', () => {
    const q = make()
    expect(q.currentState).toBe('idle')
    q.enqueueBatch({ nodeIds: [], linkIds: [] })
    expect(q.currentState).toBe('idle')
    expect(states).toEqual([])
  })

  it('reveals nodes before links, one per step, and ends complete', () => {
    const q = make()
    q.enqueueBatch({ nodeIds: ['n1', 'n2'], linkIds: ['l1'] })
    expect(q.currentState).toBe('loading')
    expect(q.pendingNodeIds).toEqual(new Set(['n1', 'n2']))

    vi.advanceTimersByTime(120)
    expect(steps.map((s) => s.nodeIds)).toEqual([['n1']])
    expect(q.currentState).toBe('partial')

    vi.advanceTimersByTime(120)
    expect(steps[1]).toMatchObject({ nodeIds: ['n2'], linkIds: [] })

    vi.advanceTimersByTime(120)
    expect(steps[2]).toMatchObject({ nodeIds: [], linkIds: ['l1'] })
    expect(q.currentState).toBe('complete')
    expect(states).toEqual(['loading', 'partial', 'complete'])
  })

  it('coalesces ids so a large batch finishes within maxTotalMs', () => {
    const q = make()
    const nodeIds = Array.from({ length: 100 }, (_, i) => `n${i}`)
    q.enqueueBatch({ nodeIds, linkIds: [] })
    vi.advanceTimersByTime(2000)
    expect(q.currentState).toBe('complete')
    expect(steps.flatMap((s) => s.nodeIds)).toEqual(nodeIds)
    expect(steps.length).toBeLessThanOrEqual(Math.floor(2000 / 120))
  })

  it('fastForward reveals everything pending in one step', () => {
    const q = make()
    q.enqueueBatch({ nodeIds: ['n1', 'n2', 'n3'], linkIds: ['l1'] })
    vi.advanceTimersByTime(120)
    q.fastForward()
    expect(steps[1]).toMatchObject({ nodeIds: ['n2', 'n3'], linkIds: ['l1'] })
    expect(q.currentState).toBe('complete')
    vi.advanceTimersByTime(1000)
    expect(steps.length).toBe(2)
  })

  it('a new batch fast-forwards the in-flight one first', () => {
    const q = make()
    q.enqueueBatch({ nodeIds: ['a1', 'a2'], linkIds: [] })
    vi.advanceTimersByTime(120)
    q.enqueueBatch({ nodeIds: ['b1'], linkIds: [] })
    expect(steps[1]).toMatchObject({ nodeIds: ['a2'] })
    expect(q.currentState).toBe('loading')
    expect(q.pendingNodeIds).toEqual(new Set(['b1']))
    vi.advanceTimersByTime(120)
    expect(q.currentState).toBe('complete')
  })

  it('dedupes ids within a batch', () => {
    const q = make()
    q.enqueueBatch({ nodeIds: ['n1', 'n1'], linkIds: ['l1', 'l1'] })
    q.fastForward()
    expect(steps[0]).toMatchObject({ nodeIds: ['n1'], linkIds: ['l1'] })
  })

  it('marks failed and force-reveals the rest when a node is missing', () => {
    const q = make({ nodeExists: (id) => id !== 'gone' })
    q.enqueueBatch({ nodeIds: ['gone', 'n2', 'n3'], linkIds: ['l1'] })
    vi.advanceTimersByTime(120)
    expect(steps[0].missingNodeIds).toEqual(['gone'])
    expect(steps[1]).toMatchObject({ nodeIds: ['n2', 'n3'], linkIds: ['l1'] })
    expect(q.currentState).toBe('failed')
    expect(q.pendingNodeIds.size).toBe(0)
    vi.advanceTimersByTime(1000)
    expect(steps.length).toBe(2)
  })

  it('clear drops pending work without revealing and returns to idle', () => {
    const q = make()
    q.enqueueBatch({ nodeIds: ['n1'], linkIds: [] })
    q.clear()
    expect(q.currentState).toBe('idle')
    vi.advanceTimersByTime(1000)
    expect(steps).toEqual([])
  })

  it('clamps stepMs into [120, 250]', () => {
    const fast = new GraphReplayQueue({
      stepMs: 1,
      onStep: (s) => steps.push(s)
    })
    fast.enqueueBatch({ nodeIds: ['n1'], linkIds: [] })
    vi.advanceTimersByTime(119)
    expect(steps).toEqual([])
    vi.advanceTimersByTime(1)
    expect(steps.length).toBe(1)
  })
})
