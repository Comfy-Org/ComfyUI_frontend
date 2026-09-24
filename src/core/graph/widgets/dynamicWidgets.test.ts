import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import {
  addAutogrow,
  addDynamicCombo
} from '@/core/graph/widgets/__fixtures__/dynamicInputHelpers'
import { liveAutogrowGroupOf } from '@/core/graph/widgets/dynamicWidgets'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { realignGroupWidgetChildLinks } from '@/lib/litegraph/src/linkDeduplication'
import type { SerialisableGraph } from '@/lib/litegraph/src/types/serialisation'
import type {
  ComfyNodeDef as ComfyNodeDefV1,
  InputSpec
} from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'
import { useLinkStore } from '@/stores/linkStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

const originalNamedValuesRestore = LiteGraph.namedValuesRestore
afterEach(() => {
  LiteGraph.namedValuesRestore = originalNamedValuesRestore
})
type TestAutogrowNode = LGraphNode & {
  comfyDynamic: { autogrow: Record<string, unknown> }
}

let addNodeInput: ReturnType<typeof useLitegraphService>['addNodeInput']
beforeEach(() => {
  ;({ addNodeInput } = useLitegraphService())
})

function nextTick() {
  return new Promise<void>((r) => requestAnimationFrame(() => r()))
}

