import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

function domWidgetOn(graph: LGraph, id: string) {
  return {
    id,
    element: document.createElement('video'),
    node: {
      id: `node-${id}`,
      title: 'n',
      pos: [0, 0],
      size: [1, 1],
      graph
    } as Partial<LGraphNode> as LGraphNode,
    name: 'media',
    type: 'text' as const,
    value: '',
    options: {},
    y: 0,
    margin: 0,
    isVisible: () => true,
    containerNode: undefined
  }
}

const registered = (store: ReturnType<typeof useDomWidgetStore>) =>
  [...store.widgetStates.keys()].sort()

describe('graph clear releases DOM widgets', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('drops the cleared graph its own DOM widgets', () => {
    const store = useDomWidgetStore()
    const graph = new LGraph()
    store.registerWidget(domWidgetOn(graph, 'a1'))
    store.registerWidget(domWidgetOn(graph, 'a2'))

    graph.clear()

    expect(registered(store)).toEqual([])
  })

  it('leaves another live root graph its DOM widgets', () => {
    const store = useDomWidgetStore()
    const cleared = new LGraph()
    const untouched = new LGraph()
    store.registerWidget(domWidgetOn(cleared, 'a1'))
    store.registerWidget(domWidgetOn(untouched, 'b1'))
    store.registerWidget(domWidgetOn(untouched, 'b2'))

    cleared.clear()

    expect(registered(store)).toEqual(['b1', 'b2'])
  })
})
