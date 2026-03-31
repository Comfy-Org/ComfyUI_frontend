import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, watch } from 'vue'

import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import { createPromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetView'
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

describe('Widget slotMetadata reactivity on link disconnect', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function createWidgetInputGraph() {
    const graph = new LGraph()
    const node = new LGraphNode('test')

    // Add a widget and an associated input slot (simulates "widget converted to input")
    node.addWidget('string', 'prompt', 'hello', () => undefined, {})
    const input = node.addInput('prompt', 'STRING')
    // Associate the input slot with the widget (as widgetInputs extension does)
    input.widget = { name: 'prompt' }

    // Start with a connected link
    input.link = 42

    graph.add(node)
    return { graph, node }
  }

  it('sets slotMetadata.linked to true when input has a link', () => {
    const { graph, node } = createWidgetInputGraph()
    const { vueNodeData } = useGraphNodeManager(graph)

    const nodeData = vueNodeData.get(String(node.id))
    const widgetData = nodeData?.widgets?.find((w) => w.name === 'prompt')

    expect(widgetData?.slotMetadata).toBeDefined()
    expect(widgetData?.slotMetadata?.linked).toBe(true)
  })

  it('updates slotMetadata.linked to false after link disconnect event', async () => {
    const { graph, node } = createWidgetInputGraph()
    const { vueNodeData } = useGraphNodeManager(graph)

    const nodeData = vueNodeData.get(String(node.id))
    const widgetData = nodeData?.widgets?.find((w) => w.name === 'prompt')

    // Verify initially linked
    expect(widgetData?.slotMetadata?.linked).toBe(true)

    // Simulate link disconnection (as LiteGraph does before firing the event)
    node.inputs[0].link = null

    // Fire the trigger event that LiteGraph fires on disconnect
    graph.trigger('node:slot-links:changed', {
      nodeId: node.id,
      slotType: NodeSlotType.INPUT,
      slotIndex: 0,
      connected: false,
      linkId: 42
    })

    await nextTick()

    // slotMetadata.linked should now be false
    expect(widgetData?.slotMetadata?.linked).toBe(false)
  })

  it('reactively updates disabled state in a derived computed after disconnect', async () => {
    const { graph, node } = createWidgetInputGraph()
    const { vueNodeData } = useGraphNodeManager(graph)

    const nodeData = vueNodeData.get(String(node.id))!

    // Mimic what processedWidgets does in NodeWidgets.vue:
    // derive disabled from slotMetadata.linked
    const derivedDisabled = computed(() => {
      const widgets = nodeData.widgets ?? []
      const widget = widgets.find((w) => w.name === 'prompt')
      return widget?.slotMetadata?.linked ? true : false
    })

    // Initially linked → disabled
    expect(derivedDisabled.value).toBe(true)

    // Track changes
    const onChange = vi.fn()
    watch(derivedDisabled, onChange)

    // Simulate disconnect
    node.inputs[0].link = null
    graph.trigger('node:slot-links:changed', {
      nodeId: node.id,
      slotType: NodeSlotType.INPUT,
      slotIndex: 0,
      connected: false,
      linkId: 42
    })

    await nextTick()

    // The derived computed should now return false
    expect(derivedDisabled.value).toBe(false)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('updates slotMetadata for promoted widgets where SafeWidgetData.name differs from input.widget.name', async () => {
    // Set up a subgraph with an interior node that has a "prompt" widget.
    // createPromotedWidgetView resolves against this interior node.
    const subgraph = createTestSubgraph()
    const interiorNode = new LGraphNode('interior')
    interiorNode.id = 10
    interiorNode.addWidget('string', 'prompt', 'hello', () => undefined, {})
    subgraph.add(interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 123 })

    // Create a PromotedWidgetView with identityName="value" (subgraph input
    // slot name) and sourceWidgetName="prompt" (interior widget name).
    // PromotedWidgetView.name returns "value" (identity), safeWidgetMapper
    // sets SafeWidgetData.name to sourceWidgetName ("prompt").
    const promotedView = createPromotedWidgetView(
      subgraphNode,
      '10',
      'prompt',
      'value',
      undefined,
      'value'
    )

    // Host the promoted view on a regular node so we can control widgets
    // directly (SubgraphNode.widgets is a synthetic getter).
    const graph = new LGraph()
    const hostNode = new LGraphNode('host')
    hostNode.widgets = [promotedView]
    const input = hostNode.addInput('value', 'STRING')
    input.widget = { name: 'value' }
    input.link = 42
    graph.add(hostNode)

    const { vueNodeData } = useGraphNodeManager(graph)
    const nodeData = vueNodeData.get(String(hostNode.id))

    // SafeWidgetData.name is "prompt" (sourceWidgetName), but the
    // input slot widget name is "value" — slotName bridges this gap.
    const widgetData = nodeData?.widgets?.find((w) => w.name === 'prompt')
    expect(widgetData).toBeDefined()
    expect(widgetData?.slotName).toBe('value')
    expect(widgetData?.slotMetadata?.linked).toBe(true)

    // Disconnect
    hostNode.inputs[0].link = null
    graph.trigger('node:slot-links:changed', {
      nodeId: hostNode.id,
      slotType: NodeSlotType.INPUT,
      slotIndex: 0,
      connected: false,
      linkId: 42
    })

    await nextTick()

    expect(widgetData?.slotMetadata?.linked).toBe(false)
  })

  it('clears stale slotMetadata when input no longer matches widget', async () => {
    const { graph, node } = createWidgetInputGraph()
    const { vueNodeData } = useGraphNodeManager(graph)

    const nodeData = vueNodeData.get(String(node.id))!
    const widgetData = nodeData.widgets!.find((w) => w.name === 'prompt')!

    expect(widgetData.slotMetadata?.linked).toBe(true)

    node.inputs[0].name = 'other'
    node.inputs[0].widget = { name: 'other' }
    node.inputs[0].link = null

    graph.trigger('node:slot-links:changed', {
      nodeId: node.id,
      slotType: NodeSlotType.INPUT,
      slotIndex: 0,
      connected: false,
      linkId: 42
    })

    await nextTick()

    expect(widgetData.slotMetadata).toBeUndefined()
  })

  it('prefers exact _widget input matches before same-name fallbacks for promoted widgets', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'seed', type: '*' },
        { name: 'seed', type: '*' }
      ]
    })

    const firstNode = new LGraphNode('FirstNode')
    const firstInput = firstNode.addInput('seed', '*')
    firstNode.addWidget('number', 'seed', 1, () => undefined, {})
    firstInput.widget = { name: 'seed' }
    subgraph.add(firstNode)

    const secondNode = new LGraphNode('SecondNode')
    const secondInput = secondNode.addInput('seed', '*')
    secondNode.addWidget('number', 'seed', 2, () => undefined, {})
    secondInput.widget = { name: 'seed' }
    subgraph.add(secondNode)

    subgraph.inputNode.slots[0].connect(firstInput, firstNode)
    subgraph.inputNode.slots[1].connect(secondInput, secondNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 124 })
    const graph = subgraphNode.graph
    if (!graph) throw new Error('Expected subgraph node graph')
    graph.add(subgraphNode)

    const promotedViews = subgraphNode.widgets
    const secondPromotedView = promotedViews[1]
    if (!secondPromotedView) throw new Error('Expected second promoted view')

    ;(
      secondPromotedView as unknown as {
        sourceNodeId: string
        sourceWidgetName: string
      }
    ).sourceNodeId = '9999'
    ;(
      secondPromotedView as unknown as {
        sourceNodeId: string
        sourceWidgetName: string
      }
    ).sourceWidgetName = 'stale_widget'

    const { vueNodeData } = useGraphNodeManager(graph)
    const nodeData = vueNodeData.get(String(subgraphNode.id))
    const secondMappedWidget = nodeData?.widgets?.find(
      (widget) => widget.slotMetadata?.index === 1
    )
    if (!secondMappedWidget)
      throw new Error('Expected mapped widget for slot 1')

    expect(secondMappedWidget.name).not.toBe('stale_widget')
  })
})

