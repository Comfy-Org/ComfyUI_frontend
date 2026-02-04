import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, watch } from 'vue'

import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

describe('Node Reactivity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function createTestGraph() {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('input', 'INT')
    node.addWidget('number', 'testnum', 2, () => undefined, {})
    graph.add(node)

    const { vueNodeData } = useGraphNodeManager(graph)

    return { node, graph, vueNodeData }
  }

  it('widget values are reactive through the store', async () => {
    const { node } = createTestGraph()
    const store = useWidgetValueStore()
    const widget = node.widgets![0]

    // Verify widget has setNodeId (is a BaseWidget)
    expect(typeof (widget as any).setNodeId).toBe('function')

    // Verify internal value is set correctly
    expect((widget as any)._internalValue).toBe(2)
    expect((widget as any)._nodeId).toBe(node.id)

    // Initial value should be in store after setNodeId was called
    expect(store.getWidget(node.id, 'testnum')?.value).toBe(2)

    const onValueChange = vi.fn()
    const widgetValue = computed(
      () => store.getWidget(node.id, 'testnum')?.value
    )
    watch(widgetValue, onValueChange)

    widget.value = 42
    await nextTick()

    expect(widgetValue.value).toBe(42)
    expect(onValueChange).toHaveBeenCalledTimes(1)
  })

  it('widget values remain reactive after a connection is made', async () => {
    const { node, graph } = createTestGraph()
    const store = useWidgetValueStore()
    const onValueChange = vi.fn()

    graph.trigger('node:slot-links:changed', {
      nodeId: String(node.id),
      slotType: NodeSlotType.INPUT
    })
    await nextTick()

    const widgetValue = computed(
      () => store.getWidget(node.id, 'testnum')?.value
    )
    watch(widgetValue, onValueChange)

    node.widgets![0].value = 99
    await nextTick()

    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(widgetValue.value).toBe(99)
  })
})
