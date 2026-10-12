import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Positionable } from '@/lib/litegraph/src/interfaces'
import { getDraggedItems } from '@/lib/litegraph/src/utils/collections'

class TestNode extends LGraphNode {
  constructor() {
    super('test')
  }
}

describe('getDraggedItems', () => {
  let graph: LGraph
  let group: LGraphGroup
  let nodeA: TestNode
  let nodeB: TestNode
  let selected: Set<Positionable>

  beforeEach(() => {
    graph = new LGraph()

    group = new LGraphGroup('TestGroup')
    group._bounding.set([0, 0, 500, 500])
    graph.add(group)

    // Give the nodes an explicit size so their bounding-box centres are
    // deterministically inside the group's bounds — recomputeInsideNodes()
    // selects by centre point, not by pos alone.
    nodeA = new TestNode()
    nodeA.pos = [50, 50]
    nodeA.size = [100, 100]
    graph.add(nodeA)

    nodeB = new TestNode()
    nodeB.pos = [100, 100]
    nodeB.size = [100, 100]
    graph.add(nodeB)

    group.recomputeInsideNodes()

    // Guard: fail loudly if the fixture did not actually nest the nodes.
    // Without this, the modifier tests below (which assert the nodes are
    // *absent*) would pass vacuously if the group's child set were empty.
    expect(group.children.has(nodeA)).toBe(true)
    expect(group.children.has(nodeB)).toBe(true)

    selected = new Set<Positionable>([group])
  })

  it('drags the group with its contents when no modifier is held', () => {
    const items = getDraggedItems(selected, { ctrlKey: false, metaKey: false })

    expect(items.has(group)).toBe(true)
    expect(items.has(nodeA)).toBe(true)
    expect(items.has(nodeB)).toBe(true)
  })

  it('drags only the group when Ctrl is held (Windows/Linux)', () => {
    const items = getDraggedItems(selected, { ctrlKey: true, metaKey: false })

    expect(items.has(group)).toBe(true)
    expect(items.has(nodeA)).toBe(false)
    expect(items.has(nodeB)).toBe(false)
  })

  it('drags only the group when Meta/Cmd is held (macOS)', () => {
    const items = getDraggedItems(selected, { ctrlKey: false, metaKey: true })

    expect(items.has(group)).toBe(true)
    expect(items.has(nodeA)).toBe(false)
    expect(items.has(nodeB)).toBe(false)
  })
})