function connectInput(node: LGraphNode, inputIndex: number, graph: LGraph) {
  const node2 = testNode()
  node2.addOutput('out', '*')
  graph.add(node2)
  const link = node2.connect(0, node, inputIndex)
  if (!link) throw new Error(`failed to connect input ${inputIndex}`)
  return link
}
function testNode() {
  const node = new LGraphNode('test')
  node.widgets = []
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
  test('liveAutogrowGroupOf reports a DynamicCombo key with an all-numeric final segment as belonging to no autogrow group', () => {
    // `0.0.0.0` is indistinguishable from a genuine autogrow ordinal by
    // name shape alone (see `nameShapeAutogrowGroupOf`'s documented false
    // positive) -- `liveAutogrowGroupOf` must not be fooled by it, since
    // this node has no `comfyDynamic.autogrow` group at all.
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['IMAGE']])
    addDynamicCombo(node, [['INT'], ['IMAGE']])
    node.widgets[2].value = '1'
    node.widgets[0].value = '1'
    expect(node.inputs[1].name).toBe('0.0.0.0')
    expect(liveAutogrowGroupOf(node, '0.0.0.0')).toBeUndefined()
  })
  test('Shrinking dynamic inputs preserves remaining connections and disconnects removed links', () => {
    const graph = new LGraph()
    const node = testNode()
    addDynamicCombo(node, [[], ['IMAGE', 'IMAGE', 'IMAGE'], ['IMAGE']])
    graph.add(node)
    addNodeInput(node, { name: 'other', isOptional: false, type: 'IMAGE' })
    node.widgets[0].value = '1'
    const retained = connectInput(node, 1, graph)
    const removed = [connectInput(node, 2, graph), connectInput(node, 3, graph)]
    const removedSources = removed.map((link) =>
      graph.getNodeById(link.origin_id)
    )
    const unrelated = connectInput(node, 4, graph)
    const onConnectionsChange =
      vi.fn<NonNullable<LGraphNode['onConnectionsChange']>>()
    node.onConnectionsChange = onConnectionsChange

    node.widgets[0].value = '2'

    expect(node.getInputLink(1)).toBe(retained)
    expect(node.getInputLink(2)).toBe(unrelated)
    for (const link of removed) {
      expect(graph.getLink(link.id)).toBeUndefined()
    }
    for (const source of removedSources) {
      if (!source) throw new Error('Removed link source node not found')
      expect(source.isOutputConnected(0)).toBe(false)
    }
    const disconnectedLinks = onConnectionsChange.mock.calls
      .filter(([, , connected]) => !connected)
      .map(([, , , link]) => link)
    expect(disconnectedLinks).toHaveLength(2)
    expect(new Set(disconnectedLinks)).toEqual(new Set(removed))
  })
  test('Growing rebuild preserves retained connections', () => {
    const graph = new LGraph()
    const node = testNode()
    addDynamicCombo(node, [[], ['IMAGE'], ['IMAGE', 'IMAGE']])
    graph.add(node)
    addNodeInput(node, { name: 'other', isOptional: false, type: 'IMAGE' })
    node.widgets[0].value = '1'
    const retained = connectInput(node, 1, graph)
    const unrelated = connectInput(node, 2, graph)

    node.widgets[0].value = '2'

    expect(node.getInputLink(1)).toBe(retained)
    expect(node.getInputLink(3)).toBe(unrelated)
  })
  test('Replacing a linked input emits one connected callback', () => {
    const graph = new LGraph()
    const node = testNode()
    addDynamicCombo(node, [[], ['IMAGE'], ['IMAGE']])
    graph.add(node)
    node.widgets[0].value = '1'
    const link = connectInput(node, 1, graph)
    const onConnectionsChange = vi.fn()
    node.onConnectionsChange = onConnectionsChange

    node.widgets[0].value = '2'

    expect(onConnectionsChange).toHaveBeenCalledOnce()
    expect(onConnectionsChange).toHaveBeenCalledWith(
      LiteGraph.INPUT,
      1,
      true,
      link,
      node.inputs[1]
    )
  })
  test('Restoring serialised state preserves the saved node height', () => {
    const node = testNode()
    node.serialize_widgets = true
    addDynamicCombo(node, [['INT'], ['INT', 'STRING']])
    node.widgets[0].value = '1'
    node.setSize([node.size[0], 500])
    const data = node.serialize()

    const restored = testNode()
    addDynamicCombo(restored, [['INT'], ['INT', 'STRING']])
    restored.configure(data)

    expect(restored.widgets[0].value).toBe('1')
    expect(restored.widgets.length).toBe(3)
    expect(restored.size[1]).toBe(500)
  })
  test('Interactive combo selection still refits the node height', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['INT', 'STRING']])
    node.setSize([node.size[0], 500])
    node.widgets[0].value = '1'
    node.widgets[0].callback?.('1')
    expect(node.size[1]).toBeLessThan(500)
  })
  test('Dynamically added widgets have tooltips', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['STRING']])
    expect.soft(node.widgets[1].tooltip).toBe('0')
    node.widgets[0].value = '1'
    expect.soft(node.widgets[1].tooltip).toBe('1')
  })
  test('An edited nested value survives toggling the combo away and back after load (#16006)', () => {
    LiteGraph.namedValuesRestore = true
    const node = testNode()
    node.serialize_widgets = true
    addDynamicCombo(node, [['INT'], ['INT']])

    node.widgets[0].value = '1'
    node.widgets[1].value = 0.8
    const serialized = node.serialize()

    const reloaded = testNode()
    addDynamicCombo(reloaded, [['INT'], ['INT']])
    reloaded.configure(serialized)
    expect(reloaded.widgets[1].value).toBe(0.8)

    reloaded.widgets[1].value = 0.3

    reloaded.widgets[0].value = '0'
    reloaded.widgets[0].value = '1'

    expect(reloaded.widgets[1].value).toBe(0.3)
  })
  test('Same-name children keep separate values across options', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['INT']])

    node.widgets[1].value = 3
    node.widgets[0].value = '1'
    expect(node.widgets[1].value).not.toBe(3)
    node.widgets[1].value = 7

    node.widgets[0].value = '0'
    expect(node.widgets[1].value).toBe(3)
    node.widgets[0].value = '1'
    expect(node.widgets[1].value).toBe(7)
    node.widgets[0].value = '0'
    expect(node.widgets[1].value).toBe(3)
  })
  test('Nested child keeps its value when its parent option is recreated', () => {
    const node = testNode()
    addDynamicCombo(node, [[[[], ['INT']]], ['INT']])
    node.widgets[1].value = '1'
    node.widgets[2].value = 7

    node.widgets[0].value = '1'
    node.widgets[0].value = '0'

    expect(node.widgets[1].value).toBe('1')
    expect(node.widgets[2].value).toBe(7)
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
  test('liveAutogrowGroupOf recognizes an explicit-names member even though it does not end in a digit', () => {
    // `0.b` does not end in an ordinal digit, so
    // `nameShapeAutogrowGroupOf` cannot recognize it (see its documented
    // false negative) -- `liveAutogrowGroupOf` must, since this node's
    // `comfyDynamic.autogrow['0']` really does own it.
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { input: inputsSpec, names: ['a', 'b', 'c'] })
    connectInput(node, 0, graph)
    connectInput(node, 1, graph)
    expect(node.inputs[1].name).toBe('0.b')
    expect(liveAutogrowGroupOf(node, '0.b')).toBe('0')
    expect(liveAutogrowGroupOf(node, 'unrelated.b')).toBeUndefined()
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
  test(
    'Disconnecting a just-connected slot still compacts to one spare slot ' +
      '(PM-1496)',
    async () => {
      const graph = new LGraph()
      const node = testNode()
      graph.add(node)
      addAutogrow(node, {
        min: 0,
        input: inputsSpec,
        names: ['image_1', 'image_2', 'image_3', 'image_4']
      })

      connectInput(node, 0, graph)
      await nextTick()
      connectInput(node, 1, graph)

      node.disconnectInput(1)
      await nextTick()
      await nextTick()

      expect(node.inputs.map((i) => i.name)).toEqual(['0.image_1', '0.image_2'])
      expect(node.isInputConnected(0)).toBe(true)
      expect(node.isInputConnected(1)).toBe(false)
      expect(node.getInputLink(0)?.target_slot).toBe(0)
    }
  )
  test(
    'A same-slot swap in progress does not drop a genuine connect on a ' +
      'different slot of the same node (PM-1496)',
    async () => {
      const graph = new LGraph()
      const node = testNode()
      graph.add(node)
      addAutogrow(node, {
        min: 0,
        input: inputsSpec,
        names: ['image_1', 'image_2', 'image_3', 'image_4']
      })

      connectInput(node, 0, graph)
      await nextTick()

      const oldLink = node.getInputLink(0)
      const swapSource = testNode()
      swapSource.addOutput('out', '*')
      graph.add(swapSource)
      node.onConnectInput?.(
        0,
        swapSource.outputs[0].type,
        swapSource.outputs[0],
        swapSource,
        0
      )
      node.onConnectionsChange?.(
        LiteGraph.INPUT,
        0,
        false,
        oldLink,
        node.inputs[0]
      )

      connectInput(node, 1, graph)
      await nextTick()

      expect(node.inputs.map((i) => i.name)).toEqual([
        '0.image_1',
        '0.image_2',
        '0.image_3'
      ])
    }
  )
  test(
    'A genuine occupied-slot replacement via connectSlots does not drop a ' +
      'concurrent connect on a different slot (PM-1496)',
    async () => {
      const graph = new LGraph()
      const node = testNode()
      graph.add(node)
      addAutogrow(node, {
        min: 0,
        input: inputsSpec,
        names: ['image_1', 'image_2', 'image_3', 'image_4']
      })

      connectInput(node, 0, graph)
      await nextTick()
      expect(node.inputs.map((i) => i.name)).toEqual(['0.image_1', '0.image_2'])

      const oldLink = node.getInputLink(0)
      assert.exists(oldLink)
      const oldSource = graph.getNodeById(oldLink.origin_id)

      //connectSlots (LGraphNode.ts) fires slot 0's disconnect (the swap's
      //tail) and its matching connect synchronously, back to back, while
      //replacing slot 0's link below. Chaining onto onConnectionsChange -
      //the same public extension point real custom nodes use - lets a
      //second, genuine connect land on a different slot in that exact
      //window, without faking either connection.
      let sawSwapTail = false
      node.onConnectionsChange = useChainCallback(
        node.onConnectionsChange,
        (contype, slot, iscon) => {
          if (contype !== LiteGraph.INPUT || slot !== 0 || iscon) return
          sawSwapTail = true
          connectInput(node, 1, graph)
        }
      )

      const replacement = testNode()
      replacement.addOutput('out', '*')
      graph.add(replacement)
      const newLink = replacement.connect(0, node, 0)
      assert.exists(newLink)

      expect(sawSwapTail).toBe(true)
      expect(node.getInputLink(0)).toBe(newLink)
      expect(oldSource?.isOutputConnected(0)).toBe(false)

      await nextTick()
      await nextTick()

      expect(node.inputs.map((i) => i.name)).toEqual([
        '0.image_1',
        '0.image_2',
        '0.image_3'
      ])
    }
  )
  test(
    'A slot reconnected before its deferred disconnect compaction runs ' +
      'keeps the new link',
    async () => {
      const graph = new LGraph()
      const node = testNode()
      graph.add(node)
      addAutogrow(node, {
        min: 0,
        input: inputsSpec,
        names: ['image_1', 'image_2', 'image_3', 'image_4']
      })

      connectInput(node, 0, graph)
      await nextTick()

      connectInput(node, 1, graph)
      node.disconnectInput(1)
      const reconnectLink = connectInput(node, 1, graph)

      await nextTick()
      await nextTick()

      expect(node.getInputLink(1)).toBe(reconnectLink)
      expect(node.isInputConnected(1)).toBe(true)
      expect(graph.getLink(reconnectLink.id)).toBe(reconnectLink)
      const sourceNode = graph.getNodeById(reconnectLink.origin_id)
      expect(sourceNode?.isOutputConnected(0)).toBe(true)
    }
  )
  test('Autogrow compaction never emits a negative input slot', async () => {
    const graph = new LGraph()
    const node = testNode()
    const onConnectionsChange = vi.fn()
    node.onConnectionsChange = onConnectionsChange
    graph.add(node)
    addAutogrow(node, { min: 4, input: inputsSpec, prefix: 'test' })
    connectInput(node, 3, graph)
    connectInput(node, 4, graph)
    connectInput(node, 5, graph)
    onConnectionsChange.mockClear()

    node.disconnectInput(4)
    await nextTick()

    const inputCalls = onConnectionsChange.mock.calls.filter(
      ([type]) => type === LiteGraph.INPUT
    )
    expect(inputCalls.every(([, slot]) => slot >= 0)).toBe(true)
    expect(inputCalls.filter(([, , connected]) => !connected)).toHaveLength(1)
  })
  test('Rejected autogrow compaction preserves its input layout', async () => {
    const graph = new LGraph()
    const node = testNode()
    const onConnectionsChange = vi.fn()
    node.onConnectionsChange = onConnectionsChange
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'test' })
    connectInput(node, 0, graph)
    connectInput(node, 1, graph)
    connectInput(node, 2, graph)
    const updateEndpoints = vi
      .spyOn(useLinkStore(), 'updateEndpoints')
      .mockReturnValue({
        ok: false,
        error: { code: 'occupied-target', message: 'Target is occupied' }
      })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    node.disconnectInput(1)
    const inputNames = node.inputs.map(({ name }) => name)
    const widgetNames = node.widgets.map(({ name }) => name)
    onConnectionsChange.mockClear()
    await nextTick()

    expect(updateEndpoints).toHaveBeenCalled()
    expect(node.inputs.map(({ name }) => name)).toEqual(inputNames)
    expect(node.widgets.map(({ name }) => name)).toEqual(widgetNames)
    expect(onConnectionsChange).not.toHaveBeenCalled()
    consoleError.mockRestore()
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
    const newNode = graph.nodes[0]

    expect(newNode.inputs.map((i) => i.name)).toStrictEqual([
      '0.a0',
      '0.a1',
      '0.a2',
      '2.b0',
      '2.b1',
      '2.b2',
      'aa'
    ])
    for (const slot of [0, 1, 3, 4]) {
      expect.soft(newNode.isInputConnected(slot)).toBe(true)
      expect.soft(newNode.getInputLink(slot)?.target_slot).toBe(slot)
    }
    for (const slot of [2, 5, 6]) {
      expect.soft(newNode.isInputConnected(slot)).toBe(false)
    }
  })
})

