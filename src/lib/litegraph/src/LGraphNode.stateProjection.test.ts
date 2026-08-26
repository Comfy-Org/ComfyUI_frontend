import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test } from 'vitest'

import { LGraph, LGraphNode } from './litegraph'
import { TitleMode } from './types/globalEnums'
import { useNodeDataStore } from '@/stores/nodeDataStore'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})

describe('execution order projection', () => {
  test('writes attached node order to the canonical store', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)

    node.order = 42

    expect(node.order).toBe(42)
    expect(node.serialize().order).toBe(42)
  })
})

describe('titleMode in node state', () => {
  test('carries a NO_TITLE class into the store-held shell state', () => {
    class TitlelessNode extends LGraphNode {
      static title_mode = TitleMode.NO_TITLE
    }
    const graph = new LGraph()
    const node = new TitlelessNode('titleless')
    graph.add(node)

    expect(
      useNodeDataStore().getGraphNodesFor(graph.id, graph.id)[0]?.titleMode
    ).toBe(TitleMode.NO_TITLE)
  })
})
