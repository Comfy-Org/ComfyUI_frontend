import { createTestingPinia } from '@pinia/testing'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { assetService } from '@/platform/assets/services/assetService'
import type { ComfyNodeDef, InputSpec } from '@/schemas/nodeDefSchema'
import { CONFIG, GET_CONFIG } from '@/services/litegraphService'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

/** `app.configuringGraph` is a getter on the real app, so route it via a ref. */
const appState = vi.hoisted(() => ({ configuringGraph: false }))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: { graph_mouse: [0, 0], graph: null },
    get configuringGraph() {
      return appState.configuringGraph
    },
    registerExtension: vi.fn()
  }
}))

import { app } from '@/scripts/app'

import {
  PrimitiveNode,
  convertToInput,
  getWidgetConfig,
  mergeIfValid,
  setWidgetConfig
} from './widgetInputs'

beforeEach(() => {
  appState.configuringGraph = false
  app.canvas.graph = null
})

/**
 * `registerExtension` is a mock, and `mockReset: true` clears its calls before
 * the first test runs — so the registered extension is captured at collection.
 */
const widgetInputsExtension = vi.mocked(app.registerExtension).mock
  .calls[0]?.[0]
if (!widgetInputsExtension)
  throw new Error('Comfy.WidgetInputs was not registered on import')

/**
 * Applies the extension's `beforeRegisterNodeDef` to a throwaway node class.
 * `prepare` runs first, so hooks it installs are the ones the extension chains.
 */
async function applyNodeDefHooks(
  prepare?: (nodeType: typeof LGraphNode) => void
) {
  class TestNodeType extends LGraphNode {
    static override nodeData: LGraphNode['constructor']['nodeData']
  }
  prepare?.(TestNodeType)
  await widgetInputsExtension.beforeRegisterNodeDef?.(
    TestNodeType,
    fromPartial<ComfyNodeDef>({}),
    app
  )
  return TestNodeType
}

function widgetSlot(
  config: InputSpec,
  name = 'value'
): INodeInputSlot | INodeOutputSlot {
  return fromPartial({
    name,
    widget: { name, [GET_CONFIG]: () => config }
  })
}

