import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

describe('LGraphNode.removeWidget store cleanup', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('deletes bound widget state and order entry from WidgetValueStore', () => {
    const graph = new LGraph()
    const node = new LGraphNode('TestNode')
    graph.add(node)
    const widget = node.addWidget('number', 'steps', 20, () => {})

    const store = useWidgetValueStore()
    const id = widgetId(graph.id, node.id, 'steps')
    expect(store.getWidget(id)).toBeDefined()
    expect(store.getNodeWidgetIds(graph.id, node.id)).toContain(id)

    node.removeWidget(widget)

    expect(node.widgets).not.toContain(widget)
    expect(store.getWidget(id)).toBeUndefined()
    expect(store.getNodeWidgetIds(graph.id, node.id)).not.toContain(id)
  })

  it('removes an unbound widget without touching the store', () => {
    const node = new LGraphNode('TestNode')
    const widget = node.addWidget('number', 'steps', 20, () => {})

    node.removeWidget(widget)

    expect(node.widgets).toHaveLength(0)
  })

  it('re-adding a widget after removal registers fresh state honoring the new value', () => {
    const graph = new LGraph()
    const node = new LGraphNode('TestNode')
    graph.add(node)
    const widget = node.addWidget('number', 'steps', 20, () => {})
    widget.value = 42

    node.removeWidget(widget)
    node.addWidget('number', 'steps', 7, () => {})

    const store = useWidgetValueStore()
    const id = widgetId(graph.id, node.id, 'steps')
    expect(store.getWidget(id)?.value).toBe(7)
  })
})
