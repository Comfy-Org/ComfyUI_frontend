import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

function domWidget(id: string) {
  return {
    id,
    element: document.createElement('video'),
    node: {
      id: 'node-1',
      title: 'n',
      pos: [0, 0],
      size: [1, 1]
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

describe('graph clear releases DOM widgets', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('drops registered DOM widgets when the root graph is cleared', () => {
    const store = useDomWidgetStore()
    const graph = new LGraph()
    store.registerWidget(domWidget('widget-1'))
    store.registerWidget(domWidget('widget-2'))
    expect(store.widgetStates.size).toBe(2)

    graph.clear()

    expect(store.widgetStates.size).toBe(0)
  })
})