const RESIZE_NODE_TYPE = 'test/ResizeImageMask'
const SOURCE_NODE_TYPE = 'test/MultiplierSource'

class SourceNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'Source')
    this.addOutput('out', 'FLOAT')
  }
}

type ChildInputs = Record<string, InputSpec>

type ComboOption = [key: string, childInputs: ChildInputs]

function dynamicCombo(
  defaultOption: ComboOption,
  ...remainingOptions: ComboOption[]
): InputSpec {
  const options = [defaultOption, ...remainingOptions]
  const declaredKeys = options.map(([key]) => key)
  const realizedKeys = Object.keys(
    Object.fromEntries(declaredKeys.map((key) => [key, null]))
  )
  if (realizedKeys.length !== declaredKeys.length)
    throw new Error(
      `Duplicate option keys: ${declaredKeys.filter((key, index) => declaredKeys.indexOf(key) !== index).join(', ')}`
    )
  if (realizedKeys.some((key, index) => key !== declaredKeys[index]))
    throw new Error(
      `Applying the combo would order options as [${realizedKeys.join(', ')}] instead of [${declaredKeys.join(', ')}].`
    )

  return [
    'COMFY_DYNAMICCOMBO_V3',
    {
      options: options.map(([key, inputs]) => ({
        key,
        inputs: { required: inputs }
      }))
    }
  ]
}

