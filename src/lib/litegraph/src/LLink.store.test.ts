import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'

describe('LLink ↔ linkStore integration', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('connect registers, disconnect removes', () => {
    const graph = new LGraph()
    const a = new LGraphNode('A')
    const b = new LGraphNode('B')
    a.addOutput('out', 'INT')
    b.addInput('in', 'INT')
    graph.add(a)
    graph.add(b)

    const link = a.connect(0, b, 0)!
    const store = useLinkStore()
    expect(store.isInputSlotConnected(graph.rootGraph.id, b.id, 0)).toBe(true)

    graph.removeLink(link.id)
    expect(store.isInputSlotConnected(graph.rootGraph.id, b.id, 0)).toBe(false)
  })

  it('moving a link via target_slot reindexes the store', () => {
    const graph = new LGraph()
    const a = new LGraphNode('A')
    const b = new LGraphNode('B')
    a.addOutput('out', 'INT')
    b.addInput('in0', 'INT')
    b.addInput('in1', 'INT')
    graph.add(a)
    graph.add(b)

    const link = a.connect(0, b, 0)!
    const store = useLinkStore()
    const nodeId = b.id
    expect(store.isInputSlotConnected(graph.rootGraph.id, nodeId, 0)).toBe(true)

    link.target_slot = 1

    expect(store.isInputSlotConnected(graph.rootGraph.id, nodeId, 0)).toBe(
      false
    )
    expect(store.isInputSlotConnected(graph.rootGraph.id, nodeId, 1)).toBe(true)
  })
})