describe('PrimitiveNode', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('keeps its serialized value when the target widget has a stale value', () => {
    const graph = new LGraph()
    const target = new LGraphNode('Target')
    graph.add(target)
    target.addInput('seed', 'INT')
    target.inputs[0].widget = {
      name: 'seed',
      [GET_CONFIG]: () => ['INT', { control_after_generate: true }]
    }
    target.addWidget('number', 'seed', 111, () => {})

    const primitive = new PrimitiveNode('Primitive')
    graph.add(primitive)
    appState.configuringGraph = true
    primitive.connect(0, target, 0)
    primitive.configure(fromPartial({ widgets_values: [222] }))
    appState.configuringGraph = false

    primitive.onAfterGraphConfigured()

    expect(primitive.widgets?.[0].value).toBe(222)

    primitive.widgets![0].value = 333
    primitive.applyToGraph()
    primitive.disconnectOutput(0)
    primitive.connect(0, target, 0)

    expect(primitive.widgets?.[0].value).toBe(333)
  })

  it('restores a serialized null value over the target widget value', () => {
    const graph = new LGraph()
    const target = new LGraphNode('Target')
    graph.add(target)
    target.addInput('value', 'STRING')
    target.inputs[0].widget = {
      name: 'value',
      [GET_CONFIG]: () => ['STRING', {}]
    }
    target.addWidget('text', 'value', 'stale', () => {})

    const primitive = new PrimitiveNode('Primitive')
    graph.add(primitive)
    appState.configuringGraph = true
    primitive.connect(0, target, 0)
    primitive.configure(fromPartial({ widgets_values: [null] }))
    appState.configuringGraph = false

    primitive.onAfterGraphConfigured()

    expect(primitive.widgets?.[0].value).toBeNull()
  })

  it('restores its serialized control_after_generate value', () => {
    const graph = new LGraph()
    const target = new LGraphNode('Target')
    graph.add(target)
    target.addInput('seed', 'INT')
    target.inputs[0].widget = {
      name: 'seed',
      [GET_CONFIG]: () => ['INT', {}]
    }
    target.addWidget('number', 'seed', 111, () => {})

    const primitive = new PrimitiveNode('Primitive')
    graph.add(primitive)
    appState.configuringGraph = true
    primitive.connect(0, target, 0)
    primitive.configure(fromPartial({ widgets_values: [222, 'randomize'] }))
    appState.configuringGraph = false

    primitive.onAfterGraphConfigured()

    expect(primitive.widgets?.[1].value).toBe('randomize')
  })

  it('stops re-applying its serialized value once a widget has been created', () => {
    const graph = new LGraph()
    const target = new LGraphNode('Target')
    graph.add(target)
    target.addInput('seed', 'INT')
    target.inputs[0].widget = {
      name: 'seed',
      [GET_CONFIG]: () => ['INT', { control_after_generate: true }]
    }
    target.addWidget('number', 'seed', 111, () => {})

    const primitive = new PrimitiveNode('Primitive')
    graph.add(primitive)
    primitive.configure(fromPartial({ widgets_values: [222] }))
    primitive.connect(0, target, 0)

    expect(primitive.widgets?.[0].value).toBe(222)

    primitive.widgets![0].value = 333
    primitive.applyToGraph()
    primitive.disconnectOutput(0)
    primitive.connect(0, target, 0)

    expect(primitive.widgets?.[0].value).toBe(333)
  })

  it('keeps its serialized value for an asset browser widget', () => {
    vi.spyOn(assetService, 'shouldUseAssetBrowser').mockReturnValue(true)
    const graph = new LGraph()
    const target = new LGraphNode('Target')
    target.comfyClass = 'CheckpointLoaderSimple'
    graph.add(target)
    target.addInput('ckpt_name', 'COMBO')
    target.inputs[0].widget = {
      name: 'ckpt_name',
      [GET_CONFIG]: () => [['target.safetensors', 'serialized.safetensors'], {}]
    }
    target.addWidget('combo', 'ckpt_name', 'target.safetensors', () => {}, {
      values: ['target.safetensors', 'serialized.safetensors']
    })

    const primitive = new PrimitiveNode('Primitive')
    graph.add(primitive)
    appState.configuringGraph = true
    primitive.connect(0, target, 0)
    primitive.configure(
      fromPartial({ widgets_values: ['serialized.safetensors'] })
    )
    appState.configuringGraph = false

    primitive.onAfterGraphConfigured()

    expect(primitive.widgets?.[0]).toMatchObject({
      type: 'asset',
      value: 'serialized.safetensors'
    })
  })

  it('resets itself when the store reports a link the graph cannot resolve', () => {
    const graph = new LGraph()
    const node = new PrimitiveNode('Primitive')
    graph.add(node)
    useLinkStore().registerLink(graphScopeOf(graph), {
      id: toLinkId(999),
      graphId: graphScopeOf(graph).owningGraphId,
      originNodeId: node.id,
      originSlot: 0,
      targetNodeId: toNodeId(42),
      targetSlot: 0,
      type: '*'
    })
    const onLastDisconnect = vi.spyOn(node, 'onLastDisconnect')

    node.onAfterGraphConfigured()

    expect(onLastDisconnect).toHaveBeenCalled()
  })

  it('keeps its serialized value when the widget cannot be built during load', () => {
    const graph = new LGraph()
    const target = new LGraphNode('Target')
    graph.add(target)
    target.addInput('seed', 'INT')
    target.inputs[0].widget = {
      name: 'seed',
      [GET_CONFIG]: () => ['INT', { control_after_generate: true }]
    }
    target.addWidget('number', 'seed', 111, () => {})

    const primitive = new PrimitiveNode('Primitive')
    graph.add(primitive)
    useLinkStore().registerLink(graphScopeOf(graph), {
      id: toLinkId(999),
      graphId: graphScopeOf(graph).owningGraphId,
      originNodeId: primitive.id,
      originSlot: 0,
      targetNodeId: toNodeId(42),
      targetSlot: 0,
      type: '*'
    })
    primitive.configure(fromPartial({ widgets_values: [222] }))

    primitive.onAfterGraphConfigured()

    expect(primitive.widgets?.length).toBeFalsy()

    primitive.connect(0, target, 0)

    expect(primitive.widgets?.[0].value).toBe(222)
  })
})

describe('getWidgetConfig', () => {
  it('prefers the merged CONFIG over the slot definition', () => {
    const merged: InputSpec = ['INT', { min: 10, max: 20 }]
    const slot = widgetSlot(['INT', { min: 0, max: 100 }])
    slot.widget![CONFIG] = merged

    expect(getWidgetConfig(slot)).toEqual(merged)
  })

  it('falls back to the slot definition, then to a wildcard', () => {
    const declared: InputSpec = ['FLOAT', { step: 0.1 }]

    expect(getWidgetConfig(widgetSlot(declared))).toEqual(declared)
    expect(getWidgetConfig(fromPartial({ name: 'image' }))).toEqual(['*', {}])
  })
})