describe('dynamicCombo fixture builder', () => {
  test('rejects option keys that a record reorders, and accepts those it does not', () => {
    const option = (key: string): ComboOption => [key, {}]

    expect(() => dynamicCombo(option('Seedance'), option('0'))).toThrow(
      /\[0, Seedance\] instead of \[Seedance, 0\]/
    )
    expect(() => dynamicCombo(option('0'), option('2'), option('1'))).toThrow(
      /\[0, 1, 2\] instead of \[0, 2, 1\]/
    )
    expect(() => dynamicCombo(option('a'), option('b'), option('a'))).toThrow(
      /Duplicate option keys/
    )
    expect(() =>
      dynamicCombo(option('0'), option('Seedance'), option('4294967295'))
    ).not.toThrow()
  })
})

function autogrow(template: {
  names: string[]
  min: number
  input: ChildInputs
}): InputSpec {
  const { names, min, input } = template
  return [
    'COMFY_AUTOGROW_V3',
    { template: { input: { required: input }, names, min } }
  ]
}

function testNodeDef(
  name: string,
  displayName: string,
  required: ChildInputs,
  output: string[],
  outputName: string[] = [...output]
): ComfyNodeDefV1 {
  return {
    name,
    display_name: displayName,
    category: 'testing',
    python_module: 'nodes',
    description: '',
    input: { required },
    output,
    output_name: outputName,
    output_node: false
  }
}