describe('Subgraph output slot label reactivity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('updates output slot labels when node:slot-label:changed is triggered', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addOutput('original_name', 'STRING')
    node.addOutput('other_name', 'STRING')
    graph.add(node)

    const { vueNodeData } = useGraphNodeManager(graph)
    const nodeId = String(node.id)
    const nodeData = vueNodeData.get(nodeId)
    if (!nodeData?.outputs) throw new Error('Expected output data to exist')

    expect(nodeData.outputs[0].label).toBeUndefined()
    expect(nodeData.outputs[1].label).toBeUndefined()

    // Simulate what SubgraphNode does: set the label, then fire the trigger
    node.outputs[0].label = 'custom_label'
    graph.trigger('node:slot-label:changed', {
      nodeId: node.id,
      slotType: NodeSlotType.OUTPUT
    })

    await nextTick()

    const updatedData = vueNodeData.get(nodeId)
    expect(updatedData?.outputs?.[0]?.label).toBe('custom_label')
    expect(updatedData?.outputs?.[1]?.label).toBeUndefined()
  })

  it('updates input slot labels when node:slot-label:changed is triggered', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('original_name', 'STRING')
    graph.add(node)

    const { vueNodeData } = useGraphNodeManager(graph)
    const nodeId = String(node.id)
    const nodeData = vueNodeData.get(nodeId)
    if (!nodeData?.inputs) throw new Error('Expected input data to exist')

    expect(nodeData.inputs[0].label).toBeUndefined()

    node.inputs[0].label = 'custom_label'
    graph.trigger('node:slot-label:changed', {
      nodeId: node.id,
      slotType: NodeSlotType.INPUT
    })

    await nextTick()

    const updatedData = vueNodeData.get(nodeId)
    expect(updatedData?.inputs?.[0]?.label).toBe('custom_label')
  })

  it('ignores node:slot-label:changed for unknown node ids', () => {
    const graph = new LGraph()
    useGraphNodeManager(graph)

    expect(() =>
      graph.trigger('node:slot-label:changed', {
        nodeId: 'missing-node',
        slotType: NodeSlotType.OUTPUT
      })
    ).not.toThrow()
  })
})

