import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

/**
 * `connect` must open and close exactly one undo transaction.
 *
 * ChangeTracker.afterChange is `if (!--this.changeCount) capture()`, with no
 * floor. `afterChange` used to run unconditionally at the end of connectSlots
 * while `beforeChange` ran only when an occupied input had to be cleared
 * first — so wiring anything to an EMPTY input, the ordinary case, drove the
 * count to -1. From there no pair could return it to zero: undo stopped
 * grouping for the rest of the session, and a batch started producing MORE
 * steps than it should, because a mid-batch count of zero no longer suppressed
 * the per-mutation captures.
 */
describe('connect opens and closes one change transaction', () => {
  let graph: LGraph
  let events: string[]

  function wire(hasExistingLink: boolean) {
    const source = new LGraphNode('S', 'S')
    const target = new LGraphNode('T', 'T')
    source.addOutput('out', 'X')
    target.addInput('in', 'X')
    graph.add(source)
    graph.add(target)
    if (hasExistingLink) {
      const other = new LGraphNode('O', 'O')
      other.addOutput('out', 'X')
      graph.add(other)
      other.connect(0, target, 0)
    }
    events.length = 0
    source.connect(0, target, 0)
  }

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    events = []
    graph.onBeforeChange = () => events.push('before')
    graph.onAfterChange = () => events.push('after')
  })

  it('brackets a connection to an empty input', () => {
    wire(false)
    expect(events).toEqual(['before', 'after'])
  })

  it('brackets a connection that displaces an existing link', () => {
    wire(true)
    expect(events).toEqual(['before', 'after'])
  })

  it('leaves the depth at zero, so later batches still group', () => {
    wire(false)
    wire(false)
    const depth = events.reduce((d, e) => d + (e === 'before' ? 1 : -1), 0)
    expect(depth).toBe(0)
  })
})
