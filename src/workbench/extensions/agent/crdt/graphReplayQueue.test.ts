import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GraphReplayQueue } from './graphReplayQueue'
import type {
  GraphReplayLink,
  GraphReplayState,
  GraphReplayStep
} from './graphReplayQueue'

const link = (
  id: string,
  originId: string,
  targetId: string
): GraphReplayLink => ({ id, originId, targetId })

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
    q.enqueueBatch({ nodeIds: [], links: [] })
    expect(q.currentState).toBe('idle')
    expect(states).toEqual([])
  })

  it('reveals a link the instant both its endpoints have been revealed', () => {
    const q = make()
    q.enqueueBatch({
      nodeIds: ['n1', 'n2', 'n3'],
      links: [link('l1', 'n1', 'n3')]
    })
    expect(q.currentState).toBe('loading')
    expect(q.pendingNodeIds).toEqual(new Set(['n1', 'n2', 'n3']))

    vi.advanceTimersByTime(120)
    expect(steps[0]).toMatchObject({ nodeIds: ['n1'], linkIds: [] })
    expect(q.currentState).toBe('partial')

    vi.advanceTimersByTime(120)
    // n2 reveals; l1's target (n3) is still pending, so l1 stays held.
    expect(steps[1]).toMatchObject({ nodeIds: ['n2'], linkIds: [] })
    expect(q.pendingLinkIds).toEqual(new Set(['l1']))

    vi.advanceTimersByTime(120)
    // n3 reveals - both of l1's endpoints are now clear, so it rides out
    // in the SAME step rather than waiting for a link-only pass after.
    expect(steps[2]).toMatchObject({ nodeIds: ['n3'], linkIds: ['l1'] })
    expect(q.currentState).toBe('complete')
    expect(states).toEqual(['loading', 'partial', 'complete'])
  })

  it('coalesces ids so a large batch finishes within maxTotalMs', () => {
    const q = make()
    const nodeIds = Array.from({ length: 100 }, (_, i) => `n${i}`)
    q.enqueueBatch({ nodeIds, links: [] })
    vi.advanceTimersByTime(2000)
    expect(q.currentState).toBe('complete')
    expect(steps.flatMap((s) => s.nodeIds)).toEqual(nodeIds)
    expect(steps.length).toBeLessThanOrEqual(Math.floor(2000 / 120))
  })

  it('fastForward reveals everything pending in one step', () => {
    const q = make()
    q.enqueueBatch({
      nodeIds: ['n1', 'n2', 'n3'],
      links: [link('l1', 'n1', 'n2')]
    })
    vi.advanceTimersByTime(120)
    q.fastForward()
    expect(steps[1]).toMatchObject({ nodeIds: ['n2', 'n3'], linkIds: ['l1'] })
    expect(q.currentState).toBe('complete')
    vi.advanceTimersByTime(1000)
    expect(steps.length).toBe(2)
  })

  it('a new batch fast-forwards the in-flight one first', () => {
    const q = make()
    q.enqueueBatch({ nodeIds: ['a1', 'a2'], links: [] })
    vi.advanceTimersByTime(120)
    q.enqueueBatch({ nodeIds: ['b1'], links: [] })
    expect(steps[1]).toMatchObject({ nodeIds: ['a2'] })
    expect(q.currentState).toBe('loading')
    expect(q.pendingNodeIds).toEqual(new Set(['b1']))
    vi.advanceTimersByTime(120)
    expect(q.currentState).toBe('complete')
  })

  it('dedupes ids within a batch', () => {
    const q = make()
    q.enqueueBatch({
      nodeIds: ['n1', 'n1'],
      links: [link('l1', 'n1', 'n1'), link('l1', 'n1', 'n1')]
    })
    q.fastForward()
    expect(steps[0]).toMatchObject({ nodeIds: ['n1'], linkIds: ['l1'] })
  })

  it('marks failed and force-reveals the rest when a node is missing', () => {
    const q = make({ nodeExists: (id) => id !== 'gone' })
    q.enqueueBatch({
      nodeIds: ['gone', 'n2', 'n3'],
      links: [link('l1', 'n2', 'n3')]
    })
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
    q.enqueueBatch({ nodeIds: ['n1'], links: [] })
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
    fast.enqueueBatch({ nodeIds: ['n1'], links: [] })
    vi.advanceTimersByTime(119)
    expect(steps).toEqual([])
    vi.advanceTimersByTime(1)
    expect(steps.length).toBe(1)
  })

  describe('per-link veiling (mm3-23)', () => {
    it('releases a link immediately when its endpoint was never part of this batch (pre-existing node)', () => {
      const q = make()
      // n_old already exists on the graph; only n1 is new in this batch.
      q.enqueueBatch({
        nodeIds: ['n1'],
        links: [link('l1', 'n_old', 'n1')]
      })
      vi.advanceTimersByTime(120)
      // n1 (the only pending endpoint) reveals in the same step as l1, since
      // n_old was never pending.
      expect(steps[0]).toMatchObject({ nodeIds: ['n1'], linkIds: ['l1'] })
      expect(q.currentState).toBe('complete')
    })

    it('does not release a link whose target reveals before its origin', () => {
      const q = make()
      q.enqueueBatch({
        nodeIds: ['n1', 'n2'],
        links: [link('l1', 'n2', 'n1')]
      })
      vi.advanceTimersByTime(120) // reveals n1; l1's origin (n2) still pending
      expect(steps[0]).toMatchObject({ nodeIds: ['n1'], linkIds: [] })
      expect(q.pendingLinkIds).toEqual(new Set(['l1']))
      vi.advanceTimersByTime(120) // reveals n2 - both endpoints clear now
      expect(steps[1]).toMatchObject({ nodeIds: ['n2'], linkIds: ['l1'] })
    })

    it('fastForward releases links held back by unrevealed endpoints too', () => {
      const q = make()
      q.enqueueBatch({
        nodeIds: ['n1', 'n2'],
        links: [link('l1', 'n1', 'n2')]
      })
      q.fastForward()
      expect(steps[0]).toMatchObject({
        nodeIds: ['n1', 'n2'],
        linkIds: ['l1']
      })
      expect(q.currentState).toBe('complete')
    })

    it('a failed force-reveal still emits held-back links in the failure step', () => {
      const q = make({ nodeExists: (id) => id !== 'gone' })
      q.enqueueBatch({
        nodeIds: ['gone', 'n2'],
        links: [link('l1', 'gone', 'n2')]
      })
      vi.advanceTimersByTime(120)
      expect(steps[0].missingNodeIds).toEqual(['gone'])
      expect(steps[1]).toMatchObject({ nodeIds: ['n2'], linkIds: ['l1'] })
      expect(q.currentState).toBe('failed')
    })
  })
})