describe('Subgraph output slot label reactivity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('updates output slot labels when node:slot-label:changed is triggered', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addOutput('original_name', 'STRING')
    node.addOutput('other_name', 'STRING')
    graph.add(node)

    const { vueNodeData } = useGraphNodeManager(graph)
    const nodeId = String(node.id)
    const nodeData = vueNodeData.get(nodeId)
    if (!nodeData?.outputs) throw new Error('Expected output data to exist')

    expect(nodeData.outputs[0].label).toBeUndefined()
    expect(nodeData.outputs[1].label).toBeUndefined()

    // Simulate what SubgraphNode does: set the label, then fire the trigger
    node.outputs[0].label = 'custom_label'
    graph.trigger('node:slot-label:changed', {
      nodeId: node.id,
      slotType: NodeSlotType.OUTPUT
    })

    await nextTick()

    const updatedData = vueNodeData.get(nodeId)
    expect(updatedData?.outputs?.[0]?.label).toBe('custom_label')
    expect(updatedData?.outputs?.[1]?.label).toBeUndefined()
  })

  it('updates input slot labels when node:slot-label:changed is triggered', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('original_name', 'STRING')
    graph.add(node)

    const { vueNodeData } = useGraphNodeManager(graph)
    const nodeId = String(node.id)
    const nodeData = vueNodeData.get(nodeId)
    if (!nodeData?.inputs) throw new Error('Expected input data to exist')

    expect(nodeData.inputs[0].label).toBeUndefined()

    node.inputs[0].label = 'custom_label'
    graph.trigger('node:slot-label:changed', {
      nodeId: node.id,
      slotType: NodeSlotType.INPUT
    })

    await nextTick()

    const updatedData = vueNodeData.get(nodeId)
    expect(updatedData?.inputs?.[0]?.label).toBe('custom_label')
  })

  it('ignores node:slot-label:changed for unknown node ids', () => {
    const graph = new LGraph()
    useGraphNodeManager(graph)

    expect(() =>
      graph.trigger('node:slot-label:changed', {
        nodeId: 'missing-node',
        slotType: NodeSlotType.OUTPUT
      })
    ).not.toThrow()
  })
})