describe('mergeIfValid', () => {
  it('narrows a numeric range to the intersection and records it on the slot', () => {
    // The call shape used by groupNode.ts: `config1` is supplied explicitly and
    // the "slot" is a bare object whose `widget` is the spec itself.
    const spec: InputSpec = ['INT', { min: 0, max: 100 }]
    const output: Parameters<typeof mergeIfValid>[0] = fromAny({ widget: spec })

    const { customConfig } = mergeIfValid(
      output,
      ['INT', { min: 50, max: 200 }],
      false,
      undefined,
      spec
    )

    expect(customConfig).toEqual({ min: 50, max: 100, step: 1 })
    expect(output.widget![CONFIG]).toEqual(['INT', customConfig])
  })

  it('reads config1 from the slot when the caller omits it', () => {
    const output = widgetSlot(['INT', { min: 0, max: 10 }])

    const { customConfig } = mergeIfValid(output, ['INT', { min: 4, max: 10 }])

    expect(customConfig).toEqual({ min: 4, max: 10, step: 1 })
  })

  it('rejects disjoint ranges without touching the slot or recreating', () => {
    const output = widgetSlot(['INT', { min: 0, max: 10 }])
    const recreateWidget = vi.fn()

    const { customConfig } = mergeIfValid(
      output,
      ['INT', { min: 50, max: 60 }],
      false,
      recreateWidget
    )

    expect(customConfig).toEqual({})
    expect(output.widget![CONFIG]).toBeUndefined()
    expect(recreateWidget).not.toHaveBeenCalled()
  })

  it('recreates the widget on forceUpdate even when the merge fails', () => {
    const output = widgetSlot(['INT', { min: 0, max: 10 }])
    const recreateWidget = vi.fn()

    mergeIfValid(output, ['INT', { min: 50, max: 60 }], true, recreateWidget)

    expect(recreateWidget).toHaveBeenCalled()
    expect(output.widget![CONFIG]).toBeUndefined()
  })

  it('clamps the recreated widget into the merged range and notifies it', () => {
    const widget = fromPartial<IBaseWidget>({
      value: 5,
      options: { min: 10, max: 50 },
      callback: vi.fn()
    })
    const output = widgetSlot(['INT', { min: 0, max: 50 }])

    mergeIfValid(output, ['INT', { min: 10, max: 50 }], false, () => widget)

    expect(widget.value).toBe(10)
    expect(widget.callback).toHaveBeenCalledWith(10)
  })
})

describe('convertToInput', () => {
  it('warns and resolves the input slot hosting the widget', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const node = new LGraphNode('Target')
    node.addInput('seed', 'INT')
    node.addInput('steps', 'INT')
    node.inputs[1].widget = { name: 'steps' }

    expect(convertToInput(node, fromPartial({ name: 'steps' }))?.name).toBe(
      'steps'
    )
    expect(convertToInput(node, fromPartial({ name: 'seed' }))).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('remove call to convertToInput')
    )
  })
})

describe('setWidgetConfig', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    widgetInputsExtension.registerCustomNodes?.(app)
  })

  /** A primitive feeding a widget-backed input, as reroute/paste leave it. */
  function connectedPrimitive() {
    const graph = new LGraph()
    const target = new LGraphNode('Target')
    graph.add(target)
    target.addInput('value', 'INT')
    target.inputs[0].widget = { name: 'value' }

    const primitive = LiteGraph.createNode('PrimitiveNode')
    if (!(primitive instanceof PrimitiveNode)) throw new Error('not registered')
    graph.add(primitive)
    primitive.connect(0, target, 0)

    return { graph, primitive, slot: target.inputs[0] }
  }

  it('ignores slots that have no widget', () => {
    const slot = fromPartial<INodeInputSlot>({ name: 'image', type: 'IMAGE' })

    setWidgetConfig(slot, ['INT', {}])

    expect(slot.widget).toBeUndefined()
  })

  it('publishes the config through GET_CONFIG, and drops the widget without one', () => {
    const config: InputSpec = ['INT', { min: 0 }]
    const slot = fromPartial<INodeInputSlot>({ widget: { name: 'value' } })

    setWidgetConfig(slot, config)
    expect(slot.widget![GET_CONFIG]!()).toEqual(config)

    setWidgetConfig(slot)
    expect(slot.widget).toBeUndefined()
  })

  it('rebuilds the upstream primitive when a config arrives', () => {
    const { primitive, slot } = connectedPrimitive()
    const recreateWidget = vi.spyOn(primitive, 'recreateWidget')

    setWidgetConfig(slot, ['INT', { min: 0, max: 10 }])

    expect(recreateWidget).toHaveBeenCalled()
  })

  it('disconnects and resets the upstream primitive when the config is dropped', () => {
    const { graph, primitive, slot } = connectedPrimitive()
    primitive.outputs[0].type = 'INT'

    setWidgetConfig(slot, undefined)

    expect(primitive.isOutputConnected(0)).toBe(false)
    expect(primitive.outputs[0].type).toBe('*')
    expect(graph.getNodeById(primitive.id)).toBe(primitive)
  })

  it('leaves the upstream primitive connected while the graph is configuring', () => {
    const { primitive, slot } = connectedPrimitive()
    appState.configuringGraph = true

    setWidgetConfig(slot, undefined)

    expect(primitive.isOutputConnected(0)).toBe(true)
  })
})

