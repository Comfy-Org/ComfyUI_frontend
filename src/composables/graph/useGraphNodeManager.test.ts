import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, watch } from 'vue'

import {
  getSharedWidgetEnhancements,
  useGraphNodeManager
} from '@/composables/graph/useGraphNodeManager'
import { BaseWidget, LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
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

    // Verify widget is a BaseWidget with correct value and node assignment
    expect(widget).toBeInstanceOf(BaseWidget)
    expect(widget.value).toBe(2)
    expect((widget as BaseWidget).node.id).toBe(node.id)

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

describe('getSharedWidgetEnhancements', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('returns nodeType when sourceNodeId is provided for a subgraph node', () => {
    const subgraph = new LGraph()
    const interiorNode = new LGraphNode('KSampler', 'KSampler')
    subgraph.add(interiorNode)

    const subgraphNode = new LGraphNode('graph/subgraph')
    ;(subgraphNode as unknown as { subgraph: LGraph }).subgraph = subgraph
    vi.spyOn(subgraphNode, 'isSubgraphNode').mockReturnValue(true)

    const widget = { name: 'seed', type: 'number', value: 0 } as IBaseWidget
    const result = getSharedWidgetEnhancements(
      subgraphNode,
      widget,
      String(interiorNode.id)
    )

    expect(result.nodeType).toBe('KSampler')
  })

  it('returns undefined nodeType when sourceNodeId is omitted', () => {
    const subgraphNode = new LGraphNode('graph/subgraph')
    vi.spyOn(subgraphNode, 'isSubgraphNode').mockReturnValue(true)

    const widget = { name: 'seed', type: 'number', value: 0 } as IBaseWidget
    const result = getSharedWidgetEnhancements(subgraphNode, widget)

    expect(result.nodeType).toBeUndefined()
  })
})