describe('Subgraph output slot label reactivity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('updates output slot labels when node:slot-label:changed is triggered', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addOutput('original_name', 'STRING')
    node.addOutput('other_name', 'STRING')
    graph.add(node)

    const { vueNodeData } = useGraphNodeManager(graph)
    const nodeId = String(node.id)
    const nodeData = vueNodeData.get(nodeId)
    if (!nodeData?.outputs) throw new Error('Expected output data to exist')

    expect(nodeData.outputs[0].label).toBeUndefined()
    expect(nodeData.outputs[1].label).toBeUndefined()

    // Simulate what SubgraphNode does: set the label, then fire the trigger
    node.outputs[0].label = 'custom_label'
    graph.trigger('node:slot-label:changed', {
      nodeId: node.id,
      slotType: NodeSlotType.OUTPUT
    })

    await nextTick()

    const updatedData = vueNodeData.get(nodeId)
    expect(updatedData?.outputs?.[0]?.label).toBe('custom_label')
    expect(updatedData?.outputs?.[1]?.label).toBeUndefined()
  })

  it('updates input slot labels when node:slot-label:changed is triggered', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('original_name', 'STRING')
    graph.add(node)

    const { vueNodeData } = useGraphNodeManager(graph)
    const nodeId = String(node.id)
    const nodeData = vueNodeData.get(nodeId)
    if (!nodeData?.inputs) throw new Error('Expected input data to exist')

    expect(nodeData.inputs[0].label).toBeUndefined()

    node.inputs[0].label = 'custom_label'
    graph.trigger('node:slot-label:changed', {
      nodeId: node.id,
      slotType: NodeSlotType.INPUT
    })

    await nextTick()

    const updatedData = vueNodeData.get(nodeId)
    expect(updatedData?.inputs?.[0]?.label).toBe('custom_label')
  })

  it('ignores node:slot-label:changed for unknown node ids', () => {
    const graph = new LGraph()
    useGraphNodeManager(graph)

    expect(() =>
      graph.trigger('node:slot-label:changed', {
        nodeId: 'missing-node',
        slotType: NodeSlotType.OUTPUT
      })
    ).not.toThrow()
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

    usePromotionStore().promote(subgraphNode.rootGraph.id, subgraphNode.id, {
      sourceNodeId: '10',
      sourceWidgetName: '$$canvas-image-preview'
    })

    const { vueNodeData } = useGraphNodeManager(graph)
    const vueNode = vueNodeData.get(String(subgraphNode.id))
    const promotedWidget = vueNode?.widgets?.find(
      (widget) => widget.name === '$$canvas-image-preview'
    )

    expect(promotedWidget).toBeDefined()
    expect(promotedWidget?.options?.canvasOnly).toBe(true)
  })
})

