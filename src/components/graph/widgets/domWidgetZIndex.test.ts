import { fromPartial } from '@total-typescript/shoehorn'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createDomWidgetNodeOrder, getDomWidgetZIndex } from './domWidgetZIndex'

beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

describe('getDomWidgetZIndex', () => {
  it('follows graph node ordering when node.order is stale', () => {
    const graph = new LGraph()
    const first = new LGraphNode('first')
    const second = new LGraphNode('second')
    graph.add(first)
    graph.add(second)

    first.order = 0
    second.order = 1

    const nodes = fromPartial<{ _nodes: LGraphNode[] }>(graph)._nodes
    nodes.splice(nodes.indexOf(first), 1)
    nodes.push(first)

    expect(first.order).toBe(0)
    expect(second.order).toBe(1)

    expect(getDomWidgetZIndex(first, graph)).toBe(1)
    expect(getDomWidgetZIndex(second, graph)).toBe(0)
  })

  it('falls back to node.order when node is not in current graph', () => {
    const graph = new LGraph()
    const node = new LGraphNode('orphan')
    node.order = 7

    expect(getDomWidgetZIndex(node, graph)).toBe(7)
    expect(getDomWidgetZIndex(node, undefined)).toBe(7)
  })

  it('uses a frame-local order map without rescanning the graph', () => {
    const graph = new LGraph()
    const first = new LGraphNode('first')
    const second = new LGraphNode('second')
    graph.add(first)
    graph.add(second)

    const nodeOrder = createDomWidgetNodeOrder(graph.nodes)
    const indexOf = vi.spyOn(graph.nodes, 'indexOf')

    expect(getDomWidgetZIndex(first, graph, nodeOrder)).toBe(0)
    expect(getDomWidgetZIndex(second, graph, nodeOrder)).toBe(1)
    expect(indexOf).not.toHaveBeenCalled()
  })

  it('preserves first-match identity semantics for duplicate node references', () => {
    const first = new LGraphNode('first')
    const second = new LGraphNode('second')
    const nodeOrder = createDomWidgetNodeOrder([first, second, first])

    expect(nodeOrder.get(first)).toBe(0)
    expect(nodeOrder.get(second)).toBe(1)
  })

  it('orders reminted nodes by identity when their IDs match', () => {
    const original = new LGraphNode('original')
    const reminted = new LGraphNode('reminted')
    original.id = reminted.id

    const nodeOrder = createDomWidgetNodeOrder([original, reminted])

    expect(nodeOrder.get(original)).toBe(0)
    expect(nodeOrder.get(reminted)).toBe(1)
  })

  it('indexes a large graph in one pass', () => {
    const nodes = Array.from(
      { length: 1_000 },
      (_, index) => new LGraphNode(`node-${index}`)
    )
    const forEach = vi.spyOn(nodes, 'forEach')

    const nodeOrder = createDomWidgetNodeOrder(nodes)

    expect(forEach).toHaveBeenCalledOnce()
    expect(nodeOrder.size).toBe(nodes.length)
    expect(nodeOrder.get(nodes[999])).toBe(999)
  })

  it('falls back to node.order for detached nodes with an order map', () => {
    const graph = new LGraph()
    const attached = new LGraphNode('attached')
    const detached = new LGraphNode('detached')
    graph.add(attached)
    detached.order = 7

    const nodeOrder = createDomWidgetNodeOrder(graph.nodes)

    expect(getDomWidgetZIndex(detached, graph, nodeOrder)).toBe(7)
  })
})