/**
 * A reduced `ResizeImageMaskNode` (FE-258): a dynamic combo whose default
 * option lays out a `width` child, and whose other option lays out a
 * `multiplier` child instead.
 */
const resizeNodeDef = testNodeDef(
  RESIZE_NODE_TYPE,
  'Resize Image Mask',
  {
    image: ['IMAGE', {}],
    resize_type: dynamicCombo(
      ['scale dimensions', { width: ['INT', {}] }],
      ['scale by multiplier', { multiplier: ['FLOAT', {}] }]
    )
  },
  ['IMAGE'],
  ['resized']
)

/**
 * The node saved on `scale by multiplier`, so its serialized inputs carry
 * `resize_type.multiplier` — a child the node definition does not lay out —
 * on the slot the definition gives to `resize_type.width`.
 */
function savedDynamicComboChildWorkflow(): SerialisableGraph {
  return {
    id: 'ab000000-0000-4000-8000-00000000f258',
    version: 1,
    revision: 0,
    state: { lastNodeId: 2, lastLinkId: 1, lastGroupId: 0, lastRerouteId: 0 },
    nodes: [
      {
        id: 1,
        type: SOURCE_NODE_TYPE,
        pos: [0, 0],
        size: [140, 60],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [{ name: 'out', type: 'FLOAT', links: [1] }],
        properties: {}
      },
      {
        id: 2,
        type: RESIZE_NODE_TYPE,
        pos: [300, 0],
        size: [200, 120],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [
          { name: 'image', type: 'IMAGE', link: null },
          { name: 'resize_type.multiplier', type: 'FLOAT', link: 1 }
        ],
        outputs: [{ name: 'resized', type: 'IMAGE', links: [] }],
        properties: {},
        widgets_values: ['scale by multiplier', 4]
      }
    ],
    links: [
      {
        id: toLinkId(1),
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 1,
        type: 'FLOAT'
      }
    ]
  }
}

describe('Dynamic combo child links on workflow load (FE-258)', () => {
  beforeEach(async () => {
    LiteGraph.registerNodeType(SOURCE_NODE_TYPE, SourceNode)
    await useLitegraphService().registerNodeDef(RESIZE_NODE_TYPE, resizeNodeDef)
  })

  test('lays out the default option, which the saved workflow does not select', () => {
    const graph = new LGraph()
    const node = LiteGraph.createNode(RESIZE_NODE_TYPE)
    assert.ok(node, 'resize node')
    graph.add(node)

    const children = node.inputs
      .map((input) => input.name)
      .filter((name) => name.startsWith('resize_type.'))
    expect(children).toEqual(['resize_type.width'])
  })

  test('keeps the link on the child the selected option lays out', () => {
    const graph = new LGraph()
    graph.configure(savedDynamicComboChildWorkflow())

    const target = graph.getNodeById(toNodeId(2))
    assert.ok(target, 'configured target node')
    const multiplierSlot = target.inputs.findIndex(
      (input) => input.name === 'resize_type.multiplier'
    )
    expect({
      inputNames: target.inputs.map((input) => input.name),
      multiplierLinkId: target.getInputLink(multiplierSlot)?.id
    }).toEqual({
      inputNames: ['image', 'resize_type', 'resize_type.multiplier'],
      multiplierLinkId: toLinkId(1)
    })
  })
})

