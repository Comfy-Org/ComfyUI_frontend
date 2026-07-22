import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { computed, toRaw } from 'vue'

import { useNodeDataStore } from '@/stores/nodeDataStore'

import { LGraph, LGraphNode } from './litegraph'

describe('LGraphNode node-data adoption', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('adopts the store proxy and records both ids on add', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Node')
    graph.add(node)

    const store = useNodeDataStore()
    const registered = store.getNode(graph.rootGraph.id, node.id)

    expect(registered).toBeDefined()
    expect(toRaw(node._state)).toBe(toRaw(registered!))
    expect(node._graphId).toBe(graph.rootGraph.id)
    expect(node._state.graphId).toBe(graph.id)
  })

  it('writes shell fields through to the store, reactively', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Node')
    graph.add(node)

    const store = useNodeDataStore()
    const title = computed(
      () => store.getNode(graph.rootGraph.id, node.id)?.title
    )

    node.title = 'Renamed'
    expect(title.value).toBe('Renamed')
    // Reads see the write back through the raw view.
    expect(node.title).toBe('Renamed')

    node.flags.collapsed = true
    expect(store.getNode(graph.rootGraph.id, node.id)?.flags.collapsed).toBe(
      true
    )
  })

  it('vacates its store entry on remove', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Node')
    graph.add(node)
    const store = useNodeDataStore()
    const rootId = graph.rootGraph.id
    const nodeId = node.id

    graph.remove(node)

    expect(store.getNode(rootId, nodeId)).toBeUndefined()
    expect(node._graphId).toBeUndefined()
  })
})
