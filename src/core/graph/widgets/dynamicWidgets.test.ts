import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import { app } from '@/scripts/app'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useLitegraphService } from '@/services/litegraphService'
import type { HasInitialMinSize } from '@/services/litegraphService'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toLinkId } from '@/types/linkId'
import { applyDynamicInputs, dynamicWidgets } from './dynamicWidgets'

setActivePinia(createTestingPinia({ stubActions: false }))
type DynamicInputs = ('INT' | 'STRING' | 'IMAGE' | DynamicInputs)[][]
type TestAutogrowNode = LGraphNode & {
  comfyDynamic: { autogrow: Record<string, unknown> }
}

const { addNodeInput } = useLitegraphService()

beforeEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

function mockConfiguringGraph() {
  vi.spyOn(app, 'configuringGraph', 'get').mockReturnValue(true)
}

function nextTick() {
  return new Promise<void>((r) => requestAnimationFrame(() => r()))
}

function addDynamicCombo(node: LGraphNode, inputs: DynamicInputs) {
  const namePrefix = `${node.widgets?.length ?? 0}`
  function getSpec(
    inputs: DynamicInputs,
    depth: number = 0
  ): { key: string; inputs: object }[] {
    return inputs.map((group, groupIndex) => {
      const inputs = group.map((input, inputIndex) => [
        `${namePrefix}.${depth}.${inputIndex}`,
        Array.isArray(input)
          ? ['COMFY_DYNAMICCOMBO_V3', { options: getSpec(input, depth + 1) }]
          : [input, { tooltip: `${groupIndex}` }]
      ])
      return {
        key: `${groupIndex}`,
        inputs: { required: Object.fromEntries(inputs) }
      }
    })
  }
  const inputSpec: Required<InputSpec> = [
    'COMFY_DYNAMICCOMBO_V3',
    { options: getSpec(inputs) }
  ]
  addNodeInput(
    node,
    transformInputSpecV1ToV2(inputSpec, { name: namePrefix, isOptional: false })
  )
}
function addAutogrow(node: LGraphNode, template: unknown) {
  addNodeInput(
    node,
    transformInputSpecV1ToV2(['COMFY_AUTOGROW_V3', { template }], {
      name: `${node.inputs.length}`,
      isOptional: false
    })
  )
}
function addMatchType(
  node: LGraphNode,
  name: string,
  allowedTypes = '*',
  templateId = 'a'
) {
  addNodeInput(
    node,
    transformInputSpecV1ToV2(
      [
        'COMFY_MATCHTYPE_V3',
        { template: { allowed_types: allowedTypes, template_id: templateId } }
      ],
      { name, isOptional: false }
    )
  )
}
function connectInput(node: LGraphNode, inputIndex: number, graph: LGraph) {
  const node2 = testNode()
  node2.addOutput('out', '*')
  graph.add(node2)
  node2.connect(0, node, inputIndex)
}
function testNode() {
  const node: LGraphNode & Partial<HasInitialMinSize> = new LGraphNode('test')
  node.widgets = []
  node._initialMinSize = { width: 1, height: 1 }
  node.constructor.nodeData = {
    name: 'testnode'
  } as typeof node.constructor.nodeData
  return node as LGraphNode & Required<Pick<LGraphNode, 'widgets'>>
}