describe('Comfy.WidgetInputs node-def hooks', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  describe('onGraphConfigured', () => {
    it('resolves GET_CONFIG from the node definition, chaining the original hook', async () => {
      const original = vi.fn()
      const TestNodeType = await applyNodeDefHooks((nodeType) => {
        nodeType.prototype.onGraphConfigured = original
      })
      TestNodeType.nodeData = fromPartial({
        input: { optional: { seed: ['INT', { min: 0, max: 8 }] } }
      })

      const node = new TestNodeType('Test')
      node.addInput('seed', 'INT')
      node.inputs[0].widget = { name: 'seed' }
      node.addWidget('number', 'seed', 0, () => {})

      node.onGraphConfigured?.()

      expect(original).toHaveBeenCalled()
      expect(node.inputs[0].widget![GET_CONFIG]!()).toEqual([
        'INT',
        { min: 0, max: 8 }
      ])
    })

    it('removes widget inputs that no longer have a backing widget', async () => {
      const TestNodeType = await applyNodeDefHooks()
      const node = new TestNodeType('Test')
      node.addInput('orphan', 'INT')
      node.inputs[0].widget = { name: 'orphan' }

      node.onGraphConfigured?.()

      expect(node.inputs).toHaveLength(0)
    })
  })

  describe('onConfigure', () => {
    it('restores GET_CONFIG on pasted nodes', async () => {
      const TestNodeType = await applyNodeDefHooks()
      TestNodeType.nodeData = fromPartial({
        input: { required: { steps: ['INT', { max: 50 }] } }
      })
      const node = new TestNodeType('Test')
      node.addInput('steps', 'INT')
      node.inputs[0].widget = { name: 'steps' }

      node.onConfigure?.(fromPartial({}))

      expect(node.inputs[0].widget![GET_CONFIG]!()).toEqual([
        'INT',
        { max: 50 }
      ])
    })

    it('defers to onGraphConfigured while a whole graph is loading', async () => {
      const TestNodeType = await applyNodeDefHooks()
      appState.configuringGraph = true
      const node = new TestNodeType('Test')
      node.addInput('steps', 'INT')
      node.inputs[0].widget = { name: 'steps' }

      node.onConfigure?.(fromPartial({}))

      expect(node.inputs[0].widget![GET_CONFIG]).toBeUndefined()
    })
  })

  describe('onInputDblClick', () => {
    beforeEach(() => {
      widgetInputsExtension.registerCustomNodes?.(app)
    })

    async function targetIn(graph: LGraph) {
      const TestNodeType = await applyNodeDefHooks()
      const node = new TestNodeType('Test')
      graph.add(node)
      node.pos = [400, 400]
      app.canvas.graph = graph
      return node
    }

    it('ignores inputs that are neither widget-backed nor widget-typed', async () => {
      const graph = new LGraph()
      const node = await targetIn(graph)
      node.addInput('image', 'IMAGE')

      node.onInputDblClick?.(0, fromPartial({}))

      expect(graph.nodes).toHaveLength(1)
    })

    it('attaches a titled primitive to a widget input', async () => {
      const graph = new LGraph()
      const node = await targetIn(graph)
      node.addInput('seed', 'INT')
      node.inputs[0].widget = { name: 'seed', [GET_CONFIG]: () => ['INT', {}] }

      node.onInputDblClick?.(0, fromPartial({}))

      const primitive = graph.nodes.find((n) => n instanceof PrimitiveNode)
      expect(primitive).toBeDefined()
      expect(primitive!.title).toBe('seed')
      expect(primitive!.isOutputConnected(0)).toBe(true)
      expect(primitive!.pos[0]).toBeLessThan(node.pos[0])
    })

    it('steps the primitive down past a node already occupying the slot', async () => {
      const graph = new LGraph()
      const node = await targetIn(graph)
      node.addInput('seed', 'INT')
      node.inputs[0].widget = { name: 'seed', [GET_CONFIG]: () => ['INT', {}] }

      const blocker = new LGraphNode('Blocker')
      graph.add(blocker)
      blocker.pos = [0, 400]
      blocker.size = [400, 20]
      blocker.updateArea()

      node.onInputDblClick?.(0, fromPartial({}))

      const primitive = graph.nodes.find((n) => n instanceof PrimitiveNode)
      expect(primitive!.pos[1]).toBeGreaterThan(node.pos[1])
    })
  })
})
