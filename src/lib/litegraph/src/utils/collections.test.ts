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

    nodeA = new TestNode()
    nodeA.pos = [50, 50]
    graph.add(nodeA)

    nodeB = new TestNode()
    nodeB.pos = [100, 100]
    graph.add(nodeB)

    group.recomputeInsideNodes()

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