describe('Dynamic Combos', () => {
  test('Can add widget on selection', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['INT', 'STRING']])
    expect(node.widgets.length).toBe(2)
    node.widgets[0].value = '1'
    expect(node.widgets.length).toBe(3)
  })
  test('Can add nested widgets', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], [[[], ['STRING']]]])
    expect(node.widgets.length).toBe(2)
    node.widgets[0].value = '1'
    expect(node.widgets.length).toBe(2)
    node.widgets[1].value = '1'
    expect(node.widgets.length).toBe(3)
  })
  test('Can add input', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['IMAGE']])
    expect(node.widgets.length).toBe(2)
    node.widgets[0].value = '1'
    expect(node.widgets.length).toBe(1)
    expect(node.inputs.length).toBe(2)
    expect(node.inputs[1].type).toBe('IMAGE')
  })
  test('Dynamically added inputs are well ordered', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['IMAGE']])
    addDynamicCombo(node, [['INT'], ['IMAGE']])
    node.widgets[2].value = '1'
    node.widgets[0].value = '1'
    expect(node.widgets.length).toBe(2)
    expect(node.inputs.length).toBe(4)
    expect(node.inputs[1].name).toBe('0.0.0.0')
    expect(node.inputs[3].name).toBe('2.2.0.0')
  })
  test('Dynamically added widgets have tooltips', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['STRING']])
    expect.soft(node.widgets[1].tooltip).toBe('0')
    node.widgets[0].value = '1'
    expect.soft(node.widgets[1].tooltip).toBe('1')
  })

  test('throws for malformed dynamic combo specs before creating a widget', () => {
    const node = testNode()
    const comboApp = fromPartial<
      Parameters<typeof dynamicWidgets.COMFY_DYNAMICCOMBO_V3>[3]
    >({ widgets: { COMBO: vi.fn() } })

    expect(() =>
      dynamicWidgets.COMFY_DYNAMICCOMBO_V3(
        node,
        'bad',
        ['COMFY_DYNAMICCOMBO_V3', {}] as InputSpec,
        comboApp
      )
    ).toThrow('invalid DynamicCombo spec')
    expect(comboApp.widgets.COMBO).not.toHaveBeenCalled()
  })

  test('clears grouped widgets when selection becomes empty', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['INT', 'STRING']])
    node.widgets[0].value = '1'
    const onRemove = vi.fn()
    node.widgets[1].onRemove = onRemove

    node.widgets[0].value = undefined

    expect(onRemove).toHaveBeenCalled()
    expect(node.widgets).toHaveLength(1)
  })

  test('deletes widget state when removing grouped dynamic widgets', () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addDynamicCombo(node, [['INT'], ['STRING']])
    const childWidget = node.widgets[1]
    const childWidgetId = childWidget.widgetId
    if (!childWidgetId) throw new Error('Missing child widget id')
    const deleteWidget = vi.mocked(useWidgetValueStore().deleteWidget)

    node.widgets[0].value = undefined

    expect(deleteWidget).toHaveBeenCalledWith(childWidgetId)
  })

  test('preserves an existing dynamic input link when refreshing a selection', () => {
    const graph = new LGraph()
    const node = testNode()
    const onConnectionsChange = vi.fn()
    node.onConnectionsChange = onConnectionsChange
    graph.add(node)
    addDynamicCombo(node, [['IMAGE'], ['STRING']])
    node.widgets[0].value = '0'

    connectInput(node, 1, graph)
    const linkId = node.inputs[1].link
    expect(linkId).not.toBeNull()
    onConnectionsChange.mockClear()

    node.widgets[0].value = '0'

    expect(node.inputs[1].link).toBe(linkId)
    expect(graph.links[linkId!].target_slot).toBe(1)
    expect(onConnectionsChange).toHaveBeenCalledWith(
      LiteGraph.INPUT,
      1,
      true,
      graph.links[linkId!],
      node.inputs[1]
    )
  })

  test('throws if the backing widgets array disappears during update', () => {
    const node: LGraphNode = testNode()
    addDynamicCombo(node, [['INT'], ['STRING']])
    const controller = node.widgets![0]
    node.widgets = undefined

    expect(() => {
      controller.value = '1'
    }).toThrow('Not Reachable')
  })

  test('throws when the dynamic controller widget is missing during update', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['STRING']])
    const controller = node.widgets[0]
    node.widgets = node.widgets.slice(1)

    expect(() => {
      controller.value = '1'
    }).toThrow("Dynamic widget doesn't exist on node")
  })

  test('throws when input-only dynamic sockets have no insertion point', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['IMAGE']])
    const controller = node.widgets[0]
    node.inputs = []

    expect(() => {
      controller.value = '1'
    }).toThrow('Failed to find input socket for 0')
  })

  test('updates dynamic inputs without requiring a graph', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['IMAGE']])

    node.widgets[0].value = '1'

    expect(node.inputs[1].type).toBe('IMAGE')
  })

  test('reads dynamic combo values from widget state when available', () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addDynamicCombo(node, [['INT'], ['STRING']])
    const controller = node.widgets[0]
    const controllerId = controller.widgetId
    if (!controllerId) throw new Error('Missing controller widget id')

    controller.value = '1'
    useWidgetValueStore().setValue(controllerId, '0')

    expect(controller.value).toBe('0')
  })
})