describe('Nested promoted widget mapping', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('maps store identity to deepest concrete widget for two-layer promotions', () => {
    const subgraphA = createTestSubgraph({
      inputs: [{ name: 'a_input', type: '*' }]
    })
    const innerNode = new LGraphNode('InnerComboNode')
    const innerInput = innerNode.addInput('picker_input', '*')
    innerNode.addWidget('combo', 'picker', 'a', () => undefined, {
      values: ['a', 'b']
    })
    innerInput.widget = { name: 'picker' }
    subgraphA.add(innerNode)
    subgraphA.inputNode.slots[0].connect(innerInput, innerNode)

    const subgraphNodeA = createTestSubgraphNode(subgraphA, { id: 11 })

    const subgraphB = createTestSubgraph({
      inputs: [{ name: 'b_input', type: '*' }]
    })
    subgraphB.add(subgraphNodeA)
    subgraphNodeA._internalConfigureAfterSlots()
    subgraphB.inputNode.slots[0].connect(subgraphNodeA.inputs[0], subgraphNodeA)

    const subgraphNodeB = createTestSubgraphNode(subgraphB, { id: 22 })
    const graph = subgraphNodeB.graph as LGraph
    graph.add(subgraphNodeB)

    const { vueNodeData } = useGraphNodeManager(graph)
    const nodeData = vueNodeData.get(String(subgraphNodeB.id))
    const mappedWidget = nodeData?.widgets?.[0]

    expect(mappedWidget).toBeDefined()
    expect(mappedWidget?.type).toBe('combo')
    expect(mappedWidget?.storeName).toBe('picker')
    expect(mappedWidget?.storeNodeId).toBe(
      `${subgraphNodeB.subgraph.id}:${innerNode.id}`
    )
  })

  it('keeps linked and independent same-name promotions as distinct sources', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'string_a', type: '*' }]
    })

    const linkedNode = new LGraphNode('LinkedNode')
    const linkedInput = linkedNode.addInput('string_a', '*')
    linkedNode.addWidget('text', 'string_a', 'linked', () => undefined, {})
    linkedInput.widget = { name: 'string_a' }
    subgraph.add(linkedNode)
    subgraph.inputNode.slots[0].connect(linkedInput, linkedNode)

    const independentNode = new LGraphNode('IndependentNode')
    independentNode.addWidget(
      'text',
      'string_a',
      'independent',
      () => undefined,
      {}
    )
    subgraph.add(independentNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 109 })
    const graph = subgraphNode.graph as LGraph
    graph.add(subgraphNode)

    usePromotionStore().promote(subgraphNode.rootGraph.id, subgraphNode.id, {
      sourceNodeId: String(independentNode.id),
      sourceWidgetName: 'string_a'
    })

    const { vueNodeData } = useGraphNodeManager(graph)
    const nodeData = vueNodeData.get(String(subgraphNode.id))
    const promotedWidgets = nodeData?.widgets?.filter(
      (widget) => widget.name === 'string_a'
    )

    expect(promotedWidgets).toHaveLength(2)
    expect(
      new Set(promotedWidgets?.map((widget) => widget.storeNodeId))
    ).toEqual(
      new Set([
        `${subgraph.id}:${linkedNode.id}`,
        `${subgraph.id}:${independentNode.id}`
      ])
    )
  })

  it('maps duplicate-name promoted views from same intermediate node to distinct store identities', () => {
    const innerSubgraph = createTestSubgraph()
    const firstTextNode = new LGraphNode('FirstTextNode')
    firstTextNode.addWidget('text', 'text', '11111111111', () => undefined)
    innerSubgraph.add(firstTextNode)

    const secondTextNode = new LGraphNode('SecondTextNode')
    secondTextNode.addWidget('text', 'text', '22222222222', () => undefined)
    innerSubgraph.add(secondTextNode)

    const outerSubgraph = createTestSubgraph()
    const innerSubgraphNode = createTestSubgraphNode(innerSubgraph, {
      id: 3,
      parentGraph: outerSubgraph
    })
    outerSubgraph.add(innerSubgraphNode)

    const outerSubgraphNode = createTestSubgraphNode(outerSubgraph, { id: 4 })
    const graph = outerSubgraphNode.graph as LGraph
    graph.add(outerSubgraphNode)

    usePromotionStore().setPromotions(
      innerSubgraphNode.rootGraph.id,
      innerSubgraphNode.id,
      [
        { sourceNodeId: String(firstTextNode.id), sourceWidgetName: 'text' },
        { sourceNodeId: String(secondTextNode.id), sourceWidgetName: 'text' }
      ]
    )

    usePromotionStore().setPromotions(
      outerSubgraphNode.rootGraph.id,
      outerSubgraphNode.id,
      [
        {
          sourceNodeId: String(innerSubgraphNode.id),
          sourceWidgetName: 'text',
          disambiguatingSourceNodeId: String(firstTextNode.id)
        },
        {
          sourceNodeId: String(innerSubgraphNode.id),
          sourceWidgetName: 'text',
          disambiguatingSourceNodeId: String(secondTextNode.id)
        }
      ]
    )

    const { vueNodeData } = useGraphNodeManager(graph)
    const nodeData = vueNodeData.get(String(outerSubgraphNode.id))
    const promotedWidgets = nodeData?.widgets?.filter(
      (widget) => widget.name === 'text'
    )

    expect(promotedWidgets).toHaveLength(2)
    expect(
      new Set(promotedWidgets?.map((widget) => widget.storeNodeId))
    ).toEqual(
      new Set([
        `${outerSubgraphNode.subgraph.id}:${firstTextNode.id}`,
        `${outerSubgraphNode.subgraph.id}:${secondTextNode.id}`
      ])
    )
  })
})
