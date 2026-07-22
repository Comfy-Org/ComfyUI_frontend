import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, watch } from 'vue'

import { useGraphNodeManager } from '@/composables/graph/useGraphNodeManager'
import { BaseWidget, LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { widgetId } from '@/types/widgetId'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
import { linkedWidgetedInputs } from '@/renderer/extensions/vueNodes/utils/nodeDataUtils'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
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

    useGraphNodeManager(graph)

    return { node, graph }
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
    const id = widgetId(graph.id, node.id, 'testnum')
    expect(store.getWidget(id)?.value).toBe(2)

    const state = store.getWidget(id)
    if (!state) throw new Error('Expected widget state to exist')

    const onValueChange = vi.fn()
    const widgetValue = computed(() => state.value)
    watch(widgetValue, onValueChange)

    widget.value = 42
    await nextTick()

    expect(widgetValue.value).toBe(42)
    expect(onValueChange).toHaveBeenCalledTimes(1)
  })

  it('does not re-wrap node.widgets across manager re-initialization', () => {
    const { node, graph } = createTestGraph()
    const widgetsGetter = () =>
      Object.getOwnPropertyDescriptor(node, 'widgets')?.get

    const firstGetter = widgetsGetter()

    useGraphNodeManager(graph)
    useGraphNodeManager(graph)

    expect(widgetsGetter()).toBe(firstGetter)
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
    if (!state) throw new Error('Expected widget state to exist')

    const widgetValue = computed(() => state.value)
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
    const link = upstream.connect(0, node, 0)
    if (!link) throw new Error('Expected upstream.connect to produce a link')

    return { graph, node, upstream, linkId: link.id }
  }

  it('exposes linked widget input slots through the live node inputs', () => {
    const { graph, node } = createWidgetInputGraph()
    useGraphNodeManager(graph)

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

    const link = subgraph.inputNode.slots[0].connect(input, node)
    if (!link)
      throw new Error('Expected SubgraphInput.connect to produce a link')

    useGraphNodeManager(subgraph)

    expect(node.inputs?.[0]?.link).not.toBeNull()
    expect(
      linkedWidgetedInputs(node.id, node.inputs, subgraph.rootGraph.id).map(
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

    useGraphNodeManager(graph)

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

    const { getNode } = useGraphNodeManager(graph)
    const liveNode = getNode(node.id)
    if (!liveNode?.outputs) throw new Error('Expected output data to exist')

    expect(liveNode.outputs[0].label).toBeUndefined()
    expect(liveNode.outputs[1].label).toBeUndefined()

    // Simulate what SubgraphNode does: set the label, then fire the trigger
    node.outputs[0].label = 'custom_label'
    graph.trigger('node:slot-label:changed', {
      nodeId: node.id,
      slotType: NodeSlotType.OUTPUT
    })

    await nextTick()

    expect(liveNode.outputs?.[0]?.label).toBe('custom_label')
    expect(liveNode.outputs?.[1]?.label).toBeUndefined()
  })

  it('updates input slot labels when node:slot-label:changed is triggered', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('original_name', 'STRING')
    graph.add(node)

    const { getNode } = useGraphNodeManager(graph)
    const liveNode = getNode(node.id)
    if (!liveNode?.inputs) throw new Error('Expected input data to exist')

    expect(liveNode.inputs[0].label).toBeUndefined()

    node.inputs[0].label = 'custom_label'
    graph.trigger('node:slot-label:changed', {
      nodeId: node.id,
      slotType: NodeSlotType.INPUT
    })

    await nextTick()

    expect(liveNode.inputs?.[0]?.label).toBe('custom_label')
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

    useGraphNodeManager(graph)

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

    useGraphNodeManager(graph)

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

    useGraphNodeManager(graph)

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

    useGraphNodeManager(graph)

    const renderState = useWidgetValueStore().getWidgetRenderState(
      widgetId(graph.id, node.id, 'steps')
    )

    expect(renderState).toBeDefined()
    expect(renderState).not.toHaveProperty('sourceExecutionId')
  })
})