describe('Dynamic input dispatch', () => {
  test('returns false for unknown dynamic input types', () => {
    const node = testNode()

    expect(
      applyDynamicInputs(node, {
        name: 'plain',
        type: 'STRING',
        isOptional: false
      })
    ).toBe(false)
  })

  test('returns true after applying a known dynamic input type', () => {
    const node = testNode()

    expect(
      applyDynamicInputs(
        node,
        transformInputSpecV1ToV2(
          [
            'COMFY_AUTOGROW_V3',
            { template: { input: { required: { image: ['IMAGE', {}] } } } }
          ],
          { name: 'grow', isOptional: false }
        )
      )
    ).toBe(true)
  })

  test('throws when an autogrow input spec is malformed', () => {
    const node = testNode()
    const inputSpec = {
      name: 'bad',
      type: 'COMFY_AUTOGROW_V3'
    } as InputSpecV2

    expect(() => addNodeInput(node, inputSpec)).toThrow('invalid Autogrow spec')
  })

  test('ignores malformed match type specs', () => {
    const node = testNode()

    expect(
      applyDynamicInputs(node, {
        name: 'bad',
        type: 'COMFY_MATCHTYPE_V3',
        isOptional: false
      })
    ).toBe(true)
    expect(node.inputs).toHaveLength(0)
  })
})

describe('MatchType inputs', () => {
  function createMatchTypeNode(graph: LGraph, outputMatchTypes = ['a']) {
    const node = testNode()
    node.constructor.nodeData = {
      name: 'testnode',
      output_matchtypes: outputMatchTypes
    } as typeof node.constructor.nodeData
    node.addOutput('out', '*')
    graph.add(node)
    addMatchType(node, 'on_true')
    addMatchType(node, 'on_false')
    return node
  }

  function createSourceNode(graph: LGraph, type: string) {
    const node = testNode()
    node.addOutput('out', type)
    graph.add(node)
    return node
  }

  test('ignores match type notifications outside registered inputs', () => {
    const graph = new LGraph()
    const node = createMatchTypeNode(graph)
    node.addInput('plain', 'STRING')

    node.onConnectionsChange?.(LiteGraph.OUTPUT, 0, true, null, node.inputs[0])
    node.onConnectionsChange?.(LiteGraph.INPUT, 2, true, null, node.inputs[2])

    expect(node.outputs[0].type).toBe('*')
  })

  test('uses wildcard types for stale match type links', () => {
    const graph = new LGraph()
    const node = createMatchTypeNode(graph)
    node.inputs[0].link = toLinkId(999)

    node.onConnectionsChange?.(LiteGraph.INPUT, 1, false, null, node.inputs[1])

    expect(node.outputs[0].type).toBe('*')
  })

  test('leaves unmatched output groups unchanged', () => {
    const graph = new LGraph()
    const node = createMatchTypeNode(graph, ['other'])
    const source = createSourceNode(graph, 'IMAGE')

    source.connect(0, node, 0)

    expect(node.outputs[0].type).toBe('*')
  })

  test('throws when match group input constraints cannot overlap', () => {
    const graph = new LGraph()
    const node = testNode()
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => 1)
    node.constructor.nodeData = {
      name: 'testnode',
      output_matchtypes: ['a']
    } as typeof node.constructor.nodeData
    node.addOutput('out', '*')
    graph.add(node)
    addMatchType(node, 'image', 'IMAGE')
    addMatchType(node, 'latent', 'LATENT')
    const source = createSourceNode(graph, 'IMAGE')

    try {
      expect(() => source.connect(0, node, 0)).toThrow('invalid connection')
    } finally {
      requestAnimationFrameSpy.mockRestore()
    }
  })

  test('disconnects downstream links when a match type output narrows', () => {
    const graph = new LGraph()
    const node = createMatchTypeNode(graph)
    const downstream = testNode()
    downstream.addInput('latent', 'LATENT')
    downstream.onConnectionsChange = vi.fn()
    graph.add(downstream)
    node.connect(0, downstream, 0)
    const source = createSourceNode(graph, 'IMAGE')

    source.connect(0, node, 0)

    expect(downstream.inputs[0].link).toBeNull()
    expect(downstream.onConnectionsChange).toHaveBeenCalledWith(
      LiteGraph.INPUT,
      0,
      false,
      expect.anything(),
      downstream.inputs[0]
    )
  })

  test('ignores deferred match type refresh after the input is removed', () => {
    const graph = new LGraph()
    const node = testNode()
    const rafCallbacks: FrameRequestCallback[] = []
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        rafCallbacks.push(callback)
        return rafCallbacks.length
      })
    graph.add(node)

    try {
      addMatchType(node, 'removed')
      node.inputs.pop()
      rafCallbacks[0]?.(0)

      expect(node.inputs).toHaveLength(0)
    } finally {
      requestAnimationFrameSpy.mockRestore()
    }
  })
})