const REFERENCE_NODE_TYPE = 'test/AutogrowInsideCombo'

/**
 * Shaped after `ByteDance2ReferenceNode`: a dynamic combo whose option holds
 * both an ordinary child widget and an autogrow group, so the group's children
 * are named `model.reference_images.<ordinal>` and its registry key is
 * `model.reference_images`.
 */
const referenceNodeDef = testNodeDef(
  REFERENCE_NODE_TYPE,
  'Autogrow Inside Combo',
  {
    model: dynamicCombo([
      'Seedance',
      {
        generate_audio: ['BOOLEAN', { default: true }],
        reference_images: autogrow({
          names: ['image_1', 'image_2', 'image_3'],
          min: 2,
          input: { reference_image: ['IMAGE', {}] }
        })
      }
    ])
  },
  ['VIDEO']
)

describe('Autogrow nested inside a group widget (FE-258)', () => {
  beforeEach(async () => {
    await useLitegraphService().registerNodeDef(
      REFERENCE_NODE_TYPE,
      referenceNodeDef
    )
  })

  test('leaves an autogrow child link where the group put it', () => {
    const graph = new LGraph()
    const node = LiteGraph.createNode(REFERENCE_NODE_TYPE)
    assert.ok(node, 'reference node')
    graph.add(node)
    const slotOf = (name: string) =>
      node.inputs.findIndex((input) => input.name === name)
    const connectedSlot = slotOf('model.reference_images.image_1')
    const nested = connectInput(node, connectedSlot, graph)

    realignGroupWidgetChildLinks(node, {
      id: node.id,
      inputs: node.inputs.map((input) => ({
        name: input.name,
        type: String(input.type),
        link: input.name === 'model.reference_images.image_3' ? nested.id : null
      }))
    })

    expect(nested.target_slot).toBe(connectedSlot)
  })
})

const GROWN_NODE_TYPE = 'test/AutogrowBeforeOrdinaryChild'

/**
 * Shaped after `OpenAIGPTImageNodeV2`: a dynamic combo option whose autogrow
 * group is followed by an ordinary child input. Reloading such a node replays
 * both links, and the group grows a slot while doing so.
 */
const grownNodeDef = testNodeDef(
  GROWN_NODE_TYPE,
  'Autogrow Before Ordinary Child',
  {
    model: dynamicCombo([
      'gpt-image-1',
      {
        seed: ['INT', { default: 0 }],
        images: autogrow({
          names: ['image_1', 'image_2', 'image_3', 'image_4'],
          min: 0,
          input: { image: ['IMAGE', {}] }
        }),
        mask: ['MASK', { forceInput: true }]
      }
    ])
  },
  ['IMAGE']
)

class ImageMaskSourceNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'ImageMaskSource')
    this.addOutput('image', 'IMAGE')
    this.addOutput('mask', 'MASK')
  }
}

describe('Autogrow followed by an ordinary combo child (FE-258)', () => {
  beforeEach(async () => {
    LiteGraph.registerNodeType('test/ImageMaskSource', ImageMaskSourceNode)
    await useLitegraphService().registerNodeDef(GROWN_NODE_TYPE, grownNodeDef)
  })

  test('keeps the autogrow slot count across a load', () => {
    const graph = new LGraph()
    const source = new ImageMaskSourceNode()
    graph.add(source)
    const node = LiteGraph.createNode(GROWN_NODE_TYPE)
    assert.ok(node, 'gpt image like node')
    graph.add(node)
    const slotOf = (name: string) =>
      node.inputs.findIndex((input) => input.name === name)
    source.connect(0, node, slotOf('model.images.image_1'))
    source.connect(1, node, slotOf('model.mask'))
    const inputNames = (target: LGraphNode) =>
      target.inputs.map(
        (input, slot) => `${input.name}${target.getInputLink(slot) ? '*' : ''}`
      )
    const before = inputNames(node).filter((name) =>
      name.startsWith('model.images.')
    )

    const reloaded = new LGraph()
    reloaded.configure(structuredClone(graph.serialize()))

    const reloadedNode = reloaded.getNodeById(node.id)
    assert.ok(reloadedNode, 'reloaded node')
    expect({
      images: inputNames(reloadedNode).filter((name) =>
        name.startsWith('model.images.')
      ),
      maskConnected: inputNames(reloadedNode).includes('model.mask*')
    }).toEqual({ images: before, maskConnected: true })
  })
})
