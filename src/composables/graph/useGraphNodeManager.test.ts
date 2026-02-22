import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, watch } from 'vue'

import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import { BaseWidget, LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import { usePromotionStore } from '@/stores/promotionStore'
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
    const { node, graph } = createTestGraph()
    const store = useWidgetValueStore()
    const widget = node.widgets![0]

    // Verify widget is a BaseWidget with correct value and node assignment
    expect(widget).toBeInstanceOf(BaseWidget)
    expect(widget.value).toBe(2)
    expect((widget as BaseWidget).node.id).toBe(node.id)

    // Initial value should be in store after setNodeId was called
    expect(store.getWidget(graph.id, node.id, 'testnum')?.value).toBe(2)

    const state = store.getWidget(graph.id, node.id, 'testnum')
    if (!state) throw new Error('Expected widget state to exist')

    const onValueChange = vi.fn()
    const widgetValue = computed(() => state.value)
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

    const state = store.getWidget(graph.id, node.id, 'testnum')
    if (!state) throw new Error('Expected widget state to exist')

    const widgetValue = computed(() => state.value)
    watch(widgetValue, onValueChange)

    node.widgets![0].value = 99
    await nextTick()

    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(widgetValue.value).toBe(99)
  })
})

describe('Subgraph Promoted Pseudo Widgets', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('marks promoted $$ widgets as canvasOnly for Vue widget rendering', () => {
    const subgraph = createTestSubgraph()
    const interiorNode = new LGraphNode('interior')
    interiorNode.id = 10
    subgraph.add(interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 123 })
    const graph = subgraphNode.graph as LGraph
    graph.add(subgraphNode)

    usePromotionStore().promote(
      subgraphNode.rootGraph.id,
      subgraphNode.id,
      '10',
      '$$canvas-image-preview'
    )

    const { vueNodeData } = useGraphNodeManager(graph)
    const vueNode = vueNodeData.get(String(subgraphNode.id))
    const promotedWidget = vueNode?.widgets?.find(
      (widget) => widget.name === '$$canvas-image-preview'
    )

    expect(promotedWidget).toBeDefined()
    expect(promotedWidget?.options?.canvasOnly).toBe(true)
  })
})