describe('Autogrow', () => {
  const inputsSpec = { required: { image: ['IMAGE', {}] } }
  test('Can name by prefix', () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { input: inputsSpec, prefix: 'test' })
    connectInput(node, 0, graph)
    connectInput(node, 1, graph)
    connectInput(node, 2, graph)
    expect(node.inputs.length).toBe(4)
    expect(node.inputs[0].name).toBe('0.test0')
    expect(node.inputs[2].name).toBe('0.test2')
  })
  test('Can name by list of names', () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { input: inputsSpec, names: ['a', 'b', 'c'] })
    connectInput(node, 0, graph)
    connectInput(node, 1, graph)
    connectInput(node, 2, graph)
    expect(node.inputs.length).toBe(3)
    expect(node.inputs[0].name).toBe('0.a')
    expect(node.inputs[2].name).toBe('0.c')
  })
  test('Can add autogrow with min input count', () => {
    const node = testNode()
    addAutogrow(node, { min: 4, input: inputsSpec })
    expect(node.inputs.length).toBe(5)
  })
  test('Adding connections will cause growth up to max', () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'test', max: 3 })
    expect(node.inputs.length).toBe(2)

    connectInput(node, 0, graph)
    expect(node.inputs.length).toBe(2)
    connectInput(node, 1, graph)
    expect(node.inputs.length).toBe(3)
    connectInput(node, 2, graph)
    expect(node.inputs.length).toBe(3)
  })

  test('ignores autogrow notifications that cannot affect a known input group', () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'test' })
    const inputCount = node.inputs.length
    const unknownInput = node.addInput('outside.0', 'IMAGE')

    node.onConnectionsChange?.(LiteGraph.OUTPUT, 0, true, null, node.inputs[0])
    node.onConnectionsChange?.(LiteGraph.INPUT, 99, true, null, node.inputs[0])
    node.onConnectionsChange?.(LiteGraph.INPUT, 2, true, null, unknownInput)

    expect(node.inputs).toHaveLength(inputCount + 1)
  })

  test('does not grow autogrow inputs when connection metadata is missing', () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'test' })

    node.onConnectionsChange?.(LiteGraph.INPUT, 1, true, null, node.inputs[1])

    expect(node.inputs).toHaveLength(2)
  })

  test('keeps minimum autogrow rows when disconnecting early ordinals', async () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { min: 2, input: inputsSpec, prefix: 'test' })

    node.onConnectionsChange?.(LiteGraph.INPUT, 0, false, null, node.inputs[0])
    await nextTick()

    expect(node.inputs).toHaveLength(3)
  })

  test('restores a configure-time autogrow widget shim', () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'test' })
    node.inputs[1].widget = { name: node.inputs[1].name }
    mockConfiguringGraph()

    connectInput(node, 1, graph)

    expect(node.widgets.some((widget) => widget.name === '0.test1')).toBe(true)
  })

  test('draws configure-time autogrow shim text from the input name', () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'test' })
    node.inputs[1].widget = { name: node.inputs[1].name }
    mockConfiguringGraph()

    connectInput(node, 1, graph)
    const shim = node.widgets.find((widget) => widget.name === '0.test1')
    if (!shim?.draw) throw new Error('Missing shim widget')
    node.inputs[1].label = undefined
    const ctx = fromPartial<CanvasRenderingContext2D>({
      save: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn()
    })

    shim.draw(ctx, node, 100, 10, 20)

    expect(ctx.fillText).toHaveBeenCalledWith('0.test1', 20, 25)
  })

  test('keeps an existing configure-time autogrow widget shim', () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'test' })
    node.inputs[1].widget = { name: node.inputs[1].name }
    node.widgets.push({
      name: node.inputs[1].name,
      type: 'shim',
      y: 0,
      options: {},
      serialize: false,
      draw: vi.fn()
    })
    mockConfiguringGraph()

    connectInput(node, 1, graph)

    expect(
      node.widgets.filter((widget) => widget.name === '0.test1')
    ).toHaveLength(1)
  })

  test('defers disconnect handling during an input swap', () => {
    const graph = new LGraph()
    const node = testNode()
    const rafCallbacks: FrameRequestCallback[] = []
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        rafCallbacks.push(callback)
        return rafCallbacks.length
      })
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'test' })

    try {
      connectInput(node, 0, graph)
      node.disconnectInput(0)

      expect(node.inputs).toHaveLength(2)
      expect(rafCallbacks).toHaveLength(2)
    } finally {
      requestAnimationFrameSpy.mockRestore()
    }
  })

  test('stops cleanup for uneven multi-input autogrow groups', async () => {
    const graph = new LGraph()
    const node = testNode()
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    graph.add(node)
    addAutogrow(node, {
      min: 1,
      input: { required: { image: ['IMAGE', {}], mask: ['MASK', {}] } }
    })
    node.inputs.pop()

    try {
      node.onConnectionsChange?.(
        LiteGraph.INPUT,
        0,
        false,
        null,
        node.inputs[0]
      )
      await nextTick()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to group multi-input autogrow inputs'
      )
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })

  test('keeps trailing autogrow row when disconnecting the last slot', async () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'test' })

    node.onConnectionsChange?.(LiteGraph.INPUT, 1, false, null, node.inputs[1])
    await nextTick()

    expect(node.inputs.map((input) => input.name)).toEqual([
      '0.test0',
      '0.test1'
    ])
  })

  test('ignores named autogrow input names outside the configured list', async () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, names: ['a', 'b'] })
    const unknownInput = node.addInput('0.c', 'IMAGE')

    node.onConnectionsChange?.(
      LiteGraph.INPUT,
      node.inputs.length - 1,
      false,
      null,
      unknownInput
    )
    await nextTick()

    expect(node.inputs.map((input) => input.name)).toEqual([
      '0.a',
      '0.b',
      '0.c'
    ])
  })

  test('ignores autogrow input names without numeric ordinals', async () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'test' })
    const unknownInput = node.addInput('0.testx', 'IMAGE')

    node.onConnectionsChange?.(
      LiteGraph.INPUT,
      node.inputs.length - 1,
      false,
      null,
      unknownInput
    )
    await nextTick()

    expect(node.inputs.map((input) => input.name)).toEqual([
      '0.test0',
      '0.test1',
      '0.testx'
    ])
  })

  test('marks optional autogrow inputs as optional after required inputs', () => {
    const node = testNode()

    addAutogrow(node, {
      min: 1,
      input: {
        required: { image: ['IMAGE', {}] },
        optional: { mask: ['MASK', {}] }
      }
    })

    expect(node.inputs.map((input) => input.name)).toEqual([
      '0.image0',
      '0.mask0',
      '0.image1',
      '0.mask1'
    ])
    expect(node.inputs.map((input) => input.type)).toEqual([
      'IMAGE',
      'MASK',
      'IMAGE',
      'MASK'
    ])
  })
  test('Removing connections decreases to min + 1', async () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { min: 4, input: inputsSpec, prefix: 'test' })
    connectInput(node, 3, graph)
    connectInput(node, 4, graph)
    connectInput(node, 5, graph)
    expect(node.inputs.length).toBe(7)

    node.disconnectInput(4)
    await nextTick()
    expect(node.inputs.length).toBe(6)
    node.disconnectInput(3)
    await nextTick()
    expect(node.inputs.length).toBe(5)

    connectInput(node, 0, graph)
    expect(node.inputs.length).toBe(5)
    node.disconnectInput(0)
    await nextTick()
    expect(node.inputs.length).toBe(5)
  })
  test('Removing a connection ignores stale autogrow callbacks after group removal', () => {
    const graph = new LGraph()
    const node = testNode() as TestAutogrowNode
    const onConnectionsChange = vi.fn()
    node.onConnectionsChange = onConnectionsChange
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'test' })

    const rafCallbacks: FrameRequestCallback[] = []
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        rafCallbacks.push(callback)
        return rafCallbacks.length
      })

    try {
      connectInput(node, 0, graph)
      expect(node.inputs.length).toBe(2)

      rafCallbacks.shift()?.(0)

      node.disconnectInput(0)

      const staleDisconnectCallback = rafCallbacks.shift()
      expect(staleDisconnectCallback).toBeDefined()

      delete node.comfyDynamic.autogrow['0']

      const callbackCountBeforeFlush = onConnectionsChange.mock.calls.length
      staleDisconnectCallback?.(0)

      expect(onConnectionsChange).toHaveBeenCalledTimes(
        callbackCountBeforeFlush
      )
    } finally {
      requestAnimationFrameSpy.mockRestore()
    }
  })
  test('Multi-group autogrow shifts second group indices on first group growth', () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)

    const imageSpec = { required: { image: ['IMAGE', {}] } }
    const videoSpec = { required: { video: ['VIDEO', {}] } }
    addAutogrow(node, { min: 1, input: imageSpec, prefix: 'img' })
    addAutogrow(node, { min: 1, input: videoSpec, prefix: 'vid' })

    expect(node.inputs.map((i) => i.name)).toStrictEqual([
      '0.img0',
      '0.img1',
      '2.vid0',
      '2.vid1'
    ])

    connectInput(node, 1, graph)
    expect(node.inputs.map((i) => i.name)).toStrictEqual([
      '0.img0',
      '0.img1',
      '0.img2',
      '2.vid0',
      '2.vid1'
    ])

    const vid0Index = node.inputs.findIndex((i) => i.name === '2.vid0')
    expect(vid0Index).toBe(3)

    connectInput(node, vid0Index, graph)
    const vid0Link = node.inputs[vid0Index].link
    expect(vid0Link).not.toBeNull()
    expect(graph.links[vid0Link!].target_slot).toBe(vid0Index)
  })

  test('removes shim widgets when multi-input autogrow rows shrink', async () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, {
      min: 1,
      input: { required: { image: ['IMAGE', {}], mask: ['MASK', {}] } }
    })
    connectInput(node, 2, graph)
    await nextTick()
    expect(node.inputs).toHaveLength(6)

    const removedWidgetNames = ['0.image2', '0.mask2']
    const onRemove = vi.fn()
    for (const widget of node.widgets.filter((widget) =>
      removedWidgetNames.includes(widget.name)
    )) {
      widget.onRemove = onRemove
    }

    node.disconnectInput(2)
    await nextTick()

    expect(node.inputs.map((input) => input.name)).toEqual([
      '0.image0',
      '0.mask0',
      '0.image1',
      '0.mask1'
    ])
    expect(onRemove).toHaveBeenCalledTimes(2)
    expect(
      node.widgets.some((widget) => removedWidgetNames.includes(widget.name))
    ).toBe(false)
  })

  test('Can deserialize a complex node', async () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'a' })
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'b' })
    addNodeInput(node, { name: 'aa', isOptional: false, type: 'IMAGE' })

    connectInput(node, 0, graph)
    connectInput(node, 1, graph)
    connectInput(node, 3, graph)
    connectInput(node, 4, graph)

    const serialized = graph.serialize()
    graph.clear()
    graph.configure(serialized)
    const newNode = graph.nodes[0]!

    expect(newNode.inputs.map((i) => i.name)).toStrictEqual([
      '0.a0',
      '0.a1',
      '0.a2',
      '2.b0',
      '2.b1',
      '2.b2',
      'aa'
    ])
  })
})