describe('reconcileNodeErrorFlags (via lastNodeErrors watcher)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function setupGraphWithStore() {
    const graph = new LGraph()
    const nodeA = new LGraphNode('KSampler')
    nodeA.addInput('model', 'MODEL')
    nodeA.addInput('steps', 'INT')
    graph.add(nodeA)

    const nodeB = new LGraphNode('LoadCheckpoint')
    nodeB.addInput('ckpt_name', 'STRING')
    graph.add(nodeB)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(true)

    const settingStore = useSettingStore()
    settingStore.settingValues['Comfy.RightSidePanel.ShowErrorsTab'] = true

    // Initialize store (triggers watcher registration)
    useGraphNodeManager(graph)
    const store = useExecutionErrorStore()
    return { graph, nodeA, nodeB, store }
  }

  it('sets has_errors on nodes referenced in lastNodeErrors', async () => {
    const { nodeA, nodeB, store } = setupGraphWithStore()

    store.lastNodeErrors = {
      [String(nodeA.id)]: {
        errors: [
          {
            type: 'value_bigger_than_max',
            message: 'Too big',
            details: '',
            extra_info: { input_name: 'steps' }
          }
        ],
        dependent_outputs: [],
        class_type: 'KSampler'
      }
    }
    await nextTick()

    expect(nodeA.has_errors).toBe(true)
    expect(nodeB.has_errors).toBeFalsy()
  })

  it('sets slot hasErrors for inputs matching error input_name', async () => {
    const { nodeA, store } = setupGraphWithStore()

    store.lastNodeErrors = {
      [String(nodeA.id)]: {
        errors: [
          {
            type: 'required_input_missing',
            message: 'Missing',
            details: '',
            extra_info: { input_name: 'model' }
          }
        ],
        dependent_outputs: [],
        class_type: 'KSampler'
      }
    }
    await nextTick()

    expect(nodeA.inputs[0].hasErrors).toBe(true)
    expect(nodeA.inputs[1].hasErrors).toBe(false)
  })

  it('clears has_errors and slot hasErrors when errors are removed', async () => {
    const { nodeA, store } = setupGraphWithStore()

    store.lastNodeErrors = {
      [String(nodeA.id)]: {
        errors: [
          {
            type: 'value_bigger_than_max',
            message: 'Too big',
            details: '',
            extra_info: { input_name: 'steps' }
          }
        ],
        dependent_outputs: [],
        class_type: 'KSampler'
      }
    }
    await nextTick()
    expect(nodeA.has_errors).toBe(true)
    expect(nodeA.inputs[1].hasErrors).toBe(true)

    store.lastNodeErrors = null
    await nextTick()

    expect(nodeA.has_errors).toBeFalsy()
    expect(nodeA.inputs[1].hasErrors).toBe(false)
  })

  it('propagates has_errors to parent subgraph node', async () => {
    const subgraph = createTestSubgraph()
    const interiorNode = new LGraphNode('InnerNode')
    interiorNode.addInput('value', 'INT')
    subgraph.add(interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 50 })
    const graph = subgraphNode.graph as LGraph
    graph.add(subgraphNode)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(true)

    useGraphNodeManager(graph)
    const store = useExecutionErrorStore()

    // Error on interior node: execution ID = "50:<interiorNodeId>"
    const interiorExecId = `${subgraphNode.id}:${interiorNode.id}`
    store.lastNodeErrors = {
      [interiorExecId]: {
        errors: [
          {
            type: 'required_input_missing',
            message: 'Missing',
            details: '',
            extra_info: { input_name: 'value' }
          }
        ],
        dependent_outputs: [],
        class_type: 'InnerNode'
      }
    }
    await nextTick()

    // Interior node should have the error
    expect(interiorNode.has_errors).toBe(true)
    expect(interiorNode.inputs[0].hasErrors).toBe(true)
    // Parent subgraph node should also be flagged
    expect(subgraphNode.has_errors).toBe(true)
  })

  it('sets has_errors on nodes with missing models', async () => {
    const { nodeA, nodeB } = setupGraphWithStore()
    const missingModelStore = useMissingModelStore()

    missingModelStore.setMissingModels([
      {
        nodeId: String(nodeA.id),
        nodeType: 'CheckpointLoader',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'missing.safetensors',
        isMissing: true
      }
    ])
    await nextTick()

    expect(nodeA.has_errors).toBe(true)
    expect(nodeB.has_errors).toBeFalsy()
  })

  it('clears has_errors when missing models are removed', async () => {
    const { nodeA } = setupGraphWithStore()
    const missingModelStore = useMissingModelStore()

    missingModelStore.setMissingModels([
      {
        nodeId: String(nodeA.id),
        nodeType: 'CheckpointLoader',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'missing.safetensors',
        isMissing: true
      }
    ])
    await nextTick()
    expect(nodeA.has_errors).toBe(true)

    missingModelStore.clearMissingModels()
    await nextTick()
    expect(nodeA.has_errors).toBeFalsy()
  })

  it('flags parent subgraph node when interior node has missing model', async () => {
    const subgraph = createTestSubgraph()
    const interiorNode = new LGraphNode('CheckpointLoader')
    subgraph.add(interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 50 })
    const graph = subgraphNode.graph as LGraph
    graph.add(subgraphNode)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(true)

    const settingStore = useSettingStore()
    settingStore.settingValues['Comfy.RightSidePanel.ShowErrorsTab'] = true

    useGraphNodeManager(graph)
    useExecutionErrorStore()
    const missingModelStore = useMissingModelStore()

    missingModelStore.setMissingModels([
      {
        nodeId: `${subgraphNode.id}:${interiorNode.id}`,
        nodeType: 'CheckpointLoader',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'missing.safetensors',
        isMissing: true
      }
    ])
    await nextTick()

    expect(interiorNode.has_errors).toBe(true)
    expect(subgraphNode.has_errors).toBe(true)
  })
})

describe('Pre-remove node reference drain', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('drops the node reference before node.onRemoved fires', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    const { getNode } = useGraphNodeManager(graph)
    const id = node.id

    expect(getNode(id)).toBeDefined()

    let refPresentInOnRemoved: boolean | undefined
    node.onRemoved = () => {
      refPresentInOnRemoved = getNode(id) !== undefined
    }

    graph.remove(node)

    expect(
      refPresentInOnRemoved,
      'the node reference must be dropped before node.onRemoved fires so reactive consumers cannot observe the detached node'
    ).toBe(false)
  })

  it('clears node references when LGraph.clear() dispatches node:before-removed for each node', () => {
    const graph = new LGraph()
    const nodeA = new LGraphNode('a')
    const nodeB = new LGraphNode('b')
    graph.add(nodeA)
    graph.add(nodeB)
    const { getNode } = useGraphNodeManager(graph)

    expect(getNode(nodeA.id)).toBeDefined()
    expect(getNode(nodeB.id)).toBeDefined()

    const beforeRemovedSpy = vi.fn()
    graph.events.addEventListener('node:before-removed', beforeRemovedSpy)

    graph.clear()

    expect(
      beforeRemovedSpy,
      'clear() must dispatch node:before-removed so reactive consumers can drop refs before nodes detach'
    ).toHaveBeenCalledTimes(2)
    expect(getNode(nodeA.id)).toBeUndefined()
    expect(getNode(nodeB.id)).toBeUndefined()
  })
})
