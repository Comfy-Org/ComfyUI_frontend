import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, watch } from 'vue'

import { BaseWidget, LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { linkedWidgetedInputs } from '@/renderer/extensions/vueNodes/utils/nodeDataUtils'
import { app } from '@/scripts/app'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { widgetId } from '@/types/widgetId'

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

    return { node, graph }
  }

  it('widget values are reactive through the store', async () => {
    const { node, graph } = createTestGraph()
    const store = useWidgetValueStore()
    const widget = node.widgets![0]

    expect(widget).toBeInstanceOf(BaseWidget)
    expect(widget.value).toBe(2)
    expect((widget as BaseWidget).node.id).toBe(node.id)

    const id = widgetId(graph.id, node.id, 'testnum')
    expect(store.getWidget(id)?.value).toBe(2)

    const state = store.getWidget(id)

    const onValueChange = vi.fn()
    const widgetValue = computed(() => state?.value)
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

    const upstream = new LGraphNode('upstream')
    upstream.addOutput('out', 'INT')
    graph.add(upstream)
    upstream.connect(0, node, 0)
    await nextTick()

    const state = store.getWidget(widgetId(graph.id, node.id, 'testnum'))

    const widgetValue = computed(() => state?.value)
    watch(widgetValue, onValueChange)

    node.widgets![0].value = 99
    await nextTick()

    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(widgetValue.value).toBe(99)
  })
})

describe('Widget input link reactivity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function createWidgetInputGraph() {
    const graph = new LGraph()
    const node = new LGraphNode('test')

    node.addWidget('string', 'prompt', 'hello', () => undefined, {})
    const input = node.addInput('prompt', 'STRING')
    input.widget = { name: 'prompt' }
    graph.add(node)

    const upstream = new LGraphNode('upstream')
    upstream.addOutput('out', 'STRING')
    graph.add(upstream)
    expect(upstream.connect(0, node, 0)).not.toBeNull()

    return { graph, node, upstream }
  }

  it('exposes linked widget input slots through the live node inputs', () => {
    const { node } = createWidgetInputGraph()

    expect(node.inputs?.[0]?.widget?.name).toBe('prompt')
    expect(node.inputs?.[0]?.link).not.toBeNull()
  })

  it('marks a widget input slot as linked when connected to a SubgraphInput', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'prompt', type: 'STRING' }]
    })
    const node = new LGraphNode('test')
    node.addWidget('string', 'prompt', 'hello', () => undefined, {})
    const input = node.addInput('prompt', 'STRING')
    input.widget = { name: 'prompt' }
    subgraph.add(node)

    expect(subgraph.inputNode.slots[0].connect(input, node)).not.toBeNull()

    expect(node.inputs?.[0]?.link).not.toBeNull()
    expect(
      linkedWidgetedInputs(node.id, node.inputs, graphScopeOf(subgraph)).map(
        (s) => s.name
      )
    ).toEqual(['prompt'])
  })

  it('registers promoted widget render state separately from value state', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'STRING' }]
    })
    const interiorNode = new LGraphNode('interior')
    const interiorInput = interiorNode.addInput('value', 'STRING')
    interiorNode.addWidget('string', 'prompt', 'hello', () => undefined, {})
    interiorInput.widget = { name: 'prompt' }
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorInput, interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 123 })
    subgraphNode._internalConfigureAfterSlots()
    const graph = subgraphNode.graph as LGraph
    graph.add(subgraphNode)

    const id = widgetId(graph.id, subgraphNode.id, 'value')
    const store = useWidgetValueStore()
    const valueState = store.getWidget(id)
    const renderState = store.getWidgetRenderState(id)

    expect(valueState?.name).toBe('value')
    expect(valueState?.value).toBe('hello')
    expect(renderState).toMatchObject({
      hasLayoutSize: false,
      isDOMWidget: false
    })
    expect(renderState).not.toHaveProperty('sourceWidgetName')
    expect(subgraphNode.inputs[0].widget?.name).toBe('value')
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

    const id = widgetId(graph.id, subgraphNodeB.id, 'b_input')
    const state = useWidgetValueStore().getWidget(id)

    expect(state?.type).toBe('combo')
    expect(subgraphNodeB.widgets[0]?.widgetId).toBe(id)
  })

  it('preserves distinct store identity for duplicate-named promoted widgets', () => {
    const subgraph = createTestSubgraph({
      inputs: [
        { name: 'first_seed', type: '*' },
        { name: 'second_seed', type: '*' }
      ]
    })

    const firstNode = new LGraphNode('FirstNode')
    const firstInput = firstNode.addInput('seed', '*')
    firstNode.addWidget('number', 'seed', 1, () => undefined)
    firstInput.widget = { name: 'seed' }
    subgraph.add(firstNode)
    subgraph.inputNode.slots[0].connect(firstInput, firstNode)

    const secondNode = new LGraphNode('SecondNode')
    const secondInput = secondNode.addInput('seed', '*')
    secondNode.addWidget('number', 'seed', 2, () => undefined)
    secondInput.widget = { name: 'seed' }
    subgraph.add(secondNode)
    subgraph.inputNode.slots[1].connect(secondInput, secondNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 100 })
    const graph = subgraphNode.graph as LGraph
    graph.add(subgraphNode)

    const ids = subgraphNode.widgets.map((widget) => widget.widgetId)

    expect(ids).toStrictEqual([
      widgetId(graph.id, subgraphNode.id, 'first_seed'),
      widgetId(graph.id, subgraphNode.id, 'second_seed')
    ])
    expect(ids[0]).not.toBe(ids[1])
  })
})
describe('Promoted widget render state', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('registers plain render metadata for promoted widgets', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'ckpt_input', type: '*' }]
    })
    const interiorNode = new LGraphNode('CheckpointLoaderSimple')
    const interiorInput = interiorNode.addInput('ckpt_input', '*')
    interiorNode.addWidget(
      'combo',
      'ckpt_name',
      'model.safetensors',
      () => undefined,
      {
        values: ['model.safetensors']
      }
    )
    interiorInput.widget = { name: 'ckpt_name' }
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorInput, interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 65 })
    subgraphNode._internalConfigureAfterSlots()
    const graph = subgraphNode.graph as LGraph
    graph.add(subgraphNode)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    const renderState = useWidgetValueStore().getWidgetRenderState(
      widgetId(graph.id, subgraphNode.id, 'ckpt_input')
    )

    expect(renderState).toMatchObject({
      hasLayoutSize: false,
      isDOMWidget: false
    })
    expect(renderState).not.toHaveProperty('sourceWidgetName')
    expect(renderState).not.toHaveProperty('sourceExecutionId')
  })

  it('registers plain render metadata for non-promoted widgets', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addWidget('number', 'steps', 20, () => undefined, {})
    graph.add(node)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    const renderState = useWidgetValueStore().getWidgetRenderState(
      widgetId(graph.id, node.id, 'steps')
    )

    expect(renderState).toBeDefined()
    expect(renderState).not.toHaveProperty('sourceExecutionId')
  })
})
